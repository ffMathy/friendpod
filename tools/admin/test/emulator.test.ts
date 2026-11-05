/**
 * Data-access tests against the Firestore emulator (`npm -w tools/admin run test:emulator`). Skipped when
 * FIRESTORE_EMULATOR_HOST is not set, so `npm test` stays emulator-free. The task queue is a fake enqueuer.
 */
import { randomUUID } from 'node:crypto';
import { getLaunchArea, uidHash } from '@grouper/core';
import { nodeHmacSha256 } from '@grouper/core/node';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_RUNS } from '../src/audit';
import { EXIT_INCOMPLETE, EXIT_OK, EXIT_USAGE, run, type CliDeps } from '../src/cli';
import { createContext, type AdminContext, type EnqueueOutcome } from '../src/context';
import { serverReplayHandlers, type ReplayHandlers } from '../src/replay';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-grouper';
const NOW = Date.parse('2026-11-12T12:00:00Z'); // 2026-W46
const RESTORED = 'restored';

describe.skipIf(!HOST)('admin CLI against the Firestore emulator', () => {
  let app: App;
  let db: Firestore;
  let restored: Firestore;
  let enqueued: string[];
  let enqueueResult: EnqueueOutcome;

  const ctx = (): AdminContext => ({
    project: PROJECT,
    emulator: true,
    db: (id = '(default)') => (id === '(default)' ? db : id === RESTORED ? restored : getFirestore(app, id)),
    tasks: { openArea: async (areaId) => (enqueued.push(areaId), enqueueResult) },
    actor: async () => 'admin@example.test',
    now: () => NOW,
    close: async () => undefined,
  });
  const deps = (extra: Partial<CliDeps> = {}): CliDeps => ({ context: ctx, ...extra });
  const cli = (argv: string[], extra?: Partial<CliDeps>) => run([...argv, '--project', PROJECT], deps(extra));

  async function clear(database: string): Promise<void> {
    const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/${database}/documents`, { method: 'DELETE' });
    expect(res.ok).toBe(true);
  }

  async function runs(): Promise<Record<string, unknown>[]> {
    return (await db.collection(ADMIN_RUNS).get()).docs.map((d) => d.data());
  }

  beforeAll(() => {
    app = initializeApp({ projectId: PROJECT }, `admin-test-${randomUUID()}`);
    db = getFirestore(app);
    restored = getFirestore(app, RESTORED);
  });
  afterAll(async () => {
    await deleteApp(app);
  });
  beforeEach(async () => {
    await clear('(default)');
    await clear(RESTORED);
    enqueued = [];
    enqueueResult = 'enqueued';
  });

  describe('areas (§6.4)', () => {
    it('set-status live creates a missing doc from areas.json, enqueues openArea and records the reason', async () => {
      const r = await cli(['areas', 'set-status', 'aarhus', 'live', '--reason', 'Q11 criteria met two weeks running']);
      expect(r.stderr).toBe('');
      expect(r.code).toBe(EXIT_OK);
      expect(r.stdout).toMatch(/created from areas.json with status "live"/);
      expect(r.stdout).toMatch(/openArea enqueued \(task open-aarhus\)/);
      expect(r.stdout).toMatch(/areas\.json still lists aarhus as "waitlist"/);
      expect(enqueued).toEqual(['aarhus']);
      const doc = (await db.doc('areas/aarhus').get()).data()!;
      expect(doc).toMatchObject({ status: 'live', waitlistCount: 0, profile: getLaunchArea('aarhus')!.profile, chips: [] });
      const [record] = await runs();
      expect(record).toMatchObject({
        command: 'areas set-status',
        target: 'aarhus',
        reason: 'Q11 criteria met two weeks running',
        actor: 'admin@example.test',
        project: PROJECT,
        outcome: 'changed',
        details: { previous: 'none', status: 'live', openArea: 'enqueued' },
      });
      expect((record!.expiresAt as Timestamp).toMillis()).toBeGreaterThan(NOW);
    });

    it('keeps the exact waitlist count and enqueues nothing for waitlist or beta', async () => {
      await db.doc('areas/vejle').set({ status: 'live', waitlistCount: 42, label: { da: 'Vejle', en: 'Vejle' } });
      const r = await cli(['areas', 'set-status', 'vejle', 'beta', '--reason', 'pause the launch']);
      expect(r.code).toBe(EXIT_OK);
      expect(r.stdout).toMatch(/status "live" -> "beta"/);
      expect(enqueued).toEqual([]);
      expect((await db.doc('areas/vejle').get()).data()).toMatchObject({ status: 'beta', waitlistCount: 42 });
    });

    it('re-enqueues on a repeated live (idempotent task) and reports an existing task', async () => {
      await db.doc('areas/odense').set({ status: 'live', waitlistCount: 3 });
      enqueueResult = 'alreadyQueued';
      const r = await cli(['areas', 'set-status', 'odense', 'live', '--reason', 'retry the opening']);
      expect(r.code).toBe(EXIT_OK);
      expect(r.stdout).toMatch(/already "live"/);
      expect(r.stdout).toMatch(/already exists/);
      expect(enqueued).toEqual(['odense']);
      expect((await runs())[0]).toMatchObject({ outcome: 'unchanged' });
    });

    it('records a failed run when the enqueue fails, after the status change', async () => {
      const failing: CliDeps = { context: () => ({ ...ctx(), tasks: { openArea: async () => Promise.reject(new Error('PERMISSION_DENIED')) } }) };
      const r = await run(['areas', 'set-status', 'aalborg', 'live', '--project', PROJECT, '--reason', 'go live'], failing);
      expect(r.code).not.toBe(EXIT_OK);
      expect(r.stderr).toMatch(/PERMISSION_DENIED/);
      expect((await db.doc('areas/aalborg').get()).get('status')).toBe('live');
      expect((await runs())[0]).toMatchObject({ command: 'areas set-status', outcome: 'failed' });
    });

    it('list shows Firestore and areas.json status, the waitlist suppressed under 10, and sync keeps status and count', async () => {
      await db.doc('areas/aarhus').set({ status: 'live', waitlistCount: 251, label: { da: 'x', en: 'x' }, goal: { waitlist: 250 }, profile: 'alpha', configVersion: 1 });
      await db.doc('areas/vejle').set({ status: 'waitlist', waitlistCount: 4 });
      const list = await cli(['areas', 'list', '--reason', 'weekly look']);
      expect(list.code).toBe(EXIT_OK);
      expect(list.stdout).toMatch(/^aarhus\s+Aarhus\s+live\s+waitlist\s+251\s+250\s+alpha\s+1$/m);
      expect(list.stdout).toMatch(/^vejle\s+Vejle\s+waitlist\s+waitlist\s+<10/m);
      expect(list.stdout).toMatch(/^copenhagen\s+\S+\s+\(no doc\)/m);
      expect(list.stdout).toMatch(/aarhus is "live" in Firestore but "waitlist" in areas.json/);

      const sync = await cli(['areas', 'sync', '--reason', 'areas.json v2']);
      expect(sync.code).toBe(EXIT_OK);
      expect(sync.stdout).toMatch(/kept status "live"/);
      const aarhus = (await db.doc('areas/aarhus').get()).data()!;
      expect(aarhus).toMatchObject({ status: 'live', waitlistCount: 251, label: getLaunchArea('aarhus')!.label, goal: getLaunchArea('aarhus')!.goal });
      expect((await db.doc('areas/copenhagen').get()).data()).toMatchObject({ status: 'waitlist', waitlistCount: 0 });
      expect((await runs()).map((r) => r.command).sort()).toEqual(['areas list', 'areas sync']);
    });
  });

  describe('funnel show (§6.8)', () => {
    async function seed(): Promise<void> {
      const expiresAt = Timestamp.fromMillis(NOW + 1e10);
      await db.doc('funnel/aarhus_2026-W46').set({ areaId: 'aarhus', weekId: '2026-W46', counts: { signup: 120, onboarded: 7 }, sources: { friend: 30, press: 3 }, expiresAt });
      await db.doc('funnel/aarhus_2026-W40').set({ areaId: 'aarhus', weekId: '2026-W40', counts: { signup: 11 }, expiresAt });
      await db.doc('funnel/vejle_2026-W45').set({ areaId: 'vejle', weekId: '2026-W45', counts: { signup: 5 }, expiresAt });
    }

    it('reads funnel/* live, suppresses cells under 10 and filters by area and weeks', async () => {
      await seed();
      const all = await cli(['funnel', 'show', '--reason', 'weekly numbers']);
      expect(all.code).toBe(EXIT_OK);
      expect(all.stdout).toMatch(/^aarhus\s+2026-W40\s+11/m);
      expect(all.stdout).toMatch(/^aarhus\s+2026-W46\s+120\s+<10/m);
      expect(all.stdout).toMatch(/^vejle\s+2026-W45\s+<10/m);
      expect(all.stdout).toMatch(/^aarhus\s+2026-W46\s+0\s+0\s+0\s+0\s+30\s+0\s+<10\s+0$/m);
      expect(all.stdout).not.toMatch(/\s[1-9]\s/);

      const recent = await cli(['funnel', 'show', '--area', 'aarhus', '--weeks', '4', '--reason', 'weekly numbers']);
      expect(recent.stdout).toContain('2026-W46');
      expect(recent.stdout).not.toContain('2026-W40');
      expect(recent.stdout).not.toContain('vejle');
      expect((await runs())[0]).toMatchObject({ command: 'funnel show', reason: 'weekly numbers' });
    });

    it('fails on a malformed funnel doc instead of guessing', async () => {
      await db.doc('funnel/bad').set({ areaId: 'Bad Area', weekId: 'nope' });
      const r = await cli(['funnel', 'show', '--reason', 'weekly numbers']);
      expect(r.code).not.toBe(EXIT_OK);
      expect(r.stderr).toMatch(/not a funnel doc/);
    });
  });

  describe('sanctions (§3.7, A38)', () => {
    it('lists active sanctions, and lift moves until to now and records the reason', async () => {
      await db.doc('sanctions/u-paused').set({ type: 'pause', until: Timestamp.fromMillis(NOW + 7 * 864e5), reasonCode: 'reports', noticeId: 'n1' });
      await db.doc('sanctions/u-old').set({ type: 'suspension', until: Timestamp.fromMillis(NOW - 864e5), reasonCode: 'noShow', noticeId: 'n2' });
      const list = await cli(['sanctions', 'list', '--reason', 'check pauses']);
      expect(list.stdout).toMatch(/^u-paused\s+pause\s+2026-11-19T12:00:00.000Z\s+reports\s+active$/m);
      expect(list.stdout).not.toContain('u-old');
      expect((await cli(['sanctions', 'list', '--all', '--reason', 'check pauses'])).stdout).toContain('u-old');

      const lift = await cli(['sanctions', 'lift', 'u-paused', '--reason', 'reporter withdrew'], { env: {} });
      expect(lift.code).toBe(EXIT_OK);
      expect(lift.stdout).toMatch(/until moved from 2026-11-19T12:00:00.000Z to now/);
      const doc = (await db.doc('sanctions/u-paused').get()).data()!;
      expect((doc.until as Timestamp).toMillis()).toBe(NOW);
      expect(doc).toMatchObject({ type: 'pause', reasonCode: 'reports', noticeId: 'n1' });
      // adminRuns never holds the uid (12 months): without UID_HMAC_KEY no subject at all.
      const run1 = (await runs()).find((r) => r.command === 'sanctions lift')!;
      expect(run1).toMatchObject({ target: 'sanctions', reason: 'reporter withdrew', outcome: 'lifted' });
      expect(run1.subjectH).toBeUndefined();
      expect(JSON.stringify(run1)).not.toContain('u-paused');

      expect((await cli(['sanctions', 'lift', 'u-old', '--reason', 'tidy'])).stdout).toMatch(/already expired/);
      expect((await cli(['sanctions', 'lift', 'u-none', '--reason', 'tidy'])).stdout).toMatch(/no sanction/);
      expect((await db.doc('sanctions/u-none').get()).exists).toBe(false);
    });

    it('records a lift by uidH (subjectH, for redaction at erasure) with UID_HMAC_KEY, and refuses a reason naming the uid', async () => {
      await db.doc('sanctions/u-keyed').set({ type: 'pause', until: Timestamp.fromMillis(NOW + 864e5), reasonCode: 'reports', noticeId: 'n1' });
      const key = Buffer.alloc(32, 7).toString('base64');
      const h = await uidHash(nodeHmacSha256(new Uint8Array(Buffer.from(key, 'base64'))), 'u-keyed');
      expect((await cli(['sanctions', 'lift', 'u-keyed', '--reason', 'appeal for u-keyed'], { env: { UID_HMAC_KEY: key } })).code).toBe(EXIT_USAGE);
      expect((await cli(['sanctions', 'lift', 'u-keyed', '--reason', 'appeal upheld'], { env: { UID_HMAC_KEY: key } })).code).toBe(EXIT_OK);
      const r = (await runs()).find((x) => x.command === 'sanctions lift' && x.outcome === 'lifted')!;
      expect(r).toMatchObject({ target: `sanctions/${h}`, subjectH: h, reason: 'appeal upheld' });
      expect(JSON.stringify(await runs())).not.toContain('u-keyed');
    });
  });

  describe('reports list (read-only, §8.2)', () => {
    it('prints only the projection: never text, the message copy, uids or the pod', async () => {
      const base = { podId: 'PODIDPODIDPODIDPODID', status: 'open', expiresAt: Timestamp.fromMillis(NOW + 3e10) };
      await db.doc('reports/r1').set({
        ...base,
        reporterUid: 'reporter-secret-uid',
        targetUid: 'target-secret-uid',
        target: { type: 'message', messageId: 'm1' },
        message: { text: 'SECRET MESSAGE COPY' },
        category: 'harassment',
        text: 'SECRET REPORT TEXT',
        decision: 'autoPause',
        createdAt: Timestamp.fromMillis(NOW - 1000),
      });
      await db.doc('reports/r2').set({ ...base, reporterUid: 'a', targetUid: 'b', target: { type: 'user' }, category: 'noShow', createdAt: Timestamp.fromMillis(NOW - 5000), status: 'resolved' });
      const before = (await db.doc('reports/r1').get()).data();

      const r = await cli(['reports', 'list', '--reason', 'DSA transparency count']);
      expect(r.code).toBe(EXIT_OK);
      const lines = r.stdout.split('\n');
      expect(lines[2]).toMatch(/^r1\s+2026-11-12T11:59:59.000Z\s+harassment\s+message\s+open\s+autoPause\s+2027-/);
      expect(lines[3]).toMatch(/^r2\s+\S+\s+noShow\s+user\s+resolved\s+-/);
      for (const secret of ['SECRET', 'secret-uid', 'PODID', 'm1']) expect(r.stdout).not.toContain(secret);

      const open = await cli(['reports', 'list', '--status', 'open', '--category', 'harassment', '--limit', '5', '--reason', 'look']);
      expect(open.stdout).toContain('r1');
      expect(open.stdout).not.toContain('r2');
      expect((await db.doc('reports/r1').get()).data()).toEqual(before);
    });
  });

  describe('restore replay-ledger (§13)', () => {
    const uidH = 'aaaaaaaaaaaaaaaaaaaa';
    async function ledger(id: string, kind: string, atMs: number, extra: Record<string, unknown> = {}): Promise<void> {
      await db.doc(`erasureLedger/${id}`).set({ uidH, kind, at: Timestamp.fromMillis(atMs), expiresAt: Timestamp.fromMillis(atMs + 35 * 864e5), ...extra });
    }

    it('reads the live ledger, replays nothing without UID_HMAC_KEY, and exits non-zero', async () => {
      await ledger('l1', 'account', NOW - 3000);
      await ledger('l2', 'gender', NOW - 2000);
      const r = await cli(['restore', 'replay-ledger', '--database', RESTORED, '--since', new Date(NOW - 864e5).toISOString(), '--reason', 'staging restore drill']);
      expect(r.code).toBe(EXIT_INCOMPLETE);
      expect(r.stdout).toMatch(/^account\s+1\s+0\s+0\s+1$/m);
      expect(r.stdout).toMatch(/account: not available: UID_HMAC_KEY is not set.*\(purgeUser\)/);
      expect(r.stdout).toMatch(/gender: not available: UID_HMAC_KEY/);
      expect(r.stdout).toMatch(/Do NOT resume traffic/);
      expect((await runs())[0]).toMatchObject({ command: 'restore replay-ledger', target: RESTORED, outcome: 'incomplete', details: { source: '(default)', entries: 2, replayed: 0 } });
    });

    it('requires --since (the restore point): older entries are already in the restored copy', async () => {
      await ledger('l1', 'account', NOW - 3000);
      const r = await cli(['restore', 'replay-ledger', '--database', RESTORED, '--reason', 'staging restore drill'], { replayHandlers: { account: async () => 'replayed' } });
      expect(r.code).toBe(EXIT_USAGE);
      expect(r.stderr).toMatch(/--since <restore point> is required/);
      expect(await runs()).toEqual([]);
    });

    it('replays every entry since --since into the restored database, in order, through the handlers', async () => {
      await ledger('old', 'photo', NOW - 10 * 864e5, { ref: '3' });
      await ledger('b', 'block', NOW - 2000, { ref: 'bbbbbbbbbbbbbbbbbbbb' });
      await ledger('a', 'unblock', NOW - 1000, { ref: 'bbbbbbbbbbbbbbbbbbbb' });
      const seen: string[] = [];
      const handler: NonNullable<ReplayHandlers['block']> = async (entry, target) => {
        seen.push(`${entry.id}:${entry.kind}`);
        await target.doc(`replayed/${entry.id}`).set({ kind: entry.kind });
        return 'replayed';
      };
      const since = new Date(NOW - 864e5).toISOString();
      const r = await cli(['restore', 'replay-ledger', '--database', RESTORED, '--since', since, '--reason', 'staging restore drill'], { replayHandlers: { block: handler, unblock: handler } });
      expect(r.stderr).toBe('');
      expect(r.code).toBe(EXIT_OK);
      expect(seen).toEqual(['b:block', 'a:unblock']);
      expect((await restored.collection('replayed').get()).size).toBe(2);
      expect((await db.collection('replayed').get()).size).toBe(0);
      expect(r.stdout).toMatch(/every entry replayed/);
    });

    it('replays gender and account entries into the restored database with the server code (UID_HMAC_KEY set)', async () => {
      const key = Buffer.alloc(32, 7).toString('base64');
      const hmac = nodeHmacSha256(new Uint8Array(Buffer.from(key, 'base64')));
      const uid = 'replayUser000000000000000001';
      const other = 'replayUser000000000000000002';
      const h = await uidHash(hmac, uid);
      const at = Timestamp.fromMillis(NOW - 864e5);
      const user = (gender: 'woman' | null) => ({
        firstName: 'Ada', locale: 'en', birthYear: 1990, area: { gh5: 'u1zr2', label: '', areaId: null },
        prefs: { ageMin: 18, ageMax: 99, maxKm: 25, languages: ['en'], availability: 63, sameGenderOnly: gender !== null, openToAnyone: false },
        gender, participation: { mode: 'auto' }, photo: null, stats: { attended: 0, noShows: 0, lateCancels: 0 }, status: 'active', lastDrop: null,
        legal: { terms: 't1', privacy: 'p1', ...(gender ? { genderConsentAt: at } : {}) }, interestCount: 0, createdAt: at, lastActiveAt: at,
      });
      const profile = (gender: 'woman' | null, blockedH: string[] = []) => ({
        status: 'active', areaId: null, gh5: 'u1zr2', birthYear: 1990, ageMin: 18, ageMax: 99, maxKm: 25, sameGenderOnly: gender !== null, gender,
        languages: ['en'], availability: 63, themes: [], themeIds: [], secondary: [], blockedH, recentH: {}, recentMinUntil: null, reliability: 0.8,
        noShowEvents: [], waitingSinceWeek: '2026-W40', declinesInRow: 0, ignoredInRow: 0, activePods: 0, activeSensitivePods: 0, sensitiveProposals: [],
        sensitiveHold: null, weekClaim: null, lastDrop: null, attendedVerified: 0, founderInvited: false, openReportCount: 0, priority: false, openToAnyone: false,
        participation: { mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: null }, milestones: {}, createdAt: at, updatedAt: at,
      });
      // The restored copy still holds what was erased: the gender, then the whole account.
      await restored.doc(`users/${uid}`).set(user('woman'));
      await restored.doc(`matchProfiles/${uid}`).set(profile('woman'));
      await restored.doc(`users/${other}`).set(user(null));
      await restored.doc(`matchProfiles/${other}`).set(profile(null, [h]));
      await db.doc('erasureLedger/g1').set({ uidH: h, kind: 'gender', at: Timestamp.fromMillis(NOW - 3000), expiresAt: Timestamp.fromMillis(NOW + 864e5) });
      const { handlers, close } = await serverReplayHandlers(PROJECT, RESTORED, { UID_HMAC_KEY: key });
      const since = new Date(NOW - 864e5).toISOString();
      try {
        const r = await cli(['restore', 'replay-ledger', '--database', RESTORED, '--since', since, '--reason', 'staging restore drill'], { replayHandlers: handlers });
        expect(r.stderr).toBe('');
        expect(r.code).toBe(EXIT_OK);
        expect((await restored.doc(`users/${uid}`).get()).get('gender')).toBeNull();
        expect((await restored.doc('erasureLedger/g1').get()).get('kind')).toBe('gender');
        await db.doc('erasureLedger/a1').set({ uidH: h, kind: 'account', at: Timestamp.fromMillis(NOW - 2000), expiresAt: Timestamp.fromMillis(NOW + 864e5) });
        const again = await cli(['restore', 'replay-ledger', '--database', RESTORED, '--since', since, '--reason', 'staging restore drill'], { replayHandlers: handlers });
        expect(again.code).toBe(EXIT_OK);
        expect((await restored.doc(`users/${uid}`).get()).exists).toBe(false);
        expect((await restored.doc(`matchProfiles/${uid}`).get()).exists).toBe(false);
        expect((await restored.doc(`matchProfiles/${other}`).get()).get('blockedH')).toEqual([]);
        expect((await db.doc(`users/${uid}`).get()).exists).toBe(false);
      } finally {
        await close();
      }
    });

    it('refuses a malformed ledger entry and supports a dry run', async () => {
      await ledger('ok', 'block', NOW - 2000, { ref: 'bbbbbbbbbbbbbbbbbbbb' });
      await db.doc('erasureLedger/bad').set({ uidH: 'raw-uid-not-a-hash', kind: 'account', at: Timestamp.fromMillis(NOW - 1000) });
      const handlers: ReplayHandlers = { block: async () => 'replayed', account: async () => 'replayed' };
      const since = new Date(NOW - 864e5).toISOString();
      const r = await cli(['restore', 'replay-ledger', '--database', RESTORED, '--since', since, '--reason', 'drill'], { replayHandlers: handlers });
      expect(r.code).toBe(EXIT_INCOMPLETE);
      expect(r.stdout).toMatch(/malformed ledger entries .*bad/);
      const dry = await cli(['restore', 'replay-ledger', '--dry-run', '--since', since, '--reason', 'drill']);
      expect(dry.code).toBe(EXIT_OK);
      expect(dry.stdout).toMatch(/ledger is read from \(default\) itself/);
      expect(dry.stdout).toMatch(/dry run: nothing was replayed/);
    });
  });

  describe('createContext with the emulator environment', () => {
    it('reaches the emulator for a demo project and refuses the task queue without its emulator', async () => {
      const env = { FIRESTORE_EMULATOR_HOST: HOST, USER: 'tester' };
      const r = await run(['areas', 'set-status', 'copenhagen', 'live', '--project', PROJECT, '--reason', 'emulator check'], {
        context: (o) => createContext({ ...o, env }),
      });
      expect(r.code).toBe(EXIT_USAGE);
      expect(r.stderr).toMatch(/CLOUD_TASKS_EMULATOR_HOST is not set/);
      expect((await db.doc('areas/copenhagen').get()).get('status')).toBe('live');
      expect((await runs())[0]).toMatchObject({ actor: 'emulator:tester', outcome: 'failed' });
      const list = await run(['areas', 'list', '--project', PROJECT, '--reason', 'emulator check'], { context: (o) => createContext({ ...o, env }) });
      expect(list.code).toBe(EXIT_OK);
      expect(list.stdout).toMatch(/^copenhagen\s+\S+\s+live/m);
    });
  });
});
