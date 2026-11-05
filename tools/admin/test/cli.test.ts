import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { parseArgs, UsageError } from '../src/args';
import { EXIT_REFUSED, EXIT_USAGE, run } from '../src/cli';
import { COMMANDS } from '../src/commands';
import { checkProject, FUNCTIONS_REGION, taskEnqueuer, type AdminContext } from '../src/context';
import { firstWeekOf, formatFunnel, parseFunnelExport } from '../src/funnel';
import { formatReplay, replayLedger, UNAVAILABLE, type LedgerEntry } from '../src/replay';

/** A context that fails the test if a command reaches Firebase. */
const noFirebase = (): AdminContext => {
  throw new Error('this command must not open Firebase');
};

describe('admin CLI', () => {
  it('lists every command in --help, and no review command (F17)', async () => {
    const r = await run(['--help']);
    expect(r.code).toBe(0);
    for (const c of COMMANDS) expect(r.stdout).toContain(c.usage);
    for (const [group, name] of [
      ['areas', 'list'],
      ['areas', 'set-status'],
      ['funnel', 'show'],
      ['sanctions', 'list'],
      ['sanctions', 'lift'],
      ['reports', 'list'],
      ['restore', 'replay-ledger'],
    ]) {
      expect(COMMANDS.some((c) => c.group === group && c.name === name)).toBe(true);
    }
    expect(COMMANDS.some((c) => c.group === 'review')).toBe(false);
  });

  it('requires a reason, known options and the right arguments before touching Firebase', async () => {
    const deps = { context: noFirebase };
    expect((await run(['areas', 'set-status', 'aarhus', 'live', '--project', 'demo-grouper'], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['areas', 'set-status', 'aarhus', 'live', '--reason'], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['areas', 'set-status', 'aarhus', 'live', '--reason', '  '], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['areas', 'set-status', 'aarhus', '--reason', 'go live'], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['areas', 'set-status', 'aarhus', 'open', '--reason', 'go live'], deps)).stderr).toMatch(/status must be one of waitlist, beta, live/);
    expect((await run(['areas', 'set-status', 'atlantis', 'live', '--reason', 'go live'], deps)).stderr).toMatch(/unknown launch area atlantis/);
    expect((await run(['areas', 'list', '--reason', 'look', '--force', 'yes'], deps)).stderr).toMatch(/unknown option --force/);
    expect((await run(['sanctions', 'lift', '--reason', 'appeal'], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['reports', 'list', '--status', 'pending', '--reason', 'look'], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['restore', 'replay-ledger', '--since', 'yesterday', '--reason', 'drill'], deps)).code).toBe(EXIT_USAGE);
    expect((await run(['review', 'list', '--reason', 'x'])).code).toBe(EXIT_USAGE);
    expect((await run(['drop', 'everything'])).code).toBe(EXIT_USAGE);
  });

  it('refuses sanctions ban without writing anything (no bans in the MVP, D2)', async () => {
    const r = await run(['sanctions', 'ban', 'u1', '--project', 'grouper-prod', '--reason', 'harassment'], { context: noFirebase });
    expect(r.code).toBe(EXIT_REFUSED);
    expect(r.stderr).toMatch(/refused/);
  });

  it('parses flags strictly', () => {
    expect(parseArgs(['a', '--dry-run', '--since', 'x']).flags.get('--dry-run')).toBe(true);
    expect(() => parseArgs(['--since'])).toThrow(UsageError);
    expect(() => parseArgs(['--since', '--dry-run'])).toThrow(UsageError);
    expect(() => parseArgs(['--reason', 'a', '--reason', 'b'])).toThrow(UsageError);
  });
});

