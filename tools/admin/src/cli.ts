/**
 *   npm -w tools/admin run admin -- <group> <command> [args] --project <id> --reason <text>
 *
 * Admin CLI (DESIGN.md §9 Admin access, §13 Backups). Runs with Application Default Credentials against `--project`,
 * or against the emulators when FIRESTORE_EMULATOR_HOST is set (with a demo-* project). Every run states --reason,
 * which is recorded with it.
 */
import { pathToFileURL } from 'node:url';
import { parseArgs, stringFlag, UsageError } from './args';
import { checkUsage, COMMANDS, EXIT_ERROR, EXIT_USAGE, findCommand } from './commands';
import { createContext, type AdminContext, type ContextOptions } from './context';
import type { ReplayHandlers } from './replay';

export { EXIT_ERROR, EXIT_INCOMPLETE, EXIT_OK, EXIT_REFUSED, EXIT_USAGE } from './commands';

export interface CliResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CliDeps {
  /** Opens the Firebase context; tests pass the emulator and a fake task enqueuer. */
  readonly context?: (options: ContextOptions) => AdminContext;
  readonly replayHandlers?: ReplayHandlers;
  /** Environment for UID_HMAC_KEY (tests); process.env otherwise. */
  readonly env?: NodeJS.ProcessEnv;
}

const REASON_MIN = 3;
const REASON_MAX = 500;

function help(): string {
  const rows = COMMANDS.map((c) => `  ${c.usage}\n      ${c.summary}`);
  return [
    'friendpod-admin: Friendpod admin CLI (DESIGN.md §9 Admin access)',
    '',
    'Commands:',
    ...rows,
    '',
    'Credentials: Application Default Credentials (gcloud auth application-default login); --project names the project.',
    'Emulators: set FIRESTORE_EMULATOR_HOST (and CLOUD_TASKS_EMULATOR_HOST for task enqueues) and use a demo-* project.',
    'Every run must state --reason; it is recorded with the run (adminRuns).',
  ].join('\n');
}

export async function run(argv: readonly string[], deps: CliDeps = {}): Promise<CliResult> {
  const [group, name] = argv;
  if (!group || group === '--help' || group === '-h' || group === 'help') return { code: 0, stdout: help(), stderr: '' };
  const command = findCommand(group, name);
  if (!command) return { code: EXIT_USAGE, stdout: '', stderr: `unknown command: ${[group, name].filter(Boolean).join(' ')}\n\n${help()}` };
  const label = `${group} ${name}`;

  let opened: AdminContext | undefined;
  try {
    const args = parseArgs(argv);
    if (args.flags.has('--help')) return { code: 0, stdout: `usage: ${command.usage}\n  ${command.summary}`, stderr: '' };
    const reason = stringFlag(args, '--reason')?.trim();
    if (!reason) throw new UsageError('--reason <text> is required (DESIGN.md §9)');
    if (reason.length < REASON_MIN || reason.length > REASON_MAX) throw new UsageError(`--reason must be ${REASON_MIN}–${REASON_MAX} characters`);
    checkUsage(command, args);
    const open = deps.context ?? createContext;
    const out = await command.run({
      args,
      operands: args.positionals.slice(2),
      reason,
      ...(deps.replayHandlers ? { replayHandlers: deps.replayHandlers } : {}),
      ...(deps.env ? { env: deps.env } : {}),
      context: () => (opened ??= open({ project: stringFlag(args, '--project'), taskServiceAccount: stringFlag(args, '--task-service-account') })),
    });
    return { code: out.code, stdout: out.stdout, stderr: out.stderr ?? '' };
  } catch (err) {
    if (err instanceof UsageError) return { code: EXIT_USAGE, stdout: '', stderr: `${label}: ${err.message}\nusage: ${command.usage}` };
    return { code: EXIT_ERROR, stdout: '', stderr: `${label}: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await opened?.close().catch(() => undefined);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await run(process.argv.slice(2));
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exitCode = result.code;
}
