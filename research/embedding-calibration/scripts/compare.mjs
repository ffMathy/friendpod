// Usage: node scripts/compare.mjs [baseline=v1:q4] [others=v2:q4,v2:q8,v2:fp32] [--boot 500] [--out comparison]
// Reads results/<run>.json (analyze.mjs) and, for the paired bootstrap, out/emb_<run>.bin.
// Writes results/comparison.json and results/comparison.md (the side-by-side table used in README.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { tags } from '../data/testset.mjs';
import { r3, quant, mean, dot, range, auc, rng, loadRun, N, looAssign, assignAt, thresholdForPrecision, bandStats, detectorRows, bootstrapSample, stringifyCompact } from './lib.mjs';

const args = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] ?? '').startsWith('--'));
const B = Number((process.argv.find((a, i) => process.argv[i - 1] === '--boot')) ?? 500);
const base = args[0] ?? 'v1:q4';
const others = (args[1] ?? 'v2:q4,v2:q8,v2:fp32').split(',');
const runs = [base, ...others];
const name = (r) => r.replace(':', '-');
const RES = Object.fromEntries(runs.map((r) => [r, JSON.parse(readFileSync(new URL(`../results/${name(r)}.json`, import.meta.url), 'utf8'))]));
const GRID = range(0.30, 0.995, 0.005);

// ---------- per-run derived operating points ----------
const derived = {};
for (const r of runs) {
  const R = loadRun(r), V = R.tagVecs('sts', 768), loo = looAssign(V), x = RES[r];
  const mergeT = x.matching['sts|768'].at_p95.t;
  // "did you mean" band [lo, mergeT): lowest lo (0.005 steps) whose band precision is still >= 0.60
  let band = null;
  for (let lo = mergeT - 0.005; lo > mergeT - 0.2; lo = +(lo - 0.005).toFixed(3)) { const b = bandStats(loo, +lo.toFixed(3), mergeT); if (b.precision >= 0.6 && b.n) band = b; else if (b.n > 5) break; }
  const clus = x.clustering['sts|768'], cen = x.clustering['sts|768|global_centered'];
  const tauAt = (arr) => arr.find((c) => c.b3_concept.p.mean >= 0.95);
  const near = (arr, c, k) => arr[arr.indexOf(c) + k];
  const tc = tauAt(clus), tcc = tauAt(cen);
  derived[r] = {
    merge_t: mergeT, band,
    // exact LOO P/R just around the threshold (the stored sweep only has 0.01 steps)
    around_merge_t: Object.fromEntries([-0.01, -0.005, 0.005, 0.01].map((dt) => { const a = assignAt(loo, +(mergeT + dt).toFixed(3)); return [dt, { t: a.t, p: a.p, r: a.r, wrong: a.wrong_merges, cross: a.cross_sensitivity_merges }]; })),
    // safety-buffered threshold (+0.005) and its band
    safe: (() => { const t = +(mergeT + 0.005).toFixed(3), a = assignAt(loo, t); let b = null;
      for (let lo = t - 0.005; lo > t - 0.2; lo = +(lo - 0.005).toFixed(3)) { const x = bandStats(loo, +lo.toFixed(3), t); if (x.precision >= 0.6 && x.n) b = x; else if (x.n > 5) break; }
      return { t, p: a.p, r: a.r, wrong: a.wrong_merges, cross: a.cross_sensitivity_merges, singleton_new_rate: a.singleton_new_rate, band: b }; })(),
    online_tau_p95: tc && { tau: tc.tau, n_clusters: tc.n_clusters.mean, singletons: tc.singletons.mean, p: tc.b3_concept.p.mean, r: tc.b3_concept.r.mean, f1: tc.b3_concept.f1.mean, mixed: tc.mixed_sensitive_clusters.mean,
      clusters_at_tau_minus_0_02: near(clus, tc, -2)?.n_clusters.mean, clusters_at_tau_plus_0_02: near(clus, tc, 2)?.n_clusters.mean },
    online_best_f1: (({ tau, b3_concept, n_clusters, mixed_sensitive_clusters }) => ({ tau, p: b3_concept.p.mean, r: b3_concept.r.mean, f1: b3_concept.f1.mean, n_clusters: n_clusters.mean, mixed: mixed_sensitive_clusters.mean }))([...clus].sort((a, b) => b.b3_concept.f1.mean - a.b3_concept.f1.mean)[0]),
    centered_tau_p95: tcc && { tau: tcc.tau, n_clusters: tcc.n_clusters.mean, p: tcc.b3_concept.p.mean, r: tcc.b3_concept.r.mean, f1: tcc.b3_concept.f1.mean, mixed: tcc.mixed_sensitive_clusters.mean,
      clusters_at_tau_minus_0_025: near(cen, tcc, -1)?.n_clusters.mean, clusters_at_tau_plus_0_025: near(cen, tcc, 1)?.n_clusters.mean },
    _R: R, _V: V, _loo: loo,
  };
}

