// Usage:
//   node scripts/embed.mjs <v1|v2> <q4|q8|fp32>                 -> embeds every text x prompt, writes out/emb_<key>_<dtype>.bin(+.meta.json)
//   node scripts/embed.mjs <v1|v2> <q4|q8|fp32> --perf --threads N [--rep R]
//                                                               -> perf only: load time, RSS, single-tag + batch latency,
//                                                                  writes out/perf_<key>_<dtype>_t<N>_r<R>.json
// One process per measurement, so peak RSS (VmHWM) is per configuration.
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadModel, PROMPTS, hwmMB, rssMB } from './models.mjs';
import { tags, prototypes, negativeAnchors } from '../data/testset.mjs';

const args = process.argv.slice(2);
const [key, dtype] = args;
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const threads = opt('--threads') ? Number(opt('--threads')) : undefined;
const rep = opt('--rep', '1');
const OUT = new URL('../out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });

const tagTexts = tags.map((x) => x.t);
const protoTexts = Object.values(prototypes).flat();
const lowerVariants = tagTexts.filter((t) => t.toLowerCase() !== t).map((t) => t.toLowerCase());
const texts = [...new Set([...tagTexts, ...protoTexts, ...negativeAnchors, ...lowerVariants])];

const rss0 = rssMB();
const M = await loadModel(key, dtype, threads);
const rssLoaded = rssMB();
const stats = {
  model_key: key, model_id: M.id, revision: M.revision, dtype, threads: M.threads, sessions: M.sessions,
  tokenizer_load_ms: M.load_ms.tokenizer, model_load_ms: M.load_ms.model,
  rss_before_mb: +rss0.toFixed(0), rss_after_load_mb: +rssLoaded.toFixed(0),
  node: process.version, rep: +rep,
};

if (flag('--perf')) {
  for (let i = 0; i < 3; i++) await M.embed(['warmup ' + i], PROMPTS.sts);
  stats.rss_after_warmup_mb = +rssMB().toFixed(0);
  const lat = [];
  for (const t of tagTexts.slice(0, 80)) { const s = performance.now(); await M.embed([t], PROMPTS.sts); lat.push(performance.now() - s); }
  lat.sort((a, b) => a - b);
  const pct = (p) => lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))];
  stats.single_tag_ms = { p50: +pct(50).toFixed(1), p95: +pct(95).toFixed(1), mean: +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1), n: lat.length };
  for (const B of [8, 32]) {
    const sb = performance.now();
    for (let i = 0; i < tagTexts.length; i += B) await M.embed(tagTexts.slice(i, i + B), PROMPTS.sts);
    stats[`batch${B}_ms_per_tag`] = +((performance.now() - sb) / tagTexts.length).toFixed(2);
  }
  stats.rss_end_mb = +rssMB().toFixed(0);
  stats.rss_peak_mb = +(await hwmMB()).toFixed(0);
  writeFileSync(`${OUT}perf_${key}_${dtype}_t${threads ?? 'default'}_r${rep}.json`, JSON.stringify(stats, null, 1));
  console.log(JSON.stringify(stats));
} else {
  const D = 768, names = Object.keys(PROMPTS), BATCH = 32;
  const buf = new Float32Array(names.length * texts.length * D);
  const se = performance.now();
  for (let pi = 0; pi < names.length; pi++) {
    for (let i = 0; i < texts.length; i += BATCH) {
      const vs = await M.embed(texts.slice(i, i + BATCH), PROMPTS[names[pi]]);
      vs.forEach((v, k) => buf.set(v, (pi * texts.length + i + k) * D));
    }
  }
  stats.full_embed_s = +((performance.now() - se) / 1000).toFixed(1);
  stats.raw_norm = { min: +Math.min(...M.norms).toFixed(5), max: +Math.max(...M.norms).toFixed(5), n: M.norms.length };
  stats.rss_peak_mb = +(await hwmMB()).toFixed(0);
  writeFileSync(`${OUT}emb_${key}_${dtype}.bin`, Buffer.from(buf.buffer));
  writeFileSync(`${OUT}emb_${key}_${dtype}.meta.json`, JSON.stringify({ texts, prompts: names, promptStrings: PROMPTS, dim: D, stats }));
  console.log(JSON.stringify(stats));
}
