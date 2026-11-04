import { describe, expect, it } from 'vitest';
import { EXIT_NOT_IMPLEMENTED, EXIT_USAGE, run } from '../src/cli';
import { COMMANDS } from '../src/commands';

describe('admin CLI skeleton', () => {
  it('lists every command in --help', () => {
    const r = run(['--help']);
    expect(r.code).toBe(0);
    for (const c of COMMANDS) expect(r.stdout).toContain(c.usage);
    for (const group of ['areas', 'restore']) expect(COMMANDS.some((c) => c.group === group)).toBe(true);
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
