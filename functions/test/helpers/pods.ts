/**
 * Fixtures for the pod lifecycle emulator tests (DESIGN.md §4.6): users with match profiles and holdings written
 * directly, pods released through the real releaseDrop from a hand-written result object, and typed readers.
 */
import { randomBytes } from 'node:crypto';
import {
  LEGAL_TEXT_SHA256,
  dropSchedule,
  encodeGeohash,
  getLaunchArea,
  googleMapsPlaceUrl,
  type MatchResultFile,
  type WeekId,
} from '@friendpod/core';
import { nodeHmacSha256 } from '@friendpod/core/node';
import { DAY_MS, docs, PATHS, ts, type DocOf } from '../../src/lib/firestore';
import type { DropObjectStore } from '../../src/lib/storage';
import { releaseDrop, type ReleaseDeps } from '../../src/pods/release';
import { newUid, type TestDeps } from './emulator';

/** Esbjerg: outside every launch area, so pods there use the launch profile (confirmation at 4). */
export const LAUNCH_CELL = encodeGeohash(55.4765, 8.4594, 5);
/** An Aarhus cell: the alpha profile (confirmation at 3, §6.10). */
export const AARHUS_CELL = getLaunchArea('aarhus')!.cells[0]!;

export const testPodHmac = nodeHmacSha256(new Uint8Array(Buffer.alloc(32, 9)));

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
export const base32Id = (n: number): string => [...randomBytes(n)].map((b) => BASE32[b % 32]).join('');
export const newConcept = (): string => `c_${randomBytes(10).toString('hex')}`;
/** A distinct, valid component id per test: release only touches components that are not released yet. */
export const newComponentId = (cell = LAUNCH_CELL): string => `${cell}${base32Id(3)}`;

export class MemoryObjects implements DropObjectStore {
  readonly objects = new Map<string, Uint8Array>();
  async read(path: string): Promise<Uint8Array> {
    const o = this.objects.get(path);
    if (!o) throw new Error('No such object');
    return o;
  }
  async write(path: string, data: Uint8Array): Promise<void> {
    this.objects.set(path, data);
  }
  async createIfAbsent(path: string, data: Uint8Array): Promise<boolean> {
    if (this.objects.has(path)) return false;
    this.objects.set(path, data);
    return true;
  }
  async delete(path: string): Promise<void> {
    this.objects.delete(path);
  }
}

/** One store per test file, so a release sees the objects of every component of its week. */
export const sharedDrops = new MemoryObjects();

export function releaseDeps(deps: TestDeps, drops: DropObjectStore = sharedDrops): ReleaseDeps {
  return {
    now: () => deps.now(),
    uidHmac: () => deps.uidHmac(),
    log: deps.log,
    push: (kind, recipients, params) => deps.push(kind, recipients, params),
    tasks: deps.tasks,
    objects: deps.objects,
    get db() {
      return deps.db;
    },
    get auth() {
      return deps.auth;
    },
    drops,
    podIdHmac: () => testPodHmac,
    wait: async () => {},
  };
}

export interface UserOptions {
  readonly gh5?: string;
  readonly areaId?: string | null;
  readonly themes?: readonly { readonly c: string; readonly sens?: boolean }[];
  readonly firstName?: string;
  readonly birthYear?: number;
  readonly photoV?: number;
  readonly aboutMe?: string;
  readonly status?: 'active' | 'paused';
  readonly lastDrop?: { weekId: WeekId; outcome: 'unmatched' | 'proposed' };
}

