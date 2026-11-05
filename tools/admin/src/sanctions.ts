/**
 * Sanctions (DESIGN.md §3.7, §8.2, A38; PRIVACY.md §6 step 5, R20). Every sanction is automatic and expires on its own
 * (F17): `sanctions/{uid}` holds `type`, `until`, `reasonCode`, `noticeId`, and the hourly sweeper lifts it once
 * `until` has passed. The CLI therefore only lists sanctions and lifts one early, by moving `until` to now so the
 * sweeper's own expiry path does the rest. It never creates or lengthens a sanction, and it writes no ban.
 *
 * DESIGN-DEVIATION: §9 says there are no sanction commands since F17. `sanctions list` and `sanctions lift` are added
 * at the founder's request; lifting only shortens what an automated rule decided, which nobody reviews. `sanctions
 * ban` exists only to refuse: `bans/{HMAC(email)}` is not written in the MVP (§8.2, PRIVACY.md §6: a ban needs a
 * human decision, and D2 removed human review).
 */
import { uidHash, uidSchema } from '@grouper/core';
import { nodeHmacSha256 } from '@grouper/core/node';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { UsageError } from './args';
import { recorded } from './audit';
import type { AdminContext } from './context';
import { isoOf, millisOf, table } from './format';

export const SANCTIONS = 'sanctions';

export interface SanctionRow {
  readonly uid: string;
  readonly type: string;
  readonly until: string;
  readonly reasonCode: string;
  readonly active: boolean;
}

export function requireUid(value: string | undefined): string {
  const parsed = uidSchema.safeParse(value);
  if (!parsed.success) throw new UsageError('a uid is required');
  return parsed.data;
}

export async function listSanctions(db: Firestore, nowMs: number, opts: { includeExpired?: boolean } = {}): Promise<SanctionRow[]> {
  const snap = await db.collection(SANCTIONS).select('type', 'until', 'reasonCode').get();
  return snap.docs
    .map((d) => {
      const until = millisOf(d.get('until'));
      return {
        uid: d.id,
        type: String(d.get('type') ?? '-'),
        until: isoOf(d.get('until')),
        reasonCode: String(d.get('reasonCode') ?? '-'),
        active: until !== null && until > nowMs,
        untilMs: until ?? 0,
      };
    })
    .filter((r) => opts.includeExpired || r.active)
    .sort((a, b) => a.untilMs - b.untilMs || (a.uid < b.uid ? -1 : 1))
    .map(({ untilMs: _u, ...row }) => row);
}

export function formatSanctions(rows: readonly SanctionRow[]): string {
  if (rows.length === 0) return 'no sanctions';
  return table(
    ['uid', 'type', 'until', 'reasonCode', 'state'],
    rows.map((r) => [r.uid, r.type, r.until, r.reasonCode, r.active ? 'active' : 'expired (sweeper lifts it)']),
    5,
  );
}

export type LiftOutcome = 'lifted' | 'none' | 'alreadyExpired';

/** uidH (§8) with UID_HMAC_KEY (base64, ≥ 32 bytes), or null without the key. */
export async function uidHOf(uid: string, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const b64 = env.UID_HMAC_KEY?.trim();
  if (!b64) return null;
  const key = Buffer.from(b64, 'base64');
  if (key.length < 32) throw new UsageError('UID_HMAC_KEY must be base64 of at least 32 bytes');
  return uidHash(nodeHmacSha256(new Uint8Array(key)), uid);
}

/**
 * Moves `until` (and `expiresAt`, if set) to now; the sweeper lifts it on its next hourly run. The run record never
 * holds the uid (adminRuns lives 12 months, longer than an erased account may be traceable): its target is
 * `sanctions/{uidH}` with `subjectH` when UID_HMAC_KEY is set (purgeUser redacts it at erasure), else just `sanctions`.
 * A reason that contains the uid is refused for the same reason.
 */
export async function liftSanction(ctx: AdminContext, uid: string, reason: string, env: NodeJS.ProcessEnv = process.env): Promise<{ outcome: LiftOutcome; previousUntil: string | null }> {
  if (reason.includes(uid)) throw new UsageError('--reason must not contain the uid (it is kept in adminRuns for 12 months)');
  const db = ctx.db();
  const h = await uidHOf(uid, env);
  return recorded(ctx, db, { command: 'sanctions lift', target: h ? `${SANCTIONS}/${h}` : SANCTIONS, ...(h ? { subjectH: h } : {}), reason }, async () => {
    const ref = db.collection(SANCTIONS).doc(uid);
    const value = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { outcome: 'none' as const, previousUntil: null };
      const until = millisOf(snap.get('until'));
      const now = ctx.now();
      if (until !== null && until <= now) return { outcome: 'alreadyExpired' as const, previousUntil: isoOf(snap.get('until')) };
      const at = Timestamp.fromMillis(now);
      tx.update(ref, snap.get('expiresAt') === undefined ? { until: at } : { until: at, expiresAt: at });
      return { outcome: 'lifted' as const, previousUntil: isoOf(snap.get('until')) };
    });
    return { value, outcome: value.outcome };
  });
}

export function formatLift(uid: string, r: { outcome: LiftOutcome; previousUntil: string | null }): string {
  switch (r.outcome) {
    case 'none':
      return `sanctions/${uid}: no sanction`;
    case 'alreadyExpired':
      return `sanctions/${uid}: already expired at ${r.previousUntil}; the hourly sweeper lifts it`;
    case 'lifted':
      return `sanctions/${uid}: until moved from ${r.previousUntil} to now; the hourly sweeper lifts it on its next run (its expired-sanction path, §10.3).`;
  }
}

export const BAN_REFUSAL =
  'sanctions ban: refused. Grouper writes no bans in the MVP: a ban is permanent and needs a human decision, and there is no human review (F17/D2; DESIGN.md §8.2 `bans`, PRIVACY.md §6 step 5). Every sanction is automatic and expires on its own.';
