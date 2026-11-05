/**
 * Admin commands (DESIGN.md §9 Admin access, §6.4, §6.8, §13 Backups). They run with ADC under a named admin's
 * identity against `--project`, and every run states `--reason`, which is recorded with the run (audit.ts). There is
 * no review command: nothing waits for a human (F17).
 */
import { readFileSync } from 'node:fs';
import { assertKnownFlags, intFlag, stringFlag, UsageError, type ParsedArgs } from './args';
import { formatAreas, formatSetStatus, formatSync, listAreas, parseAreaStatus, requireLaunchArea, setAreaStatus, syncAreas } from './areas';
import { recorded } from './audit';
import { checkDatabaseId, DEFAULT_DATABASE, type AdminContext } from './context';
import { firstWeekOf, formatFunnel, loadFunnel, parseFunnelExport, type FunnelFilter } from './funnel';
import { formatReplay, readLedger, replayLedger, type ReplayHandlers } from './replay';
import { formatReports, listReports, parseReportFilter } from './reports';
import { BAN_REFUSAL, formatLift, formatSanctions, liftSanction, listSanctions, requireUid } from './sanctions';

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
/** The command ran but did not finish its job (e.g. a ledger replay with kinds that cannot be replayed yet). */
export const EXIT_INCOMPLETE = 3;
/** The command is refused by design (e.g. `sanctions ban`). */
export const EXIT_REFUSED = 4;
export const EXIT_USAGE = 64;

export interface CommandOutput {
  readonly code: number;
  readonly stdout: string;
  readonly stderr?: string;
}

export interface CommandEnv {
  readonly args: ParsedArgs;
  /** Positional arguments after `<group> <name>`. */
  readonly operands: readonly string[];
  readonly reason: string;
  /** Opens the Firebase context for `--project` (only commands that need it call this). */
  context(): AdminContext;
  readonly replayHandlers: ReplayHandlers;
}

export interface AdminCommand {
  readonly group: string;
  readonly name: string;
  readonly usage: string;
  readonly summary: string;
  readonly design: string;
  /** Options besides --reason and --project. */
  readonly flags: readonly string[];
  /** Positional arguments after `<group> <name>`. */
  readonly arity: number;
  run(env: CommandEnv): Promise<CommandOutput>;
}

const ok = (stdout: string): CommandOutput => ({ code: EXIT_OK, stdout });