/** An onboarded user with a match profile, one holding per theme (ordinary or sensitive) and a push token. */
export async function makeUser(deps: TestDeps, o: UserOptions = {}): Promise<string> {
  const uid = newUid();
  const refs = docs(deps.db);
  const at = ts(deps.clock.now - 60 * DAY_MS);
  const gh5 = o.gh5 ?? LAUNCH_CELL;
  const themes = o.themes ?? [];
  const art9 = themes.some((t) => t.sens);
  const user: DocOf<'user'> = {
    firstName: o.firstName ?? 'Ada',
    locale: 'en',
    birthYear: o.birthYear ?? 1990,
    area: { gh5, label: o.areaId === undefined || o.areaId === null ? '' : getLaunchArea(o.areaId)!.label.en, areaId: o.areaId ?? null },
    prefs: { ageMin: 18, ageMax: 99, maxKm: 25, languages: ['en', 'da'], availability: 63, sameGenderOnly: false, openToAnyone: false },
    gender: null,
    participation: { mode: 'auto' },
    photo: o.photoV ? { v: o.photoV } : null,
    stats: { attended: 0, noShows: 0, lateCancels: 0 },
    status: o.status ?? 'active',
    lastDrop: null,
    legal: { terms: 't1', privacy: 'p1', ...(art9 ? { art9: { textVersion: 'art9-blanket-en-v2', textSha256: LEGAL_TEXT_SHA256['art9-blanket-en-v2'], at } } : {}) },
    ...(o.aboutMe ? { aboutMe: o.aboutMe } : {}),
    interestCount: themes.length,
    createdAt: at,
    lastActiveAt: at,
  };
  const matchThemes = themes.map((t) => (t.sens ? { c: t.c, starred: false, sens: true as const, consentRef: 'consentEvt1' } : { c: t.c, starred: false, sens: false as const }));
  const profile: DocOf<'matchProfile'> = {
    status: o.status ?? 'active',
    areaId: o.areaId ?? null,
    gh5,
    birthYear: user.birthYear,
    ageMin: 18,
    ageMax: 99,
    maxKm: 25,
    sameGenderOnly: false,
    gender: null,
    languages: ['en', 'da'],
    availability: 63,
    themes: matchThemes,
    themeIds: matchThemes.map((t) => t.c),
    secondary: matchThemes.filter((t) => !t.sens).map((t) => t.c),
    blockedH: [],
    recentH: {},
    recentMinUntil: null,
    reliability: 0.8,
    noShowEvents: [],
    waitingSinceWeek: '2026-W40' as WeekId,
    declinesInRow: 0,
    ignoredInRow: 0,
    activePods: 0,
    activeSensitivePods: 0,
    sensitiveProposals: [],
    sensitiveHold: null,
    weekClaim: null,
    lastDrop: o.lastDrop ?? null,
    attendedVerified: 1,
    founderInvited: false,
    openReportCount: 0,
    priority: false,
    openToAnyone: false,
    participation: { mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: null },
    milestones: {},
    createdAt: at,
    updatedAt: at,
  };
  const batch = deps.db.batch();
  batch.set(refs.user(uid), user);
  batch.set(refs.matchProfile(uid), profile);
  // A fresh token: pushes skip tokens not refreshed for 60 days.
  batch.set(refs.pushTokens(uid), { tokens: [{ token: `tok-${uid}`, platform: 'ios', updatedAt: ts(deps.clock.now) }] });
  for (const t of themes) {
    const id = base32Id(16);
    if (t.sens) {
      batch.set(refs.sensitiveInterest(uid, id), {
        display: `my ${t.c.slice(-4)}`,
        norm: `my ${t.c.slice(-4)}`,
        conceptId: t.c,
        selfFlagged: false,
        source: 'model',
        consentEventId: 'consentEvt1',
        consentTextVersion: 'art9-blanket-en-v2',
        consentedAt: at,
        starred: false,
      });
    } else {
      batch.set(refs.interest(uid, id), { display: `my ${t.c.slice(-4)}`, norm: `my ${t.c.slice(-4)}`, conceptId: t.c, starred: false, createdAt: at });
    }
  }
  await batch.commit();
  return uid;
}

/** A concept doc with the fields the drop snapshot projects (§6.4): a unit c128 as little-endian float32 bytes. */
export async function makeConcept(deps: TestDeps, id = newConcept(), sensitive = false): Promise<string> {
  const v = Float32Array.from({ length: 128 }, (_, i) => 1 + 0.1 * Math.sin(id.charCodeAt(5) * 31 + i));
  const norm = Math.hypot(...v);
  const bytes = Buffer.alloc(512);
  v.forEach((x, i) => bytes.writeFloatLE(x / norm, i * 4));
  await deps.db.doc(`concepts/${id}`).set({ c128: bytes, sensitive, status: 'active' });
  return id;
}

/** Three ordinary interests: the matcher's minimum (§4.3), with `theme` first. */
export const threeThemes = (theme: string) => [{ c: theme }, { c: newConcept() }, { c: newConcept() }];

export async function makeUsers(deps: TestDeps, n: number, o: UserOptions = {}): Promise<string[]> {
  const names = ['Ada', 'Bo', 'Cai', 'Dag', 'Eva', 'Finn', 'Gry'];
  return Promise.all(Array.from({ length: n }, (_, i) => makeUser(deps, { firstName: names[i % names.length], ...o })));
}

