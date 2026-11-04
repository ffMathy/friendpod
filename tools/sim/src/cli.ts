/**
 * npm -w tools/sim run sim -- --n 200 --weeks 12 --profile alpha --seed 1
 * Prints the run's metrics as JSON. Synthetic simulation with assumed behaviour (see behaviour.ts).
 */
import { parseArgs } from 'node:util';
import { getMatchingProfile, MATCHING_PROFILE_IDS, type MatchingProfileId } from '@grouper/core';
import { simulate } from './loop';

const { values } = parseArgs({
  options: {
    n: { type: 'string', default: '200' },
    weeks: { type: 'string', default: '12' },
    profile: { type: 'string', default: 'launch' },
    seed: { type: 'string', default: '1' },
    concepts: { type: 'string', default: '2000' },
    'per-week': { type: 'boolean', default: false },
    'assert-smoke': { type: 'boolean', default: false },
  },
});

const profileId = values.profile as MatchingProfileId;
if (!(MATCHING_PROFILE_IDS as readonly string[]).includes(profileId)) {
  console.error(`unknown profile ${values.profile}; use one of ${MATCHING_PROFILE_IDS.join(', ')}`);
  process.exit(2);
}
const result = simulate({
  n: Number(values.n),
  weeks: Number(values.weeks),
  profile: getMatchingProfile(profileId),
  seed: Number(values.seed),
  concepts: Number(values.concepts),
});
const { perWeek, ...summary } = result.metrics;
console.log(JSON.stringify({ ...result, metrics: values['per-week'] ? result.metrics : summary }, null, 2));

if (values['assert-smoke']) {
  const m = result.metrics;
  const problems = [
    m.proposedPods > 0 ? null : 'no pods proposed',
    m.matchRate !== null && m.matchRate > 0 && m.matchRate <= 1 ? null : `match rate out of range: ${m.matchRate}`,
    perWeek.length === result.config.weeks ? null : 'missing weeks',
  ].filter((p): p is string => p !== null);
  if (problems.length > 0) {
    console.error(`sim smoke failed: ${problems.join('; ')}`);
    process.exit(1);
  }
}
