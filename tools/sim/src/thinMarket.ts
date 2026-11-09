/**
 * Thin-market experiment (DESIGN.md §6.9): n = 100, 200, 300 × launch / alpha (± seed-theme cohorts) × seeds 1–3, 12 weeks.
 *   npm -w tools/sim run thin-market -- [--json out.json]
 * Prints a Markdown table (mean over seeds, min–max in brackets). Synthetic, with assumed behaviour.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { getMatchingProfile, type MatchingProfileId } from '@friendpod/core';
import { simulate, type SimResult } from './loop';

const { values } = parseArgs({
  options: {
    json: { type: 'string' },
    weeks: { type: 'string', default: '12' },
    seeds: { type: 'string', default: '1,2,3' },
    sizes: { type: 'string', default: '100,200,300' },
  },
});

const sizes = values.sizes.split(',').map(Number);
const seeds = values.seeds.split(',').map(Number);
/** Launch and alpha parameters with open recruiting, plus the alpha as specified: seed-theme cohorts (§6.10). */
const variants: { label: string; profile: MatchingProfileId; cohorts: number }[] = [
  { label: 'launch', profile: 'launch', cohorts: 0 },
  { label: 'alpha', profile: 'alpha', cohorts: 0 },
  { label: 'alpha + 5 seed-theme cohorts', profile: 'alpha', cohorts: 5 },
];
const runs: (SimResult & { label: string })[] = [];
for (const n of sizes) {
  for (const v of variants) {
    for (const seed of seeds) {
      runs.push({ label: v.label, ...simulate({ n, weeks: Number(values.weeks), profile: getMatchingProfile(v.profile), seed, cohorts: v.cohorts }) });
    }
  }
}
if (values.json) writeFileSync(values.json, `${JSON.stringify(runs, null, 2)}\n`);

type Metric = (r: SimResult) => number | null;
function cell(rs: SimResult[], f: Metric, pct = false, digits = pct ? 0 : 1): string {
  const xs = rs.map(f);
  const fmt = (x: number | null): string => (x === null ? '>12' : pct ? `${(x * 100).toFixed(digits)}%` : x.toFixed(digits));
  if (xs.some((x) => x === null)) {
    const finite = xs.filter((x): x is number => x !== null);
    return `${xs.filter((x) => x === null).length}/${xs.length} >12${finite.length ? ` (${finite.map((x) => fmt(x)).join(', ')})` : ''}`;
  }
  const nums = xs as number[];
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  return `${fmt(mean)} [${fmt(Math.min(...nums))}–${fmt(Math.max(...nums))}]`;
}

const cause = (r: SimResult, k: string): number => (r.metrics.neverMatchedByCause as Record<string, number | null>)[k] ?? 0;
const columns: [string, Metric, boolean][] = [
  ['match rate', (r) => r.metrics.matchRate, true],
  ['invite accept', (r) => r.metrics.inviteAcceptance, true],
  ['confirmation', (r) => r.metrics.confirmationRate, true],
  ['proposals of 6', (r) => (r.metrics.podSizes[6] ?? 0) / Math.max(1, r.metrics.proposedPods), true],
  ['wks to 1st pod P50', (r) => r.metrics.weeksToFirstPod.p50, false],
  ['P90', (r) => r.metrics.weeksToFirstPod.p90, false],
  ['never matched', (r) => r.metrics.neverMatchedShare, true],
  ['…same-gender', (r) => cause(r, 'sameGender'), true],
  ['…sensitive-only', (r) => cause(r, 'sensitiveOnly'), true],
  ['…age', (r) => cause(r, 'age'), true],
  ['…language', (r) => cause(r, 'language'), true],
  ['…no shared theme', (r) => cause(r, 'noSharedTheme'), true],
  ['…proposed, never confirmed', (r) => cause(r, 'proposedNotConfirmed'), true],
  ['match ms/week (max)', (r) => r.metrics.runtimeMs.matchMaxWeek, false],
];

const header = ['n', 'variant', ...columns.map(([h]) => h)];
const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];
for (const n of sizes) {
  for (const v of variants) {
    const rs = runs.filter((r) => r.config.n === n && r.label === v.label);
    lines.push(`| ${n} | ${v.label} | ${columns.map(([, f, pct]) => cell(rs, f, pct)).join(' | ')} |`);
  }
}
console.log(lines.join('\n'));