export interface ReleaseOptions {
  readonly weekId: WeekId;
  readonly theme: string;
  readonly sensitive?: boolean;
  readonly componentId?: string;
  readonly dryRun?: boolean;
  readonly unmatched?: readonly string[];
  readonly drops?: MemoryObjects;
}

/** Writes a computed component with a result object holding these pods, as matchComponent would. */
export async function computedComponent(deps: TestDeps, pods: readonly (readonly string[])[], o: ReleaseOptions): Promise<{ componentId: string; drops: MemoryObjects }> {
  const componentId = o.componentId ?? newComponentId();
  const drops = o.drops ?? sharedDrops;
  const inputHash = randomBytes(32).toString('hex');
  const resultPath = `${o.weekId}/${componentId}.result.${inputHash}.json`;
  const inputPath = `${o.weekId}/${componentId}.input.json.gz`;
  const result: MatchResultFile = {
    v: 1,
    weekId: o.weekId,
    componentId,
    inputHash,
    pods: pods.map((members) => ({
      members: [...members].sort(),
      theme: { kind: 'concept', conceptId: o.theme, sensitive: o.sensitive ?? false },
      value: 4.2,
      reasons: Object.fromEntries(members.map((m) => [m, { alsoShare: [], nearKm: 5, ageSpan: { min: 30, max: 36 }, priorityWeeks: null }])),
    })),
    unmatched: (o.unmatched ?? []).map((uid) => ({ uid, reason: 'NO_FIT_THIS_WEEK' as const })),
    stats: {},
  };
  drops.objects.set(resultPath, new TextEncoder().encode(JSON.stringify(result)));
  drops.objects.set(inputPath, new Uint8Array([1, 2, 3]));
  await docs(deps.db)
    .dropComponent(o.weekId, componentId)
    .set({ status: 'computed', dryRun: o.dryRun ?? false, inputHash, inputPath, computed: { inputHash, path: resultPath } });
  return { componentId, drops };
}

/** Releases one pod of these members at Thursday 18:00 of `weekId`; returns its id. */
export async function releasedPod(deps: TestDeps, members: readonly string[], o: ReleaseOptions): Promise<string> {
  const { drops } = await computedComponent(deps, [members], o);
  deps.clock.now = dropSchedule(o.weekId).releaseAt;
  await releaseDrop(releaseDeps(deps, drops), o.weekId);
  const states = await deps.db.collection('podState').where('memberList', 'array-contains', members[0]).get();
  const match = states.docs.find((d) => d.get('weekId') === o.weekId);
  if (!match) throw new Error('pod not released');
  return match.id;
}

export const read = {
  podState: async (deps: TestDeps, podId: string) => (await docs(deps.db).podState(podId).get()).data(),
  pod: async (deps: TestDeps, podId: string) => (await docs(deps.db).pod(podId).get()).data(),
  card: async (deps: TestDeps, uid: string, podId: string) => (await docs(deps.db).podCard(uid, podId).get()).data(),
  profile: async (deps: TestDeps, uid: string) => (await docs(deps.db).matchProfile(uid).get()).data()!,
  user: async (deps: TestDeps, uid: string) => (await docs(deps.db).user(uid).get()).data(),
  grant: async (deps: TestDeps, owner: string, viewer: string) => (await docs(deps.db).photoGrant(owner, viewer).get()).data(),
  options: async (deps: TestDeps, podId: string) => (await deps.db.collection(`${PATHS.pod(podId)}/options`).get()).docs.map((d) => d.id),
  funnel: async (deps: TestDeps, areaId: string | null, weekId: WeekId) => (await deps.db.doc(`funnel/${areaId ?? 'none'}_${weekId}`).get()).data() as { counts?: Record<string, number> } | undefined,
};

export function place(name = 'Dokk1') {
  const placeId = `ChIJ${base32Id(12)}`;
  return { placeId, name, address: 'Hack Kampmanns Plads 2, Aarhus', lat: 56.1532, lng: 10.214, type: 'library' as const, mapUrl: googleMapsPlaceUrl(placeId, name) };
}

/** Pushed uids per kind since index `from`. */
export function pushedUids(deps: TestDeps, kind: string, from = 0): string[] {
  return deps.pushes
    .slice(from)
    .filter((p) => p.kind === kind)
    .flatMap((p) => p.recipients.flatMap((r) => r.tokens.map((t) => t.replace(/^tok-/, ''))))
    .sort();
}