// ---------- paired bootstrap: identical concept resamples for baseline and each other run ----------
function pairAUC(S, idx) {
  const pos = [], neg = [];
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
    const i = idx[a], j = idx[b]; if (i === j) continue;
    (tags[i].c === tags[j].c ? pos : neg).push(S[i * N + j]);
  }
  return auc(pos, neg);
}
const SIM = {}, DET = {};
for (const r of runs) {
  const V = derived[r]._V, S = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) S[i * N + j] = dot(V[i], V[j]);
  SIM[r] = S;
  DET[r] = { cls: detectorRows(derived[r]._R, 'classification', 768, false), sts: detectorRows(derived[r]._R, 'sts', 768, false) };
}
function detStats(rows, idx, oob) {
  const ip = idx.map((i) => rows[i]).filter((x) => !x.amb && x.s), ineg = idx.map((i) => rows[i]).filter((x) => !x.amb && !x.s);
  const t = Math.min(...ip.map((x) => x.margin));
  const on = oob.map((i) => rows[i]).filter((x) => !x.amb && !x.s), op = oob.map((i) => rows[i]).filter((x) => !x.amb && x.s);
  return { auc: auc(ip.map((x) => x.margin), ineg.map((x) => x.margin)), fpr_in: ineg.filter((x) => x.margin >= t).length / ineg.length,
    oob_fpr: on.length ? on.filter((x) => x.margin >= t).length / on.length : null, oob_rec: op.length ? op.filter((x) => x.margin >= t).length / op.length : null };
}
const boot = {};
const rnd = rng(2026);
const samples = Array.from({ length: B }, () => bootstrapSample(rnd));
for (const o of others) {
  const d = { pair_auc: [], recall_at_p95_inbag: [], recall_at_p95_oob: [], det_cls_auc: [], det_sts_auc: [], det_cls_fpr_at_r100: [], det_sts_fpr_at_r100: [],
    det_other_sts_vs_base_cls_fpr_at_r100: [], det_other_sts_minus_other_cls_fpr_at_r100: [] };
  for (const { idx, oob } of samples) {
    d.pair_auc.push(pairAUC(SIM[o], idx) - pairAUC(SIM[base], idx));
    const pick = (r) => thresholdForPrecision(idx.map((i) => derived[r]._loo[i]), GRID, 0.95);
    const po = pick(o), pb = pick(base);
    if (po && pb) {
      d.recall_at_p95_inbag.push(po.r - pb.r);
      d.recall_at_p95_oob.push(assignAt(oob.map((i) => derived[o]._loo[i]), po.t).r - assignAt(oob.map((i) => derived[base]._loo[i]), pb.t).r);
    }
    const st = {};
    for (const k of ['cls', 'sts']) {
      const so = detStats(DET[o][k], idx, oob), sb = detStats(DET[base][k], idx, oob); st[k] = { so, sb };
      d[`det_${k}_auc`].push(so.auc - sb.auc); d[`det_${k}_fpr_at_r100`].push(so.fpr_in - sb.fpr_in);
    }
    d.det_other_sts_vs_base_cls_fpr_at_r100.push(st.sts.so.fpr_in - st.cls.sb.fpr_in);
    d.det_other_sts_minus_other_cls_fpr_at_r100.push(st.sts.so.fpr_in - st.cls.so.fpr_in);
  }
  boot[`${name(o)} minus ${name(base)}`] = Object.fromEntries(Object.entries(d).map(([k, a]) => [k, { mean: r3(mean(a)), ci90: [r3(quant(a, 0.05)), r3(quant(a, 0.95))], p_gt_0: r3(a.filter((x) => x > 0).length / a.length), n: a.length }]));
}

