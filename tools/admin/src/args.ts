/** Argument parsing for the admin CLI: positionals plus `--flag value` and boolean `--flag` options. */
export class UsageError extends Error {}

/** Flags that take no value. Every other `--flag` needs one. */
const BOOLEAN_FLAGS = new Set(['--dry-run', '--all', '--help']);

export interface ParsedArgs {
  readonly positionals: readonly string[];
  readonly flags: ReadonlyMap<string, string | true>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    if (flags.has(token)) throw new UsageError(`${token} given twice`);
    if (BOOLEAN_FLAGS.has(token)) {
      flags.set(token, true);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--') || value.trim() === '') throw new UsageError(`${token} needs a value`);
    flags.set(token, value);
    i++;
  }
  return { positionals, flags };
}

export function stringFlag(args: ParsedArgs, flag: string): string | undefined {
  const v = args.flags.get(flag);
  return typeof v === 'string' ? v : undefined;
}

export function intFlag(args: ParsedArgs, flag: string, { min, max }: { min: number; max: number }): number | undefined {
  const v = stringFlag(args, flag);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new UsageError(`${flag} must be an integer from ${min} to ${max}`);
  return n;
}

/** Refuses flags a command does not know, so a typo never silently widens or narrows what it does. */
export function assertKnownFlags(args: ParsedArgs, allowed: readonly string[]): void {
  for (const flag of args.flags.keys()) {
    if (!allowed.includes(flag)) throw new UsageError(`unknown option ${flag}`);
  }
}