describe('project and emulator selection', () => {
  it('pairs demo-* projects with the emulator and real projects with ADC', () => {
    expect(checkProject('grouper-prod', {})).toEqual({ project: 'grouper-prod', emulator: false });
    expect(checkProject('demo-grouper', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toEqual({ project: 'demo-grouper', emulator: true });
    expect(() => checkProject(undefined, {})).toThrow(/--project/);
    expect(() => checkProject('demo-grouper', {})).toThrow(/FIRESTORE_EMULATOR_HOST/);
    expect(() => checkProject('grouper-prod', { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(/demo-\*/);
    expect(() => checkProject('Grouper Prod', {})).toThrow(/not a Firebase project id/);
  });
});

describe('openArea enqueue (§10.3)', () => {
  it('enqueues on the europe-west1 openArea queue with id open-{areaId} and a 1,800 s deadline', async () => {
    const calls: { name: string; data: unknown; opts: unknown }[] = [];
    const tasks = taskEnqueuer((name) => ({ enqueue: async (data, opts) => void calls.push({ name, data, opts }) }));
    expect(await tasks.openArea('aarhus')).toBe('enqueued');
    expect(calls).toEqual([{ name: `locations/${FUNCTIONS_REGION}/functions/openArea`, data: { areaId: 'aarhus' }, opts: { id: 'open-aarhus', dispatchDeadlineSeconds: 1800 } }]);
    expect(FUNCTIONS_REGION).toBe('europe-west1');
  });

  it('treats an existing task as already queued (openArea is idempotent) and rethrows other errors', async () => {
    const exists = taskEnqueuer(() => ({ enqueue: async () => Promise.reject(Object.assign(new Error('exists'), { code: 'functions/task-already-exists' })) }));
    expect(await exists.openArea('vejle')).toBe('alreadyQueued');
    const denied = taskEnqueuer(() => ({ enqueue: async () => Promise.reject(Object.assign(new Error('denied'), { code: 'functions/permission-denied' })) }));
    await expect(denied.openArea('vejle')).rejects.toThrow('denied');
    await expect(denied.openArea('Not An Area')).rejects.toThrow();
  });
});

describe('restore replay-ledger dispatcher (§13)', () => {
  const target = {} as Firestore;
  const entries: LedgerEntry[] = [
    { id: 'e3', uidH: 'aaaaaaaaaaaaaaaaaaaa', kind: 'unblock', ref: 'bbbbbbbbbbbbbbbbbbbb', atMs: 3000 },
    { id: 'e1', uidH: 'aaaaaaaaaaaaaaaaaaaa', kind: 'block', ref: 'bbbbbbbbbbbbbbbbbbbb', atMs: 1000 },
    { id: 'e2', uidH: 'cccccccccccccccccccc', kind: 'account', atMs: 2000 },
  ];

  it('replays nothing while any kind present has no replay path, and says why per kind', async () => {
    const seen: string[] = [];
    const s = await replayLedger({ entries, invalid: [] }, target, { block: async (e) => (seen.push(e.id), 'replayed') });
    expect(seen).toEqual([]);
    expect(s.complete).toBe(false);
    expect(s.unavailable.map((u) => u.kind)).toEqual(['account', 'unblock']);
    const out = formatReplay(s, { source: '(default)', target: 'restored' });
    expect(out).toContain(`account: ${UNAVAILABLE.account}`);
    expect(out).toMatch(/Do NOT resume traffic/);
    for (const reason of Object.values(UNAVAILABLE)) expect(reason).toMatch(/^not available: UID_HMAC_KEY is not set/);
  });

  it('with no handlers at all (no UID_HMAC_KEY), every kind is reported as not available', async () => {
    const s = await replayLedger({ entries, invalid: [] }, target);
    expect(s.unavailable).toHaveLength(3);
    expect(s.byKind.block).toEqual({ entries: 1, replayed: 0, nothingToDo: 0, notRun: 1 });
  });

  it('replays in ledger order once every kind has a handler, and stops at the first failure', async () => {
    const seen: string[] = [];
    const handler = async (e: LedgerEntry) => (seen.push(e.id), e.kind === 'account' ? ('nothingToDo' as const) : ('replayed' as const));
    const s = await replayLedger({ entries, invalid: [] }, target, { block: handler, unblock: handler, account: handler });
    expect(seen).toEqual(['e1', 'e2', 'e3']);
    expect(s.complete).toBe(true);
    expect(s.byKind.account).toEqual({ entries: 1, replayed: 0, nothingToDo: 1, notRun: 0 });

    const failing = await replayLedger({ entries, invalid: [] }, target, {
      block: handler,
      unblock: handler,
      account: async () => Promise.reject(new Error('purge failed')),
    });
    expect(failing.complete).toBe(false);
    expect(failing.failure).toMatchObject({ entryId: 'e2', kind: 'account' });
    expect(failing.byKind.unblock.notRun).toBe(1);
  });

  it('refuses to replay a ledger with malformed entries, and replays nothing on a dry run', async () => {
    const all = { block: async () => 'replayed' as const, unblock: async () => 'replayed' as const, account: async () => 'replayed' as const };
    expect((await replayLedger({ entries, invalid: ['bad1'] }, target, all)).complete).toBe(false);
    const dry = await replayLedger({ entries, invalid: [] }, target, all, { dryRun: true });
    expect(dry.complete).toBe(false);
    expect(dry.byKind.block.notRun).toBe(1);
    expect(formatReplay(dry, { source: 'a', target: 'b' })).toMatch(/dry run/);
  });
});

describe('funnel show (§6.8)', () => {
  const rows = [
    { areaId: 'vejle', weekId: '2026-W45', counts: { signup: 40, onboarded: 31, waitlisted: 9, firstDropEligible: 0 }, sources: { friend: 12, press: 2 }, expiresAt: {} },
    { areaId: 'aarhus', weekId: '2026-W46', counts: { signup: 10, onboarded: 1 }, expiresAt: {} },
    { areaId: 'aarhus', weekId: '2026-W45', counts: { signup: 250, onboarded: 200, waitlisted: 199 }, sources: { dadsGroup: 15 }, expiresAt: {} },
  ];

  it('prints one row per area and week, sorted, with every cell under 10 suppressed', () => {
    const out = formatFunnel(parseFunnelExport(rows));
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^area\s+week\s+signup\s+onboarded\s+waitlisted\s+firstDropEligible\s+firstProposal\s+firstConfirmed\s+firstMeetupHappened\s+secondMeetup$/);
    expect(lines[2]).toMatch(/^aarhus\s+2026-W45\s+250\s+200\s+199\s+0/);
    expect(lines[3]).toMatch(/^aarhus\s+2026-W46\s+10\s+<10\s+0/);
    expect(lines[4]).toMatch(/^vejle\s+2026-W45\s+40\s+31\s+<10\s+0/);
    expect(out).toContain('Where did you hear about Grouper?');
    expect(out).toMatch(/vejle\s+2026-W45\s+0\s+0\s+0\s+0\s+12\s+0\s+<10\s+0/);
    for (const n of [' 1 ', ' 2 ', ' 9 ']) expect(` ${out.replaceAll('\n', ' ')} `).not.toContain(n);
  });

  it('filters by area and by the last N weeks, and refuses rows that are not funnel docs', () => {
    expect(formatFunnel(parseFunnelExport(rows), { areaId: 'vejle' })).not.toContain('aarhus');
    // 2026-11-12 is in 2026-W46: the last 1 week is W46 only.
    const since = firstWeekOf(1, Date.parse('2026-11-12T12:00:00Z'));
    expect(since).toBe('2026-W46');
    const recent = formatFunnel(parseFunnelExport(rows), { sinceWeek: since });
    expect(recent).toContain('2026-W46');
    expect(recent).not.toContain('2026-W45');
    expect(firstWeekOf(2, Date.parse('2026-11-12T12:00:00Z'))).toBe('2026-W45');
    expect(formatFunnel([], {})).toBe('no funnel rows');
    expect(() => parseFunnelExport([{ areaId: 'Vejle!', weekId: '2026-W45' }])).toThrow();
    expect(parseFunnelExport({ 'vejle_2026-W45': rows[0] })).toHaveLength(1);
  });

  it('runs from an exported file without Firebase and requires --reason', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'funnel-')), 'export.json');
    writeFileSync(file, JSON.stringify(rows));
    const r = await run(['funnel', 'show', '--from', file, '--reason', 'weekly review'], { context: noFirebase });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('vejle');
    expect((await run(['funnel', 'show', '--from', file])).code).toBe(EXIT_USAGE);
    expect((await run(['funnel', 'show', '--from', join(file, 'missing'), '--reason', 'xyz'])).code).toBe(EXIT_USAGE);
    expect((await run(['funnel', 'show', '--from', file, '--project', 'grouper-prod', '--reason', 'xyz'])).code).toBe(EXIT_USAGE);
    expect((await run(['funnel', 'show', '--from', file, '--weeks', '0', '--reason', 'xyz'])).code).toBe(EXIT_USAGE);
  });
});
