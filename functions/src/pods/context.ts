/**
 * One pod transaction (DESIGN.md §4.6): every transition reads `podState/{podId}` inside a Firestore transaction and
 * writes it back with `version + 1`, so callables and the sweeper race safely (the transaction is the compare-and-set;
 * work computed outside a transaction checks `version` itself, see backfill.ts).
 *
 * PodTx buffers everything: documents are read on demand and changed in memory, and `commit()` first reads whatever
 * the changes still need (cards, photo grants) and then writes, because a Firestore transaction must read before it
 * writes. Pushes and task enqueues are collected as effects and run only after the transaction has committed, so a
 * retried transaction never sends twice.
 */
import {
  ACTIVE_POD_STATES,
  getMatchingProfile,
  proposalDecisionAt,
  resolveLaunchArea,
  type CardMemberStatus,
  type FunnelStage,
  type Gh5,
  type MatchingProfile,
  type PodState,
  type WeekId,
} from '@grouper/core';
import { FieldPath, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { DAY_MS, docs, PATHS, ts, type DocOf } from '../lib/firestore';
import { claimMilestones, FunnelIncrements, type FunnelEvent } from '../lib/funnel';
import { meetupMilestone } from '@grouper/core';
import type { PushKind } from '../lib/push';
import type { AppDeps } from '../lib/runtime';
import type { TaskOptions, TaskQueueName } from '../lib/tasks';

export type PodStateDoc = DocOf<'podState'>;
export type PodDoc = DocOf<'pod'>;
export type CardDoc = DocOf<'podCard'>;
export type UserDoc = DocOf<'user'>;
export type ProfileDoc = DocOf<'matchProfile'>;
export type OptionDoc = DocOf<'option'>;
export type Member = PodStateDoc['members'][string];
export type MemberStatus = Member['status'];
export type Timers = PodStateDoc['timers'];

/** Cards of declined, expired, left or dissolved invitations expire 14 days later (§8.1). */
export const CARD_TTL_MS = 14 * DAY_MS;
/** Notices live 12 months (§8.1). */
export const NOTICE_TTL_MS = 365 * DAY_MS;

export interface Effects {
  readonly pushes: { kind: PushKind; uids: string[] }[];
  readonly tasks: { queue: TaskQueueName; data: Record<string, unknown>; options: TaskOptions }[];
}

export const ms = (t: { toMillis(): number } | undefined): number | undefined => t?.toMillis();

/** The launch area of the pod's component decides the matching profile (confirmationMin, H5 windows, §6.10). */
export function podProfile(componentId: string): MatchingProfile {
  return getMatchingProfile(resolveLaunchArea(componentId as Gh5)?.profile ?? 'launch');
}

export function podAreaLabel(componentId: string): string {
  return resolveLaunchArea(componentId as Gh5)?.label.da ?? '';
}

/** The earliest unprocessed timer of the pod's state (§4.1); null once the pod has ended. */
export function podDueAt(ps: PodStateDoc): number | null {
  const t = ps.timers;
  const c: (number | undefined)[] = [];
  const invited = Object.values(ps.members).filter((m) => m.status === 'invited');
  if (invited.some((m) => !m.viaBackfill)) c.push(ms(t.acceptBy));
  if (invited.some((m) => m.viaBackfill)) c.push(ms(t.backfillUntil));
  switch (ps.state) {
    case 'proposed':
      c.push(proposalDecisionAt(t.acceptBy.toMillis(), ms(t.backfillUntil) ?? null));
      break;
    case 'planning':
      c.push(ms(t.planDeadline));
      break;
    case 'scheduled':
      c.push(ms(t.stillComing3d), ms(t.stillComing24h), ms(t.nudge6h), ms(t.attendanceCheck), ms(t.reminder), ms(t.happened));
      break;
    case 'happened':
      c.push(ms(t.feedbackPush), ms(t.feedbackReminder), ms(t.feedbackCloses));
      break;
    default:
      return null;
  }
  const present = c.filter((x): x is number => x !== undefined);
  return present.length === 0 ? null : Math.min(...present);
}

const CARD_STATUS: Readonly<Record<MemberStatus, CardMemberStatus>> = {
  invited: 'invited',
  accepted: 'accepted',
  declined: 'declined',
  left: 'left',
  removed: 'left',
  expired: 'invited',
};

const grantKey = (owner: string, viewer: string) => `${owner}_${viewer}`;

export class PodTx {
  ps!: PodStateDoc;
  pod: PodDoc | null = null;
  private podExisted = false;
  private podDirty = false;
  private readonly users = new Map<string, UserDoc | null>();
  private readonly profiles = new Map<string, ProfileDoc | null>();
  private readonly dirtyUsers = new Set<string>();
  private readonly dirtyProfiles = new Set<string>();
  private readonly newCards = new Map<string, CardDoc>();
  private readonly cardPatches = new Map<string, Partial<CardDoc>>();
  private readonly grantOps: { key: string; add: boolean }[] = [];
  private options: Map<string, OptionDoc> | null = null;
  private readonly optionWrites = new Map<string, OptionDoc | null>();
  private readonly extraWrites: ((tx: Transaction) => void)[] = [];
  private readonly funnel = new FunnelIncrements();
  readonly effects: Effects = { pushes: [], tasks: [] };
  private readonly refs;

  private constructor(
    readonly deps: AppDeps,
    readonly tx: Transaction,
    readonly podId: string,
    readonly now: number,
  ) {
    this.refs = docs(deps.db);
  }

  /** Reads podState and the shared pod doc; null when the pod does not exist. */
  static async open(deps: AppDeps, tx: Transaction, podId: string, now: number): Promise<PodTx | null> {
    const ctx = new PodTx(deps, tx, podId, now);
    const refs = docs(deps.db);
    const [ps, pod] = await Promise.all([tx.get(refs.podState(podId)), tx.get(refs.pod(podId))]);
    const data = ps.data();
    if (!data) return null;
    ctx.ps = structuredClone(data);
    // Timestamps do not survive structuredClone's prototype loss; keep the parsed objects.
    ctx.ps = { ...data, timers: { ...data.timers }, members: Object.fromEntries(Object.entries(data.members).map(([k, v]) => [k, { ...v }])), backfill: { ...data.backfill }, memberList: [...data.memberList] };
    const p = pod.data();
    ctx.podExisted = p !== undefined;
    ctx.pod = p ? clonePod(p) : null;
    return ctx;
  }

  get profile(): MatchingProfile {
    return podProfile(this.ps.componentId);
  }

  get version(): number {
    return this.ps.version;
  }

  get state(): PodState {
    return this.ps.state;
  }

  get isActive(): boolean {
    return ACTIVE_POD_STATES.includes(this.ps.state);
  }

  /** Confirmed members (`pods.memberUids`) once the pod is confirmed; before that, those who accepted. */
  currentMembers(): string[] {
    if (this.pod) return [...this.pod.memberUids];
    return this.byStatus('accepted');
  }

  byStatus(...statuses: MemberStatus[]): string[] {
    return Object.entries(this.ps.members)
      .filter(([, m]) => statuses.includes(m.status))
      .map(([uid]) => uid)
      .sort();
  }

  setMember(uid: string, patch: Partial<Member>): void {
    const m = this.ps.members[uid];
    if (!m) throw new Error('not a pod member');
    this.ps.members[uid] = { ...m, ...patch };
  }

  // ---------------------------------------------------------------- reads (all before the first write)

  async loadUsers(uids: readonly string[]): Promise<void> {
    const missing = [...new Set(uids)].filter((u) => !this.users.has(u));
    if (missing.length === 0) return;
    const snaps = await this.tx.getAll(...missing.map((u) => this.refs.user(u)));
    snaps.forEach((s, i) => this.users.set(missing[i]!, s.data() ?? null));
  }

  async loadProfiles(uids: readonly string[]): Promise<void> {
    const missing = [...new Set(uids)].filter((u) => !this.profiles.has(u));
    if (missing.length === 0) return;
    const snaps = await this.tx.getAll(...missing.map((u) => this.refs.matchProfile(u)));
    snaps.forEach((s, i) => {
      const p = s.data();
      this.profiles.set(missing[i]!, p ? { ...p, recentH: { ...p.recentH }, milestones: { ...p.milestones } } : null);
    });
  }

  async loadPeople(uids: readonly string[]): Promise<void> {
    await Promise.all([this.loadUsers(uids), this.loadProfiles(uids)]);
  }

  user(uid: string): UserDoc | null {
    if (!this.users.has(uid)) throw new Error('user not loaded');
    return this.users.get(uid)!;
  }

  matchProfile(uid: string): ProfileDoc | null {
    if (!this.profiles.has(uid)) throw new Error('profile not loaded');
    return this.profiles.get(uid)!;
  }

  updateUser(uid: string, f: (u: UserDoc) => UserDoc): void {
    const u = this.user(uid);
    if (!u) return;
    this.users.set(uid, f(u));
    this.dirtyUsers.add(uid);
  }

  updateProfile(uid: string, f: (p: ProfileDoc) => ProfileDoc): void {
    const p = this.matchProfile(uid);
    if (!p) return;
    this.profiles.set(uid, { ...f(p), updatedAt: ts(this.now) });
    this.dirtyProfiles.add(uid);
  }

  /** Funnel stage once per user (§6.8): the milestone and the counter commit together. */
  claimFunnel(uid: string, event: FunnelEvent): void {
    const p = this.matchProfile(uid);
    if (!p) return;
    const stage: FunnelStage | null = event === 'meetupHappened' ? meetupMilestone(p.milestones) : event;
    if (stage === null) return;
    const { milestones, fresh } = claimMilestones(p.milestones, [stage], this.now);
    if (fresh.length === 0) return;
    for (const s of fresh) this.funnel.stage(p.areaId, this.now, s);
    this.updateProfile(uid, (q) => ({ ...q, milestones }));
  }

  async loadOptions(): Promise<Map<string, OptionDoc>> {
    if (!this.options) {
      const snap = await this.tx.get(this.deps.db.collection(`${PATHS.pod(this.podId)}/options`).withConverter(this.refs.option('x', 'x').converter as never));
      this.options = new Map(snap.docs.map((d) => [d.id, d.data() as OptionDoc]));
    }
    return this.options;
  }

  /** Current options after this transaction's changes. */
  currentOptions(): Map<string, OptionDoc> {
    if (!this.options) throw new Error('options not loaded');
    const out = new Map(this.options);
    for (const [id, o] of this.optionWrites) {
      if (o === null) out.delete(id);
      else out.set(id, o);
    }
    return out;
  }

  setOption(id: string, option: OptionDoc): void {
    this.optionWrites.set(id, option);
  }

  deleteOption(id: string): void {
    this.optionWrites.set(id, null);
  }

  // ---------------------------------------------------------------- pod doc, cards, grants, notices

  setPod(pod: PodDoc): void {
    this.pod = pod;
    this.podDirty = true;
  }

  updatePod(f: (p: PodDoc) => PodDoc): void {
    if (!this.pod) throw new Error('pod not confirmed');
    this.setPod(f(this.pod));
  }

  createCard(uid: string, card: CardDoc): void {
    this.newCards.set(uid, card);
  }

  patchCard(uid: string, patch: Partial<CardDoc>): void {
    this.cardPatches.set(uid, { ...this.cardPatches.get(uid), ...patch });
  }

  grant(owner: string, viewer: string): void {
    if (owner !== viewer) this.grantOps.push({ key: grantKey(owner, viewer), add: true });
  }

  revoke(owner: string, viewer: string): void {
    if (owner !== viewer) this.grantOps.push({ key: grantKey(owner, viewer), add: false });
  }

  /** Every grant entry for this pod, in both directions, between any two people ever in it. */
  revokeAll(): void {
    const all = this.ps.memberList;
    for (const a of all) for (const b of all) this.revoke(a, b);
  }

  notice(uid: string, code: string): void {
    const ref = this.deps.db.collection(`${PATHS.user(uid)}/notices`).doc().withConverter(this.refs.notice(uid, 'x').converter as never);
    const at = this.now;
    const podId = this.podId;
    this.extraWrites.push((tx) =>
      tx.create(ref as DocumentReference, { type: 'system', code, params: { podId }, createdAt: ts(at), expiresAt: ts(at + NOTICE_TTL_MS) }),
    );
  }

  write(f: (tx: Transaction) => void): void {
    this.extraWrites.push(f);
  }

  push(kind: PushKind, uids: readonly string[]): void {
    const list = [...new Set(uids)].sort();
    if (list.length > 0) this.effects.pushes.push({ kind, uids: list });
  }

  task(queue: TaskQueueName, data: Record<string, unknown>, options: TaskOptions): void {
    this.effects.tasks.push({ queue, data, options });
  }

  // ---------------------------------------------------------------- commit

  async commit(): Promise<Effects> {
    const tx = this.tx;
    const refs = this.refs;
    // Reads still needed by the writes.
    const cardUids = this.ps.memberList.filter((u) => !this.newCards.has(u));
    const cardSnaps = cardUids.length > 0 ? await tx.getAll(...cardUids.map((u) => refs.podCard(u, this.podId))) : [];
    const grantKeys = [...new Set(this.grantOps.map((o) => o.key))];
    const grantSnaps = grantKeys.length > 0 ? await tx.getAll(...grantKeys.map((k) => this.deps.db.collection('photoGrants').doc(k).withConverter(refs.photoGrant('a', 'b').converter as never))) : [];

    // podState
    this.ps.version += 1;
    const due = podDueAt(this.ps);
    const { dueAt: _old, ...rest } = this.ps;
    this.ps = due === null ? rest : { ...rest, dueAt: ts(due) };
    tx.set(refs.podState(this.podId), this.ps);

    if (this.podDirty && this.pod) {
      if (this.podExisted) tx.set(refs.pod(this.podId), this.pod);
      else tx.create(refs.pod(this.podId), this.pod);
    }

    // Cards follow the pod: state, accepted count and the viewer's own status (§8.1).
    const current = new Set(this.currentMembers());
    const count = this.pod ? this.pod.memberUids.length : this.byStatus('accepted').length;
    const cardFor = (uid: string, card: CardDoc): CardDoc => {
      const m = this.ps.members[uid];
      if (!m) return card;
      const live = m.status === 'invited' || m.status === 'accepted';
      const myStatus = CARD_STATUS[m.status];
      const ended = this.ps.state === 'dissolved' || (!live && m.status !== 'accepted');
      const next: CardDoc = {
        ...card,
        ...(live || current.has(uid) || this.ps.state === 'archived' || this.ps.state === 'dissolved' ? { state: this.ps.state } : {}),
        myStatus,
        ...(live || current.has(uid) ? { acceptedCount: Math.min(6, count) } : {}),
        ...this.cardPatches.get(uid),
      };
      if ((ended || m.status === 'expired') && next.expiresAt === undefined) return { ...next, expiresAt: ts(this.now + CARD_TTL_MS) };
      return next;
    };
    for (const [uid, card] of this.newCards) tx.create(refs.podCard(uid, this.podId), cardFor(uid, card));
    cardSnaps.forEach((snap, i) => {
      const card = snap.data();
      if (!card) return;
      const uid = cardUids[i]!;
      const next = cardFor(uid, card);
      if (!sameCard(card, next)) tx.set(refs.podCard(uid, this.podId), next);
    });

    for (const uid of this.dirtyUsers) {
      const u = this.users.get(uid);
      if (u) tx.set(refs.user(uid), u);
    }
    for (const uid of this.dirtyProfiles) {
      const p = this.profiles.get(uid);
      if (p) tx.set(refs.matchProfile(uid), p);
    }

    // Photo grants: a pod id is added or removed per (owner, viewer); an empty grant doc is deleted (§9).
    const grants = new Map<string, { pods: string[]; createdAt: DocOf<'photoGrant'>['createdAt'] } | null>();
    grantSnaps.forEach((s, i) => grants.set(grantKeys[i]!, (s.data() as DocOf<'photoGrant'> | undefined) ?? null));
    const before = new Map([...grants].map(([k, v]) => [k, JSON.stringify(v?.pods ?? [])]));
    for (const op of this.grantOps) {
      const g = grants.get(op.key) ?? null;
      const pods = new Set(g?.pods ?? []);
      if (op.add) pods.add(this.podId);
      else pods.delete(this.podId);
      grants.set(op.key, pods.size === 0 ? null : { pods: [...pods].sort(), createdAt: g?.createdAt ?? ts(this.now) });
    }
    for (const [key, g] of grants) {
      if (JSON.stringify(g?.pods ?? []) === before.get(key)) continue;
      const ref = this.deps.db.collection('photoGrants').doc(key);
      if (g === null) tx.delete(ref);
      else tx.set(ref.withConverter(refs.photoGrant('a', 'b').converter as never), g);
    }

    for (const [id, o] of this.optionWrites) {
      if (o === null) tx.delete(this.deps.db.doc(PATHS.option(this.podId, id)));
      else tx.set(refs.option(this.podId, id), o);
    }
    for (const f of this.extraWrites) f(tx);
    if (!this.funnel.isEmpty) this.funnel.write(this.deps.db, tx);
    return this.effects;
  }
}

function sameCard(a: CardDoc, b: CardDoc): boolean {
  const norm = (c: CardDoc) => JSON.stringify(c, (_k, v: unknown) => (v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis(): number }).toMillis() : v));
  return norm(a) === norm(b);
}

function clonePod(p: PodDoc): PodDoc {
  return {
    ...p,
    memberUids: [...p.memberUids],
    roster: Object.fromEntries(Object.entries(p.roster).map(([k, v]) => [k, { ...v }])),
    planning: { ...p.planning },
    ...(p.attendance ? { attendance: { ...p.attendance } } : {}),
  };
}

/** `recentMinUntil` (§8.2): the earliest until-week, so dailyMaintenance finds profiles with an entry to prune. */
export function recentMinUntil(recentH: Readonly<Record<string, WeekId>>): WeekId | null {
  const values = Object.values(recentH).sort();
  return values[0] ?? null;
}

/** Drops entries whose window has passed: `untilWeek` is exclusive (H5). */
export function pruneRecent(recentH: Readonly<Record<string, WeekId>>, currentWeek: WeekId): Record<string, WeekId> {
  return Object.fromEntries(Object.entries(recentH).filter(([, until]) => currentWeek < until));
}

export { FieldPath };
