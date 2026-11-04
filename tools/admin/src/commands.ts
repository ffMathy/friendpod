/**
 * Admin commands (DESIGN.md §9 Admin access, §13 Backups, §14). Until M1 they only describe themselves:
 * no Firebase dependency yet. When implemented they run with ADC under a named admin's identity and
 * record `--reason` for every run.
 */
export interface AdminCommand {
  readonly group: string;
  readonly name: string;
  readonly usage: string;
  readonly summary: string;
  readonly design: string;
}

export const COMMANDS: readonly AdminCommand[] = [
  {
    group: 'review',
    name: 'list',
    usage: 'review list [--kind tagSensitivity|conceptMerge|abuseHold|report|sensitiveAnomaly]',
    summary: 'List open review-queue items (tag wording without uid; report and anomaly items with uid).',
    design: 'DESIGN.md §5.2 (5) Review queue, §8.2 reviewQueue',
  },
  {
    group: 'review',
    name: 'decide',
    usage: 'review decide <id> --decision <sensitive|not|merge|split|uphold|dismiss> --reason <text>',
    summary: 'Record a human decision; "not sensitive" applies to future adds only.',
    design: 'DESIGN.md §5.2 (5) Review queue, PRIVACY.md §4.3',
  },
  {
    group: 'review',
    name: 'seed',
    usage: 'review seed --file <tags.txt> --reason <text>',
    summary: 'Pre-launch seed review of ~1,000 common da/en hobby tags; decisions become pinned tags.',
    design: 'DESIGN.md §5.2 Mitigations',
  },
  {
    group: 'sanctions',
    name: 'list',
    usage: 'sanctions list [--uid <uid>]',
    summary: 'List pauses, suspensions and bans with their statement-of-reasons notices.',
    design: 'DESIGN.md §3.7, §8.2 sanctions',
  },
  {
    group: 'sanctions',
    name: 'apply',
    usage: 'sanctions apply <uid> --type <pause|suspension|ban> [--until <iso-date>] --reason-code <CODE> --reason <text>',
    summary: 'Apply a human-decided sanction and write the statement of reasons (DSA Art. 17).',
    design: 'DESIGN.md §3.7, PRIVACY.md §4.4, §13',
  },
  {
    group: 'sanctions',
    name: 'lift',
    usage: 'sanctions lift <uid> --reason <text>',
    summary: 'Lift a sanction or an automated pause after human review.',
    design: 'DESIGN.md §3.7',
  },
  {
    group: 'areas',
    name: 'sync',
    usage: 'areas sync --project <staging|prod> --reason <text>',
    summary: 'Mirror packages/core/src/geo/areas.json to areas/{areaId} (labels, cells, status, goal, profile).',
    design: 'DESIGN.md §6.4 Launch areas',
  },
  {
    group: 'areas',
    name: 'set-status',
    usage: 'areas set-status <areaId> <waitlist|beta|live> --reason <text>',
    summary: 'Change a launch area status ("Aarhus live, Copenhagen waitlist" is a config change).',
    design: 'DESIGN.md §6.4, Q11',
  },
  {
    group: 'restore',
    name: 'replay-ledger',
    usage: 'restore replay-ledger --project <staging|prod> --since <iso-datetime> --reason <text>',
    summary: 'After a PITR/backup restore, replay every erasureLedger entry with the original server code before traffic resumes.',
    design: 'DESIGN.md §13 Backups, PRIVACY.md §5',
  },
];

export function findCommand(group: string | undefined, name: string | undefined): AdminCommand | undefined {
  return COMMANDS.find((c) => c.group === group && c.name === name);
}
