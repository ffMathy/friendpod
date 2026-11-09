/**
 * Erasure-ledger replay entry points (DESIGN.md §13 Backups, PRIVACY.md §5): after a PITR or backup restore, every
 * `erasureLedger` entry is replayed into the restored database by the same server code as the original action, before
 * traffic resumes. The admin CLI (tools/admin `restore replay-ledger`) calls `serverReplay`, in its own process, with
 * the restored database's id and UID_HMAC_KEY; it never needs the functions to be deployed against that database.
 *
 * uidH → uid. A ledger entry carries only `uidH`, an HMAC we cannot invert. The resolver computes uidH for every uid the
 * restored database still holds (users, matchProfiles, consentEvents, podState.memberList, reports, blocks) and maps
 * back; that is exactly the set of uids a replay could have anything to erase for. An `account` entry whose uidH
 * resolves to no uid still runs the uidH-keyed part of the purge (other profiles' `blockedH` and `recentH`,
 * `pairSignals`); every other kind then has nothing to do.
 *
 * Each handler skips an entry the restored data has overtaken (consent given again after a withdrawal, a holding or
 * gender consent created after its removal, a block made again after an unblock: the restored copy is newer than the
 * entry) and is otherwise idempotent. It writes the entry under its own id into the restored database, so the restored copy's
 * ledger is complete again (a later restore of that copy replays it too). Replays send no pushes, enqueue no tasks
 * and, by default, touch no Storage objects and no Auth users: neither is restored with Firestore.
 */
