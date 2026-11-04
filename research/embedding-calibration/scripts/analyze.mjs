// Usage: node scripts/analyze.mjs <key:dtype> [--ref <key:dtype>] [--boot 1000]
//   e.g. node scripts/analyze.mjs v2:q4 --ref v2:fp32
// Reads out/emb_<key>_<dtype>.bin (from embed.mjs) and out/perf_* files, writes results/<key>-<dtype>.json.
// All thresholds are tuned IN-SAMPLE on the 211-tag test set; the bootstrap section estimates how optimistic that is.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { cpus } from 'node:os';
import { tags } from '../data/testset.mjs';
import { MODELS, ONNX_FILE } from './models.mjs';
import {
  OUT, r3, mean, std, quant, dot, normalize, range, auc, rng, loadRun, N, pairStats, looAssign, looSummary, assignAt,
  thresholdForPrecision, bandStats, detectorRows, detectorSummary, clusterAgg, onlineCluster, bootstrapSample, stringifyCompact,
} from './lib.mjs';

const args = process.argv.slice(2);
const run = args[0];
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ref = opt('--ref');
const B = Number(opt('--boot', '1000'));
const R = loadRun(run);
const prompts = R.meta.prompts;
const GRID = range(0.30, 0.995, 0.005);      // threshold search grid (fine enough for v2's narrow band)
const SWEEP = range(0.70, 0.98, 0.01);       // stored sweep
const CGRID = range(-0.2, 0.995, 0.005);     // for mean-centred vectors (different scale)
const DIMS = [768, 512, 256, 128];
const t0 = performance.now();
const log = (...a) => console.error(`[${((performance.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const pkg = (p) => { try { return JSON.parse(readFileSync(new URL(`../node_modules/${p}/package.json`, import.meta.url))).version; } catch { return null; } };
const res = {
  run: `${R.key}-${R.dtype}`, model: { key: R.key, ...MODELS[R.key], textOnlyConfig: undefined }, dtype: R.dtype,
  runtime: { transformers_js: pkg('@huggingface/transformers'), onnxruntime_node: pkg('onnxruntime-node'), node: process.version, cpu: `${cpus().length} x ${cpus()[0].model}` },
  embed_stats: R.meta.stats, n_tags: N, n_concepts: new Set(tags.map((x) => x.c)).size,
  n_singleton_concepts: tags.filter((x) => tags.filter((y) => y.c === x.c).length === 1).length,
};
{ // size of the ONNX text model actually loaded (graph + external weights), if the model folder is present
  const base = new URL(`../models/${MODELS[R.key].id}/${ONNX_FILE[R.dtype]}`, import.meta.url).pathname;
  try { res.model_files = { onnx: ONNX_FILE[R.dtype], mb: +((statSync(base).size + statSync(base + '_data').size) / 1e6).toFixed(1) }; } catch { res.model_files = { onnx: ONNX_FILE[R.dtype], mb: null }; }
}

// ---------- perf (median over repetitions) ----------
const perfFiles = readdirSync(OUT).filter((f) => f.startsWith(`perf_${R.key}_${R.dtype}_`));
res.perf = {};
for (const th of [...new Set(perfFiles.map((f) => f.split('_')[3]))]) {
  const reps = perfFiles.filter((f) => f.split('_')[3] === th).map((f) => JSON.parse(readFileSync(OUT + f, 'utf8')));
  const med = (g) => quant(reps.map(g), 0.5);
  res.perf[th] = {
    reps: reps.length, model_load_ms: med((r) => r.model_load_ms), tokenizer_load_ms: med((r) => r.tokenizer_load_ms),
    rss_after_load_mb: med((r) => r.rss_after_load_mb), rss_peak_mb: med((r) => r.rss_peak_mb),
    single_tag_p50_ms: med((r) => r.single_tag_ms.p50), single_tag_p50_range: [Math.min(...reps.map((r) => r.single_tag_ms.p50)), Math.max(...reps.map((r) => r.single_tag_ms.p50))],
    single_tag_p95_ms: med((r) => r.single_tag_ms.p95), batch8_ms_per_tag: med((r) => r.batch8_ms_per_tag), batch32_ms_per_tag: med((r) => r.batch32_ms_per_tag),
  };
}

// ---------- anisotropy: how close are tags to the common direction? (drives centroid drift in big concepts) ----------
res.anisotropy = {};
for (const k of ['sts|768', 'sts|256', 'none|768']) {
  const [p, dim] = k.split('|'); const V = R.tagVecs(p, +dim);
  const mu = new Float32Array(+dim); for (const v of V) for (let d = 0; d < +dim; d++) mu[d] += v[d] / V.length;
  const len = Math.sqrt(dot(mu, mu)), mun = normalize(mu), c = V.map((v) => dot(v, mun));
  res.anisotropy[k] = { mean_resultant_length: r3(len), cos_to_global_mean: { p05: r3(quant(c, 0.05)), p50: r3(quant(c, 0.5)), p95: r3(quant(c, 0.95)), max: r3(Math.max(...c)) } };
}

// ---------- (1) matching: prompts x dims ----------
res.matching = {}; const LOO = {};
for (const p of prompts) for (const dim of DIMS) {
  if (dim !== 768 && !['sts', 'none', 'classification', 'clustering'].includes(p)) continue;
  const V = R.tagVecs(p, dim), k = `${p}|${dim}`;
  const detail = p === 'sts' && dim !== 512;
  const ps = pairStats(V, { detail });
  const loo = (LOO[k] = looAssign(V));
  const withSweep = p === 'sts' || (dim === 768 && ['none', 'classification', 'clustering'].includes(p));
  const m = { ...ps, ...looSummary(loo, GRID, withSweep ? SWEEP : null) };
  if (detail) {
    const cs = ps.cross_sensitivity_pairs_sorted; delete m.cross_sensitivity_pairs_sorted;
    m.cross_sensitivity_pairs_above = Object.fromEntries([m.at_p95?.t, m.best_f1.t].filter((t) => t !== null && t !== undefined).map((t) => [t, cs.filter((s) => s >= t).length]));
    // every wrong auto-merge at the P>=0.95 threshold: which tag went into which concept
    m.wrong_merges_at_p95 = m.at_p95 ? loo.filter((x) => x.s >= m.at_p95.t && !(x.ok && x.hasHome)).sort((a, b) => b.s - a.s)
      .map((x) => ({ tag: tags[x.i].t, own: tags[x.i].c, into: x.c, s: r3(x.s), cross_sensitivity: x.crossSens })) : [];
  }
  if (m.sweep) m.sweep = m.sweep.map(({ t, p, r, wrong_merges, cross_sensitivity_merges, singleton_new_rate }) => ({ t, p, r, wrong_merges, cross_sensitivity_merges, singleton_new_rate }));
  res.matching[k] = m;
}
log('matching done');

// ---------- "did you mean" band below the auto-merge threshold ----------
res.bands = {};
for (const k of ['sts|768', 'sts|256', 'sts|128']) {
  const hi = res.matching[k].at_p95?.t; if (hi === null || hi === undefined) continue;
  res.bands[k] = { merge_t: hi, bands: range(+(hi - 0.15).toFixed(3), +(hi - 0.01).toFixed(3), 0.01).map((lo) => bandStats(LOO[k], lo, hi)).reverse(),
    v1_band_0_78_0_86: bandStats(LOO[k], 0.78, 0.86) };
}

// ---------- (2) mean-centring re-check (global vs per-language) ----------
res.centering = {};
for (const k of ['sts|768', 'sts|256', 'none|768', 'classification|768']) {
  const [p, dim] = k.split('|'); const V0 = R.tagVecs(p, +dim);
  const center = (groups) => {
    const mus = {}; for (const g of new Set(groups)) { const vs = V0.filter((_, i) => groups[i] === g); mus[g] = vs[0].map((_, d) => mean(vs.map((v) => v[d]))); }
    return V0.map((v, i) => normalize(v.map((x, d) => x - mus[groups[i]][d])));
  };
  const variants = { raw: V0, global: center(tags.map(() => 'all')), per_language: center(tags.map((x) => x.l)) };
  res.centering[k] = {};
  for (const [name, V] of Object.entries(variants)) {
    const ps = pairStats(V), loo = looAssign(V), g = name === 'raw' ? GRID : CGRID, ls = looSummary(loo, g);
    res.centering[k][name] = { auc: ps.auc, auc_crosslingual: ps.auc_crosslingual, loo_top1_nn: ls.loo_top1_nn, loo_top1_centroid: ls.loo_top1_centroid,
      diff_dada: ps.lang_means['diff da-da'], diff_enen: ps.lang_means['diff en-en'], diff_daen: ps.lang_means['diff da-en'], danish_bias_sd: ps.danish_bias.in_sd_of_diff,
      at_p95: ls.at_p95 && { t: ls.at_p95.t, p: ls.at_p95.p, r: ls.at_p95.r }, best_f1: { t: ls.best_f1.t, p: ls.best_f1.p, r: ls.best_f1.r, f1: ls.best_f1.f1 } };
  }
}
log('centering done');

// ---------- (3) sensitive detector ----------
res.detector = {}; const ROWS = {};
for (const p of prompts) for (const dim of [768, 256, 128]) for (const centered of [false, true]) {
  if (dim !== 768 && !['sts', 'classification', 'none'].includes(p)) continue;
  const k = `${p}|${dim}|${centered ? 'centered' : 'raw'}`;
  const rows = (ROWS[k] = detectorRows(R, p, dim, centered));
  res.detector[k] = detectorSummary(rows, 0.001, { detail: dim === 768 && (!centered || ['sts', 'classification'].includes(p)) });
}
// v1-compatible coarse grid (0.01) for the reference detector, to check reproduction of the v1 numbers
res.detector_grid001_vs_grid01 = { 'classification|768|raw': detectorSummary(ROWS['classification|768|raw'], 0.01) };
for (const o of Object.values(res.detector_grid001_vs_grid01)) for (const x of ['recall100', 'recall95']) delete o[x].f1;
log('detector done');

// ---------- (4) online clustering, 5 shuffles ----------
const TAUS = range(0.78, 0.95, 0.01);
res.clustering = {};
const bestDet = Object.entries(res.detector).filter(([k]) => k.endsWith('|768|raw')).sort((a, b) => a[1].recall100.fp - b[1].recall100.fp || b[1].auc_margin - a[1].auc_margin)[0][0];
const guardThr = res.detector[bestDet].recall100.t;
const guard = ROWS[bestDet].map((r) => r.margin >= guardThr);
res.clustering_guard = { detector: bestDet, margin_threshold: guardThr, note: 'guard = tag may only join a cluster whose first member has the same detector flag (in-sample, recall-100 threshold)' };
for (const dim of [768, 256, 128]) {
  const V = R.tagVecs('sts', dim);
  res.clustering[`sts|${dim}`] = TAUS.map((tau) => { const a = clusterAgg(V, tau); delete a._runs; return a; });
}
{
  const V = R.tagVecs('sts', 768);
  res.clustering['sts|768|guarded'] = TAUS.map((tau) => { const a = clusterAgg(V, tau, [1, 2, 3, 4, 5], guard); delete a._runs; return a; });
  // full listing for seed 1 at the LOO P>=0.95 threshold and at the best-B3-F1 tau
  const tP = res.matching['sts|768'].at_p95?.t, best = [...res.clustering['sts|768']].sort((a, b) => b.b3_concept.f1.mean - a.b3_concept.f1.mean)[0].tau;
  res.cluster_listing = {};
  for (const tau of [...new Set([+(Math.round(tP * 100) / 100).toFixed(2), best])]) {
    const c = onlineCluster(V, tau, 1);
    res.cluster_listing[`sts|768|tau=${tau}|seed=1`] = { n_clusters: c.n_clusters, multi_member: c.clusters.filter((x) => x.length > 1).map((x) => x.join(' | ')), singletons: c.clusters.filter((x) => x.length === 1).map((x) => x[0]), mixed_sensitive_nonsensitive: c.mixed };
  }
  // same online clustering on globally mean-centred vectors (mean of the 211 tags; in production a fixed reference mean)
  const mu = new Float32Array(768); for (const v of V) for (let d = 0; d < 768; d++) mu[d] += v[d] / V.length;
  const Vc = V.map((v) => normalize(v.map((x, d) => x - mu[d])));
  res.clustering['sts|768|global_centered'] = range(0.30, 0.80, 0.025).map((tau) => { const a = clusterAgg(Vc, tau); delete a._runs; return a; });
}
log('clustering done');

// ---------- (5) dtype agreement + case sensitivity ----------
res.dtype_agreement = {};
for (const other of (ref ? [ref] : [])) {
  if (!existsSync(`${OUT}emb_${other.replace(':', '_')}.bin`)) continue;
  const O = loadRun(other);
  for (const p of prompts) {
    const sims = tags.map((x) => dot(R.vec(p, x.t), O.vec(p, x.t)));
    const w = sims.indexOf(Math.min(...sims));
    res.dtype_agreement[`vs_${other}|${p}`] = { mean: r3(mean(sims)), min: r3(sims[w]), worst: tags[w].t };
  }
  // drift of PAIRWISE scores (what thresholds see), in absolute cosine and in units of the sd of unrelated-pair scores
  const A = R.tagVecs('sts', 768), Bv = O.tagVecs('sts', 768), dif = [], diffPairs = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const a = dot(A[i], A[j]), b = dot(Bv[i], Bv[j]); dif.push(Math.abs(a - b)); if (tags[i].c !== tags[j].c) diffPairs.push(b); }
  const sd = std(diffPairs);
  res.dtype_agreement[`pairwise_sts768_vs_${other}`] = { mean_abs: r3(mean(dif)), p95_abs: r3(quant(dif, 0.95)), max_abs: r3(Math.max(...dif)), mean_abs_in_sd_of_unrelated: r3(mean(dif) / sd), p95_abs_in_sd_of_unrelated: r3(quant(dif, 0.95) / sd) };
}
res.case_sensitivity = {};
for (const p of ['none', 'sts', 'classification', 'clustering']) {
  const xs = tags.filter((x) => x.t.toLowerCase() !== x.t).map((x) => ({ t: x.t, s: r3(dot(R.vec(p, x.t), R.vec(p, x.t.toLowerCase()))) }));
  res.case_sensitivity[p] = { n: xs.length, mean: r3(mean(xs.map((x) => x.s))), min: xs.reduce((a, b) => (b.s < a.s ? b : a)) };
}

// ---------- (6) bootstrap over concepts: how optimistic are in-sample thresholds? ----------
res.bootstrap = { B, method: 'resample the 68 concepts with replacement; pick the threshold on the in-bag tags, evaluate on out-of-bag concepts (LOO scores held fixed)' };
for (const k of ['sts|768', 'sts|256']) {
  const loo = LOO[k], r = rng(12345), ts = [], oobP = [], oobR = [], inR = [];
  for (let b = 0; b < B; b++) {
    const { idx, oob } = bootstrapSample(r);
    const pick = thresholdForPrecision(idx.map((i) => loo[i]), GRID, 0.95); if (!pick) continue;
    ts.push(pick.t); inR.push(pick.r);
    const o = assignAt(oob.map((i) => loo[i]), pick.t); if (o.merges) oobP.push(o.p); oobR.push(o.r);
  }
  const ci = (a) => [r3(quant(a, 0.05)), r3(quant(a, 0.5)), r3(quant(a, 0.95))];
  res.bootstrap[`merge_at_p95|${k}`] = { threshold_p05_p50_p95: ci(ts), inbag_recall: ci(inR), oob_precision: ci(oobP), oob_precision_mean: r3(mean(oobP)), oob_recall: ci(oobR) };
}
for (const k of [bestDet, 'classification|768|raw', 'sts|768|raw']) {
  if (res.bootstrap[`detector_recall100|${k}`]) continue;
  const rows = ROWS[k], r = rng(777), oobRec = [], oobFpr = [], aucs = [], ts = [], oobRecB = {};
  for (let b = 0; b < B; b++) {
    const { idx, oob } = bootstrapSample(r);
    const inPos = idx.map((i) => rows[i]).filter((x) => !x.amb && x.s), inNeg = idx.map((i) => rows[i]).filter((x) => !x.amb && !x.s);
    if (!inPos.length || !inNeg.length) continue;
    const t = Math.floor(Math.min(...inPos.map((x) => x.margin)) / 0.001) * 0.001; ts.push(t);
    aucs.push(auc(inPos.map((x) => x.margin), inNeg.map((x) => x.margin)));
    const op = oob.map((i) => rows[i]).filter((x) => !x.amb && x.s), on = oob.map((i) => rows[i]).filter((x) => !x.amb && !x.s);
    if (op.length) { oobRec.push(op.filter((x) => x.margin >= t).length / op.length); for (const b of [0.005, 0.01]) (oobRecB[b] ??= []).push(op.filter((x) => x.margin >= t - b).length / op.length); }
    if (on.length) oobFpr.push(on.filter((x) => x.margin >= t).length / on.length);
  }
  const ci = (a) => [r3(quant(a, 0.05)), r3(quant(a, 0.5)), r3(quant(a, 0.95))];
  res.bootstrap[`detector_recall100|${k}`] = { auc_margin: ci(aucs), threshold: ci(ts), oob_recall: ci(oobRec), oob_recall_mean: r3(mean(oobRec)), oob_fp_rate: ci(oobFpr),
    oob_recall_mean_with_buffer: Object.fromEntries(Object.entries(oobRecB).map(([b, a]) => [b, r3(mean(a))])) };
}
log('bootstrap done');

mkdirSync(new URL('../results/', import.meta.url), { recursive: true });
const file = new URL(`../results/${R.key}-${R.dtype}.json`, import.meta.url);
const json = stringifyCompact(res, 3);
writeFileSync(file, json);
console.log(`wrote ${file.pathname} (${(json.length / 1024).toFixed(0)} KB)`);