export const COMMANDS: readonly AdminCommand[] = [
  {
    group: 'areas',
    name: 'list',
    usage: 'areas list --project <id> --reason <text>',
    summary: 'Show every launch area: status in Firestore (what the server uses) and in areas.json, waitlist count against its goal, profile.',
    design: 'DESIGN.md §6.4 Launch areas',
    flags: [],
    arity: 0,
    async run({ context, reason }) {
      const ctx = context();
      const rows = await recorded(ctx, ctx.db(), { command: 'areas list', reason }, async () => ({ value: await listAreas(ctx.db()), outcome: 'read' }));
      return ok(formatAreas(rows));
    },
  },
  {
    group: 'areas',
    name: 'set-status',
    usage: 'areas set-status <areaId> <waitlist|beta|live> --project <id> --reason <text>',
    summary:
      'Change a launch area status ("Aarhus live, Copenhagen waitlist" is a config change). Going live also enqueues the openArea task (id open-{areaId}): everyone in the area becomes eligible and gets "<city> is open — your first drop is Thursday 18:00".',
    design: 'DESIGN.md §6.4, Q11, §10.3 openArea',
    flags: ['--task-service-account'],
    arity: 2,
    async run({ operands, context, reason }) {
      const [areaId, statusArg] = operands;
      requireLaunchArea(areaId);
      const status = parseAreaStatus(statusArg);
      return ok(formatSetStatus(await setAreaStatus(context(), areaId!, status, reason)));
    },
  },
  {
    group: 'areas',
    name: 'sync',
    usage: 'areas sync --project <id> --reason <text>',
    summary: 'Mirror packages/core/src/geo/areas.json to areas/{areaId} (label, profile, goal, config version); creates missing docs; never changes an existing status or count.',
    design: 'DESIGN.md §6.4 Launch areas',
    flags: [],
    arity: 0,
    async run({ context, reason }) {
      return ok(formatSync(await syncAreas(context(), reason)));
    },
  },
  {
    group: 'funnel',
    name: 'show',
    usage: 'funnel show [--area <areaId>] [--weeks <n>] (--project <id> | --from <funnel-export.json>) --reason <text>',
    summary: 'Print the day-1 funnel and the "where did you hear" sources per launch area and ISO week (funnel/{areaId}_{weekId}), every cell under 10 as "<10". Live from Firestore, or from an export.',
    design: 'DESIGN.md §6.8 Funnel',
    flags: ['--area', '--weeks', '--from'],
    arity: 0,
    async run({ args, context, reason }) {
      const from = stringFlag(args, '--from');
      if (from && args.flags.has('--project')) throw new UsageError('give --project or --from, not both');
      const weeks = intFlag(args, '--weeks', { min: 1, max: 104 });
      const area = stringFlag(args, '--area');
      const filter = (now: number): FunnelFilter => ({
        ...(area === undefined ? {} : { areaId: area }),
        ...(weeks === undefined ? {} : { sinceWeek: firstWeekOf(weeks, now) }),
      });
      if (from) {
        let json: unknown;
        try {
          json = JSON.parse(readFileSync(from, 'utf8'));
        } catch (err) {
          throw new UsageError(`cannot read ${from}: ${(err as Error).message}`);
        }
        let rows;
        try {
          rows = parseFunnelExport(json);
        } catch (err) {
          throw new UsageError((err as Error).message);
        }
        return ok(formatFunnel(rows, filter(Date.now())));
      }
      const ctx = context();
      const rows = await recorded(ctx, ctx.db(), { command: 'funnel show', ...(area === undefined ? {} : { target: area }), reason }, async () => ({
        value: await loadFunnel(ctx.db()),
        outcome: 'read',
      }));
      return ok(formatFunnel(rows, filter(ctx.now())));
    },
  },
  {
    group: 'sanctions',
    name: 'list',
    usage: 'sanctions list [--all] --project <id> --reason <text>',
    summary: 'List automated sanctions (type, until, reason code); expired ones, which the hourly sweeper lifts, only with --all.',
    design: 'DESIGN.md §3.7, §8.2 sanctions, A38',
    flags: ['--all'],
    arity: 0,
    async run({ args, context, reason }) {
      const ctx = context();
      const rows = await recorded(ctx, ctx.db(), { command: 'sanctions list', reason }, async () => ({
        value: await listSanctions(ctx.db(), ctx.now(), { includeExpired: args.flags.has('--all') }),
        outcome: 'read',
      }));
      return ok(formatSanctions(rows));
    },
  },
  {
    group: 'sanctions',
    name: 'lift',
    usage: 'sanctions lift <uid> --project <id> --reason <text>',
    summary: 'End a sanction early: moves its `until` to now, so the hourly sweeper lifts it through its normal expiry path. Never creates or lengthens one.',
    design: 'DESIGN.md §3.7, §10.3 hourlySweeper, F17',
    flags: [],
    arity: 1,
    async run({ operands, context, reason }) {
      const uid = requireUid(operands[0]);
      return ok(formatLift(uid, await liftSanction(context(), uid, reason)));
    },
  },
  {
    group: 'sanctions',
    name: 'ban',
    usage: 'sanctions ban <uid> --project <id> --reason <text>',
    summary: 'Refused: the MVP writes no bans (a ban needs a human decision; F17/D2).',
    design: 'DESIGN.md §8.2 bans, PRIVACY.md §6',
    flags: [],
    arity: 1,
    async run() {
      return { code: EXIT_REFUSED, stdout: '', stderr: BAN_REFUSAL };
    },
  },
  {
    group: 'reports',
    name: 'list',
    usage: 'reports list [--status open|resolved] [--category <category>] [--limit <n>] --project <id> --reason <text>',
    summary: 'Read-only list of reports: id, date, category, target type, status, automated decision, expiry. Never the report text, the copied message, uids or the pod.',
    design: 'DESIGN.md §3.7, §8.2 reports, PRIVACY.md R20',
    flags: ['--status', '--category', '--limit'],
    arity: 0,
    async run({ args, context, reason }) {
      const filter = parseReportFilter(stringFlag(args, '--status'), stringFlag(args, '--category'), intFlag(args, '--limit', { min: 1, max: 1000 }));
      const ctx = context();
      const rows = await recorded(ctx, ctx.db(), { command: 'reports list', reason }, async () => ({ value: await listReports(ctx.db(), filter), outcome: 'read' }));
      return ok(formatReports(rows));
    },
  },
  {
    group: 'restore',
    name: 'replay-ledger',
    usage:
      'restore replay-ledger --project <id> [--database <restored-db>] [--ledger-database <live-db>] [--since <iso-datetime>] [--dry-run] --reason <text>',
    summary:
      'After a PITR/backup restore, replay every erasureLedger entry (read from the live database) into the restored database with the original server code, before traffic resumes. All or nothing: exits 3 if any kind cannot be replayed.',
    design: 'DESIGN.md §13 Backups, PRIVACY.md §5',
    flags: ['--database', '--ledger-database', '--since', '--dry-run'],
    arity: 0,
    async run({ args, context, reason, replayHandlers }) {
      const target = checkDatabaseId(stringFlag(args, '--database') ?? DEFAULT_DATABASE);
      const source = checkDatabaseId(stringFlag(args, '--ledger-database') ?? DEFAULT_DATABASE);
      const sinceArg = stringFlag(args, '--since');
      const sinceMs = sinceArg === undefined ? undefined : Date.parse(sinceArg);
      if (sinceMs !== undefined && !Number.isFinite(sinceMs)) throw new UsageError('--since must be an ISO date-time');
      const dryRun = args.flags.has('--dry-run');
      const ctx = context();
      const summary = await recorded(ctx, ctx.db(), { command: 'restore replay-ledger', target, reason }, async () => {
        const s = await replayLedger(await readLedger(ctx.db(source), sinceMs), ctx.db(target), replayHandlers, { dryRun });
        const counts = Object.values(s.byKind).reduce((n, k) => ({ entries: n.entries + k.entries, replayed: n.replayed + k.replayed + k.nothingToDo }), { entries: 0, replayed: 0 });
        return { value: s, outcome: s.complete ? 'complete' : dryRun ? 'dryRun' : 'incomplete', details: { source, ...counts } };
      });
      const lines = [formatReplay(summary, { source, target })];
      if (source === target) lines.unshift(`note: the ledger is read from ${target} itself; after a restore it ends at the restore point. Use --ledger-database for the live copy.`);
      return { code: summary.complete || dryRun ? EXIT_OK : EXIT_INCOMPLETE, stdout: lines.join('\n') };
    },
  },
];

export function findCommand(group: string | undefined, name: string | undefined): AdminCommand | undefined {
  return COMMANDS.find((c) => c.group === group && c.name === name);
}

/** Checks a command's options and positional count before anything connects to Firebase. */
export function checkUsage(command: AdminCommand, args: ParsedArgs): void {
  assertKnownFlags(args, ['--reason', '--project', ...command.flags]);
  const extra = args.positionals.length - 2;
  if (extra !== command.arity) throw new UsageError(`expected ${command.arity} argument(s), got ${extra}`);
}
