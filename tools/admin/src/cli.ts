/**
 *   npm -w tools/admin run admin -- <group> <command> [args] --reason <text>
 * Every command is a stub until M1 and exits with code 2 ("not implemented"), except `funnel show --from <file>`,
 * which prints an exported funnel with small-count suppression.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { COMMANDS, findCommand } from './commands';
import { formatFunnel, parseFunnelExport } from './funnel';

export interface CliResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export const EXIT_NOT_IMPLEMENTED = 2;
export const EXIT_USAGE = 64;

function help(): string {
  const rows = COMMANDS.map((c) => `  ${c.usage}\n      ${c.summary}`);
  return ['grouper-admin: Grouper admin CLI (stub; DESIGN.md §9 Admin access)', '', 'Commands:', ...rows, '', 'Every run must state --reason; it is recorded with the action.'].join('\n');
}

export function run(argv: readonly string[]): CliResult {
  const [group, name] = argv;
  if (!group || group === '--help' || group === '-h' || group === 'help') return { code: 0, stdout: help(), stderr: '' };
  const command = findCommand(group, name);
  if (!command) return { code: EXIT_USAGE, stdout: '', stderr: `unknown command: ${[group, name].filter(Boolean).join(' ')}\n\n${help()}` };
  const reasonAt = argv.indexOf('--reason');
  if (reasonAt < 0 || !argv[reasonAt + 1]) {
    return { code: EXIT_USAGE, stdout: '', stderr: `${group} ${name}: --reason <text> is required (DESIGN.md §9)\nusage: ${command.usage}` };
  }
  if (group === 'funnel' && name === 'show') {
    const from = option(argv, '--from');
    if (from) {
      try {
        const area = option(argv, '--area');
        return { code: 0, stdout: formatFunnel(parseFunnelExport(JSON.parse(readFileSync(from, 'utf8'))), area ? { areaId: area } : {}), stderr: '' };
      } catch (err) {
        return { code: EXIT_USAGE, stdout: '', stderr: `funnel show: ${(err as Error).message}` };
      }
    }
    // TODO(M1): read funnel/* with ADC once the CLI has its Firebase dependency.
  }
  return { code: EXIT_NOT_IMPLEMENTED, stdout: '', stderr: `${group} ${name}: not implemented (see ${command.design})` };
}

function option(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = run(process.argv.slice(2));
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exitCode = result.code;
}