import type { ErasureKind } from '@friendpod/core';
import { uidHash, type HmacSha256 } from '@friendpod/core';
import { nodeHmacSha256 } from '@friendpod/core/node';
import { deleteApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { deletePhotoObjects } from './objects';
import { erasePhoto } from '../callables/account';
import { withdrawBlanketConsent } from '../callables/art9Consent';
import { removeOneInterest } from '../callables/interests';
import { applyBlock, applyUnblock } from '../callables/safety';
import { eraseGender } from '../callables/updateProfile';
import { docs } from '../lib/firestore';
import { log } from '../lib/log';
import type { AppDeps } from '../lib/runtime';
import { purgeUser } from '../tasks/purge';

const ms = (t: unknown): number | undefined => (t && typeof (t as { toMillis?: unknown }).toMillis === 'function' ? (t as { toMillis(): number }).toMillis() : undefined);

export interface ReplayEntry {
  readonly id: string;
  readonly uidH: string;
  readonly kind: ErasureKind;
  readonly ref?: string;
  readonly atMs: number;
}
export type ReplayResult = 'replayed' | 'nothingToDo';
export type ServerReplayHandlers = Record<ErasureKind, (entry: ReplayEntry) => Promise<ReplayResult>>;

/** Maps uidH back to uid by hashing every uid the database holds (built once per replay run). */
export class UidResolver {
  #index: Promise<Map<string, string>> | null = null;
  readonly #db: Firestore;
  readonly #hmac: HmacSha256;

  constructor(db: Firestore, hmac: HmacSha256) {
    this.#db = db;
    this.#hmac = hmac;
  }

  async resolve(uidH: string): Promise<string | null> {
    this.#index ??= this.#build();
    return (await this.#index).get(uidH) ?? null;
  }

  async #build(): Promise<Map<string, string>> {
    const db = this.#db;
    const uids = new Set<string>();
    for (const c of ['users', 'matchProfiles', 'pushTokens', 'sanctions']) for (const ref of await db.collection(c).listDocuments()) uids.add(ref.id);
    for (const d of (await db.collection('consentEvents').select('uid').get()).docs) if (typeof d.get('uid') === 'string') uids.add(d.get('uid') as string);
    for (const d of (await db.collection('podState').select('memberList').get()).docs) for (const u of (d.get('memberList') as string[] | undefined) ?? []) uids.add(u);
    for (const d of (await db.collection('reports').select('reporterUid', 'targetUid').get()).docs) {
      for (const f of ['reporterUid', 'targetUid']) if (typeof d.get(f) === 'string') uids.add(d.get(f) as string);
    }
    for (const d of (await db.collection('blocks').select('blocker', 'blocked').get()).docs) {
      for (const f of ['blocker', 'blocked']) if (typeof d.get(f) === 'string') uids.add(d.get(f) as string);
    }
    const out = new Map<string, string>();
    for (const uid of uids) out.set(await uidHash(this.#hmac, uid), uid);
    return out;
  }
}

/** The handlers, one per ledger kind, against `deps.db` (the restored database). */
export function replayHandlers(deps: AppDeps, o: { readonly storage?: boolean } = {}): ServerReplayHandlers {
  const resolver = new UidResolver(deps.db, deps.uidHmac());
  const uidOf = (h: string) => resolver.resolve(h);
  const pair = async (e: ReplayEntry) => {
    const [otherH, podId] = (e.ref ?? '').split(':');
    const [a, b] = await Promise.all([uidOf(e.uidH), otherH ? uidOf(otherH) : Promise.resolve(null)]);
    return a && b && podId ? { a, b, podId } : null;
  };
  return {
    async account(e) {
      const uid = await uidOf(e.uidH);
      await purgeUser(deps, uid, e.uidH, { ledgerId: e.id, storage: o.storage === true, auth: false });
      return uid ? 'replayed' : 'nothingToDo';
    },
    async interest(e) {
      const uid = await uidOf(e.uidH);
      if (!uid || !e.ref) return 'nothingToDo';
      // A holding created after the removal (same id) is not the one that was removed.
      const [ord, sens] = await Promise.all([docs(deps.db).interest(uid, e.ref).get(), docs(deps.db).sensitiveInterest(uid, e.ref).get()]);
      const created = ms(ord.get('createdAt')) ?? ms(sens.get('consentedAt'));
      if (created !== undefined && created > e.atMs) return 'nothingToDo';
      return (await removeOneInterest(deps, uid, e.ref, deps.now(), { ledger: { uidH: e.uidH, id: e.id } })) ? 'replayed' : 'nothingToDo';
    },
    async consentWithdrawal(e) {
      const uid = await uidOf(e.uidH);
      if (!uid) return 'nothingToDo';
      const user = (await docs(deps.db).user(uid).get()).data();
      const held = !(await deps.db.collection(`users/${uid}/sensitiveInterests`).limit(1).get()).empty;
      if (!user || (!user.legal.art9 && !held)) return 'nothingToDo';
      // Consent given again after the withdrawal is a new consent: its holdings are not the withdrawn ones.
      if (user.legal.art9 && user.legal.art9.at.toMillis() > e.atMs) return 'nothingToDo';
      await withdrawBlanketConsent(deps, uid, deps.now(), { ledger: { uidH: e.uidH, id: e.id } });
      return 'replayed';
    },
    async gender(e) {
      const uid = await uidOf(e.uidH);
      if (!uid) return 'nothingToDo';
      // A gender consent given after the opt-out stands.
      const consentAt = (await docs(deps.db).user(uid).get()).data()?.legal.genderConsentAt?.toMillis();
      if (consentAt !== undefined && consentAt > e.atMs) return 'nothingToDo';
      return (await eraseGender(deps, uid, deps.now(), { uidH: e.uidH, id: e.id })) ? 'replayed' : 'nothingToDo';
    },
    async photo(e) {
      const uid = await uidOf(e.uidH);
      if (!uid) return 'nothingToDo';
      const user = (await docs(deps.db).user(uid).get()).data();
      // A photo uploaded after the deletion (a higher version) is not the one that was deleted.
      if (!user?.photo || (e.ref !== undefined && user.photo.v > Number(e.ref))) return 'nothingToDo';
      await erasePhoto(deps, uid, deps.now(), { ledger: { uidH: e.uidH, id: e.id }, storage: o.storage === true });
      return 'replayed';
    },
    async block(e) {
      const p = await pair(e);
      if (!p || (await docs(deps.db).block(p.a, p.b).get()).exists) return 'nothingToDo';
      // Entries run in `at` order, so an unblock after this block is replayed after it.
      await applyBlock(deps, p.a, p.b, p.podId, deps.now(), { ledger: { id: e.id } });
      return 'replayed';
    },
    async unblock(e) {
      const p = await pair(e);
      if (!p) return 'nothingToDo';
      // A block made again after this unblock stands.
      const block = (await docs(deps.db).block(p.a, p.b).get()).data();
      if (block && block.createdAt.toMillis() > e.atMs) return 'nothingToDo';
      return (await applyUnblock(deps, p.a, p.b, deps.now(), { ledger: { id: e.id } })) ? 'replayed' : 'nothingToDo';
    },
  };
}

export interface ServerReplayOptions {
  readonly projectId: string;
  /** The restored database (`(default)` or a named database). */
  readonly databaseId: string;
  /** UID_HMAC_KEY: base64 of at least 32 bytes (from Secret Manager). */
  readonly uidHmacKeyB64: string;
  /** Also delete Storage objects (photos): off by default, Storage is not restored with Firestore. */
  readonly storage?: boolean;
}

/**
 * Opens the restored database with this codebase's own firebase-admin (the CLI's copy is a different module instance)
 * and returns the handlers. `close()` releases the app.
 */
export function serverReplay(o: ServerReplayOptions): { handlers: ServerReplayHandlers; close(): Promise<void> } {
  const key = Buffer.from(o.uidHmacKeyB64.trim(), 'base64');
  if (key.length < 32) throw new Error('UID_HMAC_KEY must be base64 of at least 32 bytes');
  const hmac = nodeHmacSha256(new Uint8Array(key));
  const name = `friendpod-replay-${o.databaseId}-${Date.now()}`;
  const app: App = initializeApp({ projectId: o.projectId }, name);
  const db = o.databaseId === '(default)' ? getFirestore(app) : getFirestore(app, o.databaseId);
  const deps: AppDeps = {
    now: () => Date.now(),
    uidHmac: () => hmac,
    log,
    db,
    get auth() {
      return getAuth(app);
    },
    push: async () => ({ sent: 0, staleTokens: [] }),
    tasks: { enqueue: async () => 'exists' },
    objects: deletePhotoObjects(app, o.storage === true),
  };
  return {
    handlers: replayHandlers(deps, { storage: o.storage === true }),
    close: async () => {
      if (getApps().some((a) => a.name === name)) await deleteApp(app);
    },
  };
}
