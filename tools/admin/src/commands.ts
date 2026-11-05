/**
 * Admin commands (DESIGN.md §9 Admin access, §13 Backups, §14). There are no review or sanction commands: nothing
 * waits for a human (F17). Until M1 they only describe themselves:
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
    summary:
      'Change a launch area status ("Aarhus live, Copenhagen waitlist" is a config change). Going live also enqueues the openArea task (id open-{areaId}): everyone in the area becomes eligible and gets "<city> is open — your first drop is Thursday 18:00".',
    design: 'DESIGN.md §6.4, Q11, §10.3 openArea',
  },
  {
    group: 'funnel',
    name: 'show',
    usage: 'funnel show [--area <areaId>] --from <funnel-export.json> --reason <text>',
    summary: 'Print the day-1 funnel per launch area and ISO week (funnel/{areaId}_{weekId}), every cell under 10 as "<10". Reads an export until M1.',
    design: 'DESIGN.md §6.8 Funnel',
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
