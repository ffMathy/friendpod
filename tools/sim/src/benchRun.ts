/** Child process of bench.ts: decode the snapshot and run matchComponent once; print timings and peak RSS. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeMatchSnapshot, matchComponent } from '@grouper/core';

const file = process.argv[2];
if (!file) throw new Error('usage: benchRun.ts <snapshot.json.gz>');
const mb = (bytes: number): number => Math.round(bytes / 2 ** 20);
const rssBefore = process.memoryUsage().rss;
const t0 = performance.now();
const decoded = decodeMatchSnapshot(JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')));
const t1 = performance.now();
const result = matchComponent(decoded.input);
const t2 = performance.now();
const { stats } = result;
console.log(
  JSON.stringify({
    decodeMs: Math.round(t1 - t0),
    matchMs: Math.round(t2 - t1),
    rssBeforeMb: mb(rssBefore),
    peakRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
    heapUsedAfterMb: mb(process.memoryUsage().heapUsed),
    eligible: stats.eligible,
    matched: stats.matched,
    pods: stats.pods,
    podsBySize: stats.podsBySize,
    movesEvaluated: stats.movesEvaluated,
    unmatchedByReason: stats.unmatchedByReason,
  }),
);
