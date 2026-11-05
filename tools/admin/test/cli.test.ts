import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXIT_NOT_IMPLEMENTED, EXIT_USAGE, run } from '../src/cli';
import { COMMANDS } from '../src/commands';
import { formatFunnel, parseFunnelExport } from '../src/funnel';

describe('admin CLI skeleton', () => {
  it('lists every command in --help', () => {
    const r = run(['--help']);
    expect(r.code).toBe(0);
    for (const c of COMMANDS) expect(r.stdout).toContain(c.usage);
    for (const group of ['areas', 'restore', 'funnel']) expect(COMMANDS.some((c) => c.group === group)).toBe(true);
    // No human review or sanctions since F17 (D2).
    for (const group of ['review', 'sanctions']) expect(COMMANDS.some((c) => c.group === group)).toBe(false);
  });

  it('answers "not implemented" for every command, pointing at the design', () => {
    for (const c of COMMANDS) {
      const r = run([c.group, c.name, 'x', '--reason', 'test']);
      expect(r.code).toBe(EXIT_NOT_IMPLEMENTED);
      expect(r.stderr).toMatch(/not implemented \(see DESIGN\.md/);
    }
  });

  it('requires a reason for state-changing commands and rejects unknown ones', () => {
    expect(run(['areas', 'set-status', 'aarhus', 'live']).code).toBe(EXIT_USAGE);
    expect(run(['restore', 'replay-ledger', '--reason']).code).toBe(EXIT_USAGE);
    expect(run(['review', 'list']).code).toBe(EXIT_USAGE);
    expect(run(['drop', 'everything']).code).toBe(EXIT_USAGE);
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

  it('filters by area and refuses rows that are not funnel docs', () => {
    expect(formatFunnel(parseFunnelExport(rows), { areaId: 'vejle' })).not.toContain('aarhus');
    expect(formatFunnel([], {})).toBe('no funnel rows');
    expect(() => parseFunnelExport([{ areaId: 'Vejle!', weekId: '2026-W45' }])).toThrow();
    expect(parseFunnelExport({ 'vejle_2026-W45': rows[0] })).toHaveLength(1);
  });

  it('runs from an exported file and requires --reason', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'funnel-')), 'export.json');
    writeFileSync(file, JSON.stringify(rows));
    const r = run(['funnel', 'show', '--from', file, '--reason', 'weekly review']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('vejle');
    expect(run(['funnel', 'show', '--from', file]).code).toBe(EXIT_USAGE);
    expect(run(['funnel', 'show', '--from', join(file, 'missing'), '--reason', 'x']).code).toBe(EXIT_USAGE);
  });
});