// ---------- table ----------
const g = (r, f) => { try { const v = f(RES[r], derived[r]); return v === undefined || v === null ? '–' : v; } catch { return '–'; } };
const rows = [
  ['**Model / runtime**'],
  ['ONNX text model file', (x) => `${x.model_files.onnx.replace('onnx/', '')} (${x.model_files.mb} MB)`],
  ['Model load (median, ms) @4 thr', (x) => x.perf.t4?.model_load_ms],
  ['RSS after load / peak (MB) @4 thr', (x) => `${x.perf.t4.rss_after_load_mb} / ${x.perf.t4.rss_peak_mb}`],
  ['Single-tag p50 (ms) @4 thr [min–max of reps]', (x) => `${x.perf.t4.single_tag_p50_ms} [${x.perf.t4.single_tag_p50_range.join('–')}]`],
  ['Single-tag p50 (ms) @1 thr', (x) => `${x.perf.t1.single_tag_p50_ms} [${x.perf.t1.single_tag_p50_range.join('–')}]`],
  ['Batch-32 per tag (ms) @4 / @1 thr', (x) => `${x.perf.t4.batch32_ms_per_tag} / ${x.perf.t1.batch32_ms_per_tag}`],
  ['Perf repetitions', (x) => x.perf.t4.reps],
  ['**Matching (same-concept vs different-concept pairs)**'],
  ['Pair AUC @768: none / sts / classification / clustering', (x) => ['none', 'sts', 'classification', 'clustering'].map((p) => x.matching[`${p}|768`].auc).join(' / ')],
  ['Pair AUC sts @768 / 256 / 128', (x) => [768, 256, 128].map((d) => x.matching[`sts|${d}`].auc).join(' / ')],
  ['Cross-lingual same-concept AUC (sts 768)', (x) => x.matching['sts|768'].auc_crosslingual],
  ['LOO top-1 concept, centroid / nearest neighbour', (x) => `${x.matching['sts|768'].loo_top1_centroid} / ${x.matching['sts|768'].loo_top1_nn}`],
  ['Unrelated-pair cosine p05–p95 (sts 768)', (x) => `${x.matching['sts|768'].diff.p05}–${x.matching['sts|768'].diff.p95}`],
  ['Same-concept cosine p05–p95', (x) => `${x.matching['sts|768'].same.p05}–${x.matching['sts|768'].same.p95}`],
  ['**Auto-merge threshold (LOO vs concept centroids, sts 768)**'],
  ['Threshold for P≥0.95 (stable rule) → P / R', (x) => { const a = x.matching['sts|768'].at_p95; return `**${a.t}** → ${a.p} / ${a.r}`; }],
  ['  same at 256d → P / R', (x) => { const a = x.matching['sts|256'].at_p95; return `${a.t} → ${a.p} / ${a.r}`; }],
  ['  same at 128d → P / R', (x) => { const a = x.matching['sts|128'].at_p95; return `${a.t} → ${a.p} / ${a.r}`; }],
  ['P / R at v1\'s chosen 0.86', (x) => { const a = x.matching['sts|768'].sweep.find((s) => s.t === 0.86); return `${a.p} / ${a.r}`; }],
  ['P / R at threshold −0.01 / −0.005 / +0.005 / +0.01', (x, d) => Object.values(d.around_merge_t).map((a) => `${a.t}: ${a.p}/${a.r}`).join(' · ')],
  ['Safety-buffered threshold (+0.005) → P / R, wrong (cross-sens.)', (x, d) => `${d.safe.t} → ${d.safe.p} / ${d.safe.r}, ${d.safe.wrong} (${d.safe.cross})`],
  ['  its "did you mean" band (precision ≥ 0.6)', (x, d) => d.safe.band && `[${d.safe.band.lo}, ${d.safe.band.hi}) P ${d.safe.band.precision}, ${Math.round(d.safe.band.share_of_tags * 100)}% of tags, cross-sens. ${d.safe.band.cross_sensitivity_suggestions}`],
  ['Singleton concepts correctly start new', (x) => x.matching['sts|768'].at_p95.singleton_new_rate],
  ['Wrong merges at threshold (cross-sensitivity)', (x) => { const m = x.matching['sts|768']; return `${m.at_p95.wrong_merges} (${m.at_p95.cross_sensitivity_merges}): ${m.wrong_merges_at_p95.map((w) => `${w.tag}→${w.into}`).join(', ')}`; }],
  ['Bootstrap (concept resample): threshold p05–p95', (x) => x.bootstrap['merge_at_p95|sts|768'].threshold_p05_p50_p95.filter((_, i) => i !== 1).join('–')],
  ['Bootstrap: out-of-bag precision mean / recall p50', (x) => `${x.bootstrap['merge_at_p95|sts|768'].oob_precision_mean} / ${x.bootstrap['merge_at_p95|sts|768'].oob_recall[1]}`],
  ['Best-F1 threshold → P / R / F1', (x) => { const a = x.matching['sts|768'].best_f1; return `${a.t} → ${a.p} / ${a.r} / ${a.f1}`; }],
  ['"Did you mean" band (band precision ≥ 0.6)', (x, d) => d.band && `[${d.band.lo}, ${d.band.hi}) P ${d.band.precision}, ${Math.round(d.band.share_of_tags * 100)}% of tags, cross-sens. suggestions ${d.band.cross_sensitivity_suggestions}`],
  ['Recall if band suggestions are accepted', (x, d) => d.band?.recall_merge_plus_band],
  ['**Language behaviour (sts 768)**'],
  ['Unrelated pairs mean: da–da / en–en / da–en', (x) => { const l = x.matching['sts|768'].lang_means; return `${l['diff da-da']} / ${l['diff en-en']} / ${l['diff da-en']}`; }],
  ['Danish surface bias (da–da − en–en, in sd of unrelated)', (x) => `${x.matching['sts|768'].danish_bias.diff_dada_minus_enen} (${x.matching['sts|768'].danish_bias.in_sd_of_diff} sd)`],
  ['Translation pairs (35): mean / min / translation is NN', (x) => { const t = x.matching['sts|768'].translations; return `${t.mean} / ${t.min} / ${t.rank1_rate}`; }],
  ['Weakest translations', (x) => x.matching['sts|768'].translations.weakest.slice(0, 4).map((t) => `${t.a}~${t.b} ${t.s}`).join('; ')],
  ['Top-3 wrong pairs', (x) => x.matching['sts|768'].top_wrong_pairs.slice(0, 3).map((t) => `${t.a}~${t.b} ${t.s}`).join('; ')],
  ['**Mean-centring re-check (sts 768)**'],
  ['Pair AUC raw / global / per-language', (x) => ['raw', 'global', 'per_language'].map((k) => x.centering['sts|768'][k].auc).join(' / ')],
  ['LOO recall at P≥0.95 raw / global / per-language', (x) => ['raw', 'global', 'per_language'].map((k) => x.centering['sts|768'][k].at_p95?.r).join(' / ')],
  ['NN top-1 raw / global / per-language', (x) => ['raw', 'global', 'per_language'].map((k) => x.centering['sts|768'][k].loo_top1_nn).join(' / ')],
  ['**Sensitive detector (margin = max cos to sensitive prototypes − max cos to hobby anchors)**'],
  ['Test split: sensitive / non-sensitive / ambiguous (reported separately)', (x) => { const d = x.detector['sts|768|raw']; return `${d.n_pos} / ${d.n_neg} / ${d.n_amb}`; }],
  ['classification 768: margin AUC [bootstrap 90%]', (x) => `${x.detector['classification|768|raw'].auc_margin} [${x.bootstrap['detector_recall100|classification|768|raw'].auc_margin.filter((_, i) => i !== 1).join('–')}]`],
  ['  100% recall: threshold → P, FP/112', (x) => { const a = x.detector['classification|768|raw'].recall100; return `${a.t} → ${a.p}, ${a.fp}`; }],
  ['  ≥95% recall: threshold → P, FP, missed', (x) => { const d = x.detector['classification|768|raw']; return `${d.recall95.t} → ${d.recall95.p}, ${d.recall95.fp}, ${d.false_negatives_at_recall95.join(', ')}`; }],
  ['sts 768: margin AUC [bootstrap 90%]', (x) => `${x.detector['sts|768|raw'].auc_margin} [${x.bootstrap['detector_recall100|sts|768|raw'].auc_margin.filter((_, i) => i !== 1).join('–')}]`],
  ['  100% recall: threshold → P, FP/112', (x) => { const a = x.detector['sts|768|raw'].recall100; return `${a.t} → ${a.p}, ${a.fp}`; }],
  ['  ≥95% recall: threshold → P, FP, missed', (x) => { const d = x.detector['sts|768|raw']; return `${d.recall95.t} → ${d.recall95.p}, ${d.recall95.fp}, ${d.false_negatives_at_recall95.join(', ')}`; }],
  ['  false-flag rate at 100% recall by tag language da / en (cls · sts)', (x) => ['classification', 'sts'].map((p) => { const f = x.detector[`${p}|768|raw`].fp_rate_by_language_at_recall100; return `${f.da.fp}/${f.da.n} / ${f.en.fp}/${f.en.n}`; }).join(' · ')],
  ['  FP at 100%-recall threshold −0.01', (x) => `cls ${x.detector['classification|768|raw'].recall100_minus['0.01'].fp} · sts ${x.detector['sts|768|raw'].recall100_minus['0.01'].fp}`],
  ['Out-of-bag recall at in-sample 100% threshold (cls / sts)', (x) => `${x.bootstrap['detector_recall100|classification|768|raw'].oob_recall_mean} / ${x.bootstrap['detector_recall100|sts|768|raw'].oob_recall_mean}`],
  ['  … with threshold −0.005 / −0.01 (sts)', (x) => Object.values(x.bootstrap['detector_recall100|sts|768|raw'].oob_recall_mean_with_buffer).join(' / ')],
  ['Hardest sensitive tags (sts)', (x) => x.detector['sts|768|raw'].hardest_sensitive.slice(0, 5).map((h) => `${h.t} ${h.margin}`).join('; ')],
  ['Most-flagged hobby tags (sts)', (x) => x.detector['sts|768|raw'].most_flagged_hobbies.slice(0, 5).map((h) => `${h.t} ${h.margin}`).join('; ')],
  ['**Online clustering (sts 768, 5 shuffles, raw cosine)**'],
  ['Lowest τ with B³ precision ≥ 0.95', (x, d) => d.online_tau_p95 && `**τ ${d.online_tau_p95.tau}**: ${d.online_tau_p95.n_clusters} clusters (${d.online_tau_p95.singletons} singletons), P ${d.online_tau_p95.p} R ${d.online_tau_p95.r} F1 ${d.online_tau_p95.f1}`],
  ['  mixed sensitive/non-sensitive clusters', (x, d) => d.online_tau_p95?.mixed],
  ['  clusters at τ−0.02 / τ+0.02 (τ sensitivity)', (x, d) => d.online_tau_p95 && `${d.online_tau_p95.clusters_at_tau_minus_0_02} / ${d.online_tau_p95.clusters_at_tau_plus_0_02}`],
  ['  with detector guard (never merge across detector flag; each run\'s lowest-FP detector at its 100%-recall margin): leaking clusters / over-protective mixed', (x) => { const c = x.clustering['sts|768|guarded'].find((c) => c.tau === x.clustering['sts|768'].find((c) => c.b3_concept.p.mean >= 0.95).tau); return c && `${c.unsafe_mixed_clusters.mean} / ${c.mixed_sensitive_clusters.mean} (guard: ${x.clustering_guard.detector} ≥ ${x.clustering_guard.margin_threshold})`; }],
  ['Best B³-F1 τ', (x, d) => `τ ${d.online_best_f1.tau}: ${d.online_best_f1.n_clusters} clusters, P ${d.online_best_f1.p} R ${d.online_best_f1.r} F1 ${d.online_best_f1.f1}, mixed ${d.online_best_f1.mixed}`],
  ['Clusters at τ 0.85 (v1 operating point)', (x) => { const c = x.clustering['sts|768'].find((c) => c.tau === 0.85); return `${c.n_clusters.mean} (P ${c.b3_concept.p.mean} R ${c.b3_concept.r.mean})`; }],
  ['Globally centred: lowest τ with B³ P ≥ 0.95', (x, d) => d.centered_tau_p95 && `τ ${d.centered_tau_p95.tau}: ${d.centered_tau_p95.n_clusters} clusters, P ${d.centered_tau_p95.p} R ${d.centered_tau_p95.r}, mixed ${d.centered_tau_p95.mixed}; τ±0.025 → ${d.centered_tau_p95.clusters_at_tau_minus_0_025} / ${d.centered_tau_p95.clusters_at_tau_plus_0_025}`],
  ['Anisotropy: cos(tag, global mean direction) p50 / max', (x) => `${x.anisotropy['sts|768'].cos_to_global_mean.p50} / ${x.anisotropy['sts|768'].cos_to_global_mean.max}`],
  ['**Quantisation fidelity (vs same model fp32)**'],
  ['Vector cosine to fp32, sts: mean / min', (x) => { const k = Object.keys(x.dtype_agreement).find((k) => k.endsWith('|sts')); return k ? `${x.dtype_agreement[k].mean} / ${x.dtype_agreement[k].min}` : '–'; }],
  ['Pairwise-score drift vs fp32: mean / p95 of abs Δcos (in sd of unrelated)', (x) => { const k = Object.keys(x.dtype_agreement).find((k) => k.startsWith('pairwise')); const a = x.dtype_agreement[k]; return k ? `${a.mean_abs} / ${a.p95_abs} (${a.mean_abs_in_sd_of_unrelated} / ${a.p95_abs_in_sd_of_unrelated})` : '–'; }],
];
const header = `| Metric | ${runs.map(name).join(' | ')} |\n|---|${runs.map(() => '---').join('|')}|\n`;
const body = rows.map(([label, f]) => (f ? `| ${label} | ${runs.map((r) => String(g(r, f)).replace(/\|/g, '\\|')).join(' | ')} |` : `| ${label} | ${runs.map(() => '').join(' | ')} |`)).join('\n');
const bootMd = Object.entries(boot).map(([k, v]) => `\n**Paired bootstrap, ${k}** (${B} concept resamples; mean Δ [90% interval], share of resamples with Δ>0)\n\n| Δ metric | mean | 90% interval | P(Δ>0) |\n|---|---|---|---|\n` +
  Object.entries(v).map(([m, s]) => `| ${m} | ${s.mean} | ${s.ci90.join(' … ')} | ${s.p_gt_0} |`).join('\n')).join('\n');
const md = `<!-- generated by scripts/compare.mjs; do not edit by hand -->\n${header}${body}\n${bootMd}\n`;
for (const r of runs) { delete derived[r]._R; delete derived[r]._V; delete derived[r]._loo; }
const outName = (process.argv.find((a, i) => process.argv[i - 1] === '--out')) ?? 'comparison';
writeFileSync(new URL(`../results/${outName}.md`, import.meta.url), md);
writeFileSync(new URL(`../results/${outName}.json`, import.meta.url), stringifyCompact({ baseline: base, others, derived, paired_bootstrap: boot }, 3));
console.log(md);
