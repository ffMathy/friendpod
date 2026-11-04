// Shared metric code for analyze.mjs / compare.mjs. Pure functions over unit vectors; no model loading.
import { readFileSync } from 'node:fs';
import { tags, prototypes, negativeAnchors } from '../data/testset.mjs';

export const OUT = new URL('../out/', import.meta.url).pathname;
export const r3 = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : +x.toFixed(3));
export const r4 = (x) => +x.toFixed(4);
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
export const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
export const quant = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const normalize = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s); const o = new Float32Array(v.length); for (let i = 0; i < v.length; i++) o[i] = v[i] / s; return o; };
export const range = (lo, hi, step) => { const o = []; for (let k = 0; lo + k * step <= hi + 1e-9; k++) o.push(+(lo + k * step).toFixed(3)); return o; };
export const summ = (a) => ({ n: a.length, mean: r3(mean(a)), sd: r3(std(a)), p05: r3(quant(a, 0.05)), p50: r3(quant(a, 0.5)), p95: r3(quant(a, 0.95)) });
export const prf = (tp, fp, fn) => { const p = tp / (tp + fp || 1), r = tp / (tp + fn || 1); return { p: r3(p), r: r3(r), f1: r3((2 * p * r) / (p + r || 1)) }; };
export function auc(pos, neg) { // Mann-Whitney U with tie handling
  const all = [...pos.map((s) => [s, 1]), ...neg.map((s) => [s, 0])].sort((a, b) => a[0] - b[0]);
  let rp = 0;
  for (let i = 0; i < all.length;) {
    let j = i; while (j < all.length && all[j][0] === all[i][0]) j++;
    const avg = (i + j + 1) / 2; for (let k = i; k < j; k++) if (all[k][1]) rp += avg; i = j;
  }
  return (rp - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}
// Pretty-print the top `depth` levels, one line per deeper value: readable, diff-friendly and compact.
export function stringifyCompact(v, depth = 2, ind = '') {
  if (depth === 0 || v === null || typeof v !== 'object') return JSON.stringify(v);
  const pad = ind + ' ', isArr = Array.isArray(v);
  const items = isArr ? v.map((x) => pad + stringifyCompact(x, depth - 1, pad)) : Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${pad}${JSON.stringify(k)}: ${stringifyCompact(x, depth - 1, pad)}`);
  return items.length ? `${isArr ? '[' : '{'}\n${items.join(',\n')}\n${ind}${isArr ? ']' : '}'}` : (isArr ? '[]' : '{}');
}
export function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }

// ---------------- embeddings ----------------
export function loadRun(run) { // run = "v2:q4"
  const [key, dtype] = run.split(':');
  const meta = JSON.parse(readFileSync(`${OUT}emb_${key}_${dtype}.meta.json`, 'utf8'));
  const b = readFileSync(`${OUT}emb_${key}_${dtype}.bin`);
  const E = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
  const tIdx = new Map(meta.texts.map((t, i) => [t, i]));
  const cache = new Map();
  // Matryoshka: first `dim` components, then L2 re-normalise (model-card instruction for both v1 and v2).
  function vec(prompt, text, dim = 768) {
    const k = `${prompt}|${text}|${dim}`; if (cache.has(k)) return cache.get(k);
    const pi = meta.prompts.indexOf(prompt), ti = tIdx.get(text);
    if (pi < 0 || ti === undefined) throw new Error(`missing ${prompt}/${text}`);
    const off = (pi * meta.texts.length + ti) * meta.dim;
    const v = normalize(E.subarray(off, off + dim)); cache.set(k, v); return v;
  }
  const tagVecs = (prompt, dim) => tags.map((x) => vec(prompt, x.t, dim));
  return { run, key, dtype, meta, vec, tagVecs };
}

// ---------------- test-set helpers ----------------
export const N = tags.length;
export const conceptOf = tags.map((x) => x.c);
export const byConcept = (() => { const m = new Map(); tags.forEach((x, i) => { if (!m.has(x.c)) m.set(x.c, []); m.get(x.c).push(i); }); return m; })();
export const conceptSensitive = (() => { const m = new Map(); for (const [c, idx] of byConcept) m.set(c, idx.some((i) => !!tags[i].s)); return m; })();
export const isSens = (i) => !!tags[i].s;
export const TRANSLATIONS = [['cooking', 'madlavning'], ['baking', 'bagning'], ['board games', 'brætspil'], ['video games', 'computerspil'], ['running', 'løb'], ['hiking', 'vandring'], ['climbing', 'klatring'], ['book club', 'bogklub'], ['knitting', 'strikning'], ['crochet', 'hækling'], ['dogs', 'hundeejer'], ['photography', 'fotografering'], ['wine tasting', 'vinsmagning'], ['winter swimming', 'vinterbadning'], ['gardening', 'havearbejde'], ['cycling', 'cykling'], ['soccer', 'fodbold'], ['choir singing', 'korsang'], ['playing guitar', 'spille guitar'], ['new parent', 'nybagt mor'], ['on paternity leave', 'far på barsel'], ['volunteering', 'frivilligt arbejde'], ['language exchange', 'sprogcafé'], ['healthy eating', 'sund kost'], ['pregnant', 'gravid'], ['christian', 'kristen'], ['gay', 'bøsse'], ['lesbian', 'lesbisk'], ['trade union', 'fagforening'], ['Somali community', 'somalisk fællesskab'], ['anxiety', 'angst'], ['cancer survivor', 'kræftoverlever'], ['fertility treatment', 'fertilitetsbehandling'], ['sober', 'ædru'], ['wheelchair user', 'kørestolsbruger']];
const tagIndex = new Map(tags.map((x, i) => [x.t, i]));

// ---------------- (1) pairwise statistics ----------------
export function pairStats(V, { detail = false } = {}) {
  const same = [], diff = [], sameX = [], related = [], unrelated = [], lang = {};
  const wrong = [], lowSame = [], crossSens = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const s = dot(V[i], V[j]), a = tags[i], b = tags[j];
    const lp = (a.c === b.c ? 'same ' : 'diff ') + [a.l, b.l].sort().join('-');
    (lang[lp] ??= []).push(s);
    if (a.c === b.c) { same.push(s); if (a.l !== b.l && a.l !== 'x' && b.l !== 'x') sameX.push(s); if (detail) lowSame.push([s, i, j]); }
    else {
      diff.push(s); (a.f === b.f ? related : unrelated).push(s);
      if (detail) { wrong.push([s, i, j]); if (isSens(i) !== isSens(j)) crossSens.push([s, i, j]); }
    }
  }
  const langMeans = Object.fromEntries(Object.entries(lang).filter(([k]) => /(da-da|da-en|en-en)$/.test(k)).map(([k, v]) => [k, r3(mean(v))]));
  const sdDiff = std(diff);
  const out = {
    auc: r3(auc(same, diff)), auc_crosslingual: r3(auc(sameX, diff)), auc_family_vs_unrelated: r3(auc(related, unrelated)),
    same: summ(same), same_crosslingual: summ(sameX), diff: summ(diff), diff_same_family: summ(related),
    lang_means: langMeans,
    danish_bias: { diff_dada_minus_enen: r3(langMeans['diff da-da'] - langMeans['diff en-en']), in_sd_of_diff: r3((langMeans['diff da-da'] - langMeans['diff en-en']) / sdDiff) },
  };
  if (detail) {
    const fmt = ([s, i, j]) => ({ s: r3(s), a: tags[i].t, ac: tags[i].c, b: tags[j].t, bc: tags[j].c });
    out.top_wrong_pairs = wrong.sort((x, y) => y[0] - x[0]).slice(0, 25).map(fmt);
    out.lowest_same_concept_pairs = lowSame.sort((x, y) => x[0] - y[0]).slice(0, 15).map(fmt);
    out.top_cross_sensitivity_pairs = crossSens.sort((x, y) => y[0] - x[0]).slice(0, 15).map(fmt);
    out.cross_sensitivity_pairs_sorted = crossSens.map((x) => x[0]); // used for counts above thresholds, stripped before save
    const trs = TRANSLATIONS.map(([a, b]) => {
      const ia = tagIndex.get(a), ib = tagIndex.get(b), s = dot(V[ia], V[ib]);
      // rank of the translation among all other tags, seen from the Danish side (1 = nearest neighbour)
      const rank = 1 + tags.filter((_, k) => k !== ib && k !== ia && dot(V[ib], V[k]) > s).length;
      return { a, b, s: r3(s), rank_from_da: rank };
    }).sort((x, y) => x.s - y.s);
    out.translations = { n: trs.length, mean: r3(mean(trs.map((x) => x.s))), min: trs[0].s, rank1_rate: r3(trs.filter((x) => x.rank_from_da === 1).length / trs.length), median_rank: quant(trs.map((x) => x.rank_from_da), 0.5), weakest: trs.slice(0, 10), all: trs };
  }
  return out;
}

// ---------------- (2) leave-one-out assignment to concept centroids ----------------
// Each tag is removed from its concept; it is assigned to the concept with the highest centroid cosine.
// A merge at threshold t happens when that best score >= t. Correct merge = right concept (needs >=1 other member).
export function looAssign(V) {
  const dim = V[0].length, sums = new Map();
  for (const [c, idx] of byConcept) { const s = new Float64Array(dim); for (const k of idx) for (let d = 0; d < dim; d++) s[d] += V[k][d]; sums.set(c, s); }
  return tags.map((x, i) => {
    let best = -2, bestC = null, nnS = -2, nnC = null;
    for (const [c, idx] of byConcept) {
      const n = idx.length - (c === x.c ? 1 : 0); if (!n) continue;
      const s = sums.get(c), cen = new Float32Array(dim);
      for (let d = 0; d < dim; d++) cen[d] = s[d] - (c === x.c ? V[i][d] : 0);
      const sc = dot(V[i], normalize(cen)); if (sc > best) { best = sc; bestC = c; }
    }
    for (let k = 0; k < N; k++) if (k !== i) { const s2 = dot(V[i], V[k]); if (s2 > nnS) { nnS = s2; nnC = tags[k].c; } }
    const hasHome = byConcept.get(x.c).length > 1;
    return { i, hasHome, s: best, c: bestC, ok: bestC === x.c, nnOk: nnC === x.c, crossSens: isSens(i) !== conceptSensitive.get(bestC) };
  });
}
export function assignAt(loo, t) {
  const merges = loo.filter((r) => r.s >= t), good = merges.filter((r) => r.ok && r.hasHome).length;
  const homes = loo.filter((r) => r.hasHome).length, singles = loo.filter((r) => !r.hasHome);
  return { t, ...prf(good, merges.length - good, homes - good), merges: merges.length, wrong_merges: merges.length - good,
    cross_sensitivity_merges: merges.filter((r) => r.crossSens).length,
    singleton_new_rate: r3(singles.filter((r) => r.s < t).length / (singles.length || 1)) };
}
// Lowest threshold from which precision stays >= target at every higher grid point that still has >= 5 merges.
export function thresholdForPrecision(loo, grid, target) {
  let ok = null;
  for (let k = grid.length - 1; k >= 0; k--) {
    const a = assignAt(loo, grid[k]);
    if (a.merges < 5) continue;
    if (a.p >= target) ok = grid[k]; else break;
  }
  return ok === null ? null : assignAt(loo, ok);
}
export function looSummary(loo, grid, sweepGrid) {
  let best = { f1: -1 };
  for (const t of grid) { const a = assignAt(loo, t); if (a.f1 > best.f1) best = a; }
  const homes = loo.filter((r) => r.hasHome);
  return {
    loo_top1_centroid: r3(homes.filter((r) => r.ok).length / homes.length),
    loo_top1_nn: r3(homes.filter((r) => r.nnOk).length / homes.length),
    best_f1: best, at_p95: thresholdForPrecision(loo, grid, 0.95), at_p90: thresholdForPrecision(loo, grid, 0.9),
    ...(sweepGrid ? { sweep: sweepGrid.map((t) => assignAt(loo, t)) } : {}),
  };
}
// "Did you mean" band: tags whose best centroid score is in [lo, hi). Precision = share whose suggested concept is right.
export function bandStats(loo, lo, hi) {
  const inBand = loo.filter((r) => r.s >= lo && r.s < hi), good = inBand.filter((r) => r.ok && r.hasHome).length;
  const homes = loo.filter((r) => r.hasHome).length;
  return { lo, hi, n: inBand.length, precision: r3(good / (inBand.length || 1)), share_of_tags: r3(inBand.length / loo.length),
    recall_merge_plus_band: r3(loo.filter((r) => r.s >= lo && r.ok && r.hasHome).length / homes), cross_sensitivity_suggestions: inBand.filter((r) => r.crossSens).length };
}

// ---------------- (3) sensitive detector ----------------
export const protoList = Object.entries(prototypes).flatMap(([cat, ps]) => ps.map((t) => ({ t, cat })));
export function detectorRows(R, prompt, dim, centered) {
  const T = tags.map((x) => R.vec(prompt, x.t, dim));
  let f = (v) => v;
  if (centered) { // global mean of the tag corpus, subtracted from tags, prototypes and anchors alike
    const mu = new Float32Array(dim); for (const v of T) for (let d = 0; d < dim; d++) mu[d] += v[d] / T.length;
    f = (v) => normalize(v.map((x, d) => x - mu[d]));
  }
  const P = protoList.map((p) => ({ ...p, v: f(R.vec(prompt, p.t, dim)) }));
  const A = negativeAnchors.map((t) => ({ t, v: f(R.vec(prompt, t, dim)) }));
  return tags.map((x, i) => {
    const v = f(T[i]);
    let best = -2, cat = null, proto = null;
    for (const p of P) { const s = dot(v, p.v); if (s > best) { best = s; cat = p.cat; proto = p.t; } }
    let neg = -2, anchor = null;
    for (const a of A) if (a.t.toLowerCase() !== x.t.toLowerCase()) { const s = dot(v, a.v); if (s > neg) { neg = s; anchor = a.t; } } // never compare a tag with itself
    return { i, t: x.t, s: x.s, amb: x.amb, want: x.flag ?? !!x.s, score: best, cat, proto, anchor, margin: best - neg };
  });
}
export function detectorSummary(rows, step = 0.001, { detail = false } = {}) {
  const clear = rows.filter((r) => !r.amb), pos = clear.filter((r) => r.s), neg = clear.filter((r) => !r.s), amb = rows.filter((r) => r.amb);
  const at = (t, key = 'margin') => {
    const tp = pos.filter((r) => r[key] >= t).length, fp = neg.filter((r) => r[key] >= t).length;
    return { t: r3(t), ...prf(tp, fp, pos.length - tp), fp, fn: pos.length - tp };
  };
  // highest grid value (multiple of `step`) that still gives recall >= target  (same rule as v1, finer grid)
  const thrFor = (target, key = 'margin') => {
    const ps = pos.map((r) => r[key]).sort((a, b) => a - b), k = Math.floor((1 - target) * ps.length + 1e-9);
    return Math.floor(ps[k] / step + 1e-9) * step;
  };
  const t100 = thrFor(1.0), t95 = thrFor(0.95), s100 = thrFor(1.0, 'score');
  const o = {
    n_pos: pos.length, n_neg: neg.length, n_amb: amb.length,
    auc_margin: r3(auc(pos.map((r) => r.margin), neg.map((r) => r.margin))), auc_score: r3(auc(pos.map((r) => r.score), neg.map((r) => r.score))),
    margin_spread: { pos_p50: r3(quant(pos.map((r) => r.margin), 0.5)), neg_p50: r3(quant(neg.map((r) => r.margin), 0.5)), neg_sd: r3(std(neg.map((r) => r.margin))) },
    recall100: at(t100), recall95: at(t95), score_only_recall100: at(s100, 'score'),
    // safety buffers below the in-sample recall-100 threshold (in-sample tuning is optimistic, see bootstrap)
    recall100_minus: Object.fromEntries([0.005, 0.01, 0.02].map((b) => [b, (({ t, p, fp }) => ({ t, p, fp }))(at(t100 - b))])),
    top_category_accuracy: r3(pos.filter((r) => r.cat === r.s || (r.s === 'genetic' && r.cat === 'health')).length / pos.length),
    amb_agreement_at_recall100: r3(amb.filter((r) => r.want === r.margin >= t100).length / amb.length),
    // false-flag rate of non-sensitive tags per tag language at the recall-100 threshold (da | en | x = names)
    fp_rate_by_language_at_recall100: Object.fromEntries(['da', 'en', 'x'].map((L) => { const n = neg.filter((r) => tags[r.i].l === L); return [L, { fp: n.filter((r) => r.margin >= t100).length, n: n.length, rate: r3(n.filter((r) => r.margin >= t100).length / n.length) }]; })),
  };
  if (detail) {
    o.false_positives_at_recall100 = neg.filter((r) => r.margin >= t100).sort((a, b) => b.margin - a.margin).map((r) => `${r.t} (${r3(r.margin)}, ${r.cat})`);
    o.false_negatives_at_recall95 = pos.filter((r) => r.margin < t95).map((r) => r.t);
    o.hardest_sensitive = [...pos].sort((a, b) => a.margin - b.margin).slice(0, 8).map((r) => ({ t: r.t, s: r.s, margin: r3(r.margin), proto: r.proto, anchor: r.anchor }));
    o.most_flagged_hobbies = [...neg].sort((a, b) => b.margin - a.margin).slice(0, 12).map((r) => ({ t: r.t, margin: r3(r.margin), proto: r.proto, anchor: r.anchor }));
    o.ambiguous = amb.map((r) => ({ t: r.t, want: r.want, margin: r3(r.margin), flagged_at_recall100: r.margin >= t100 }));
  }
  return o;
}

// ---------------- (4) online clustering ----------------
// Tags arrive in random order; each joins the nearest running centroid if cosine >= tau, else starts a new cluster.
// guard (optional): array of booleans (detector flag per tag); a tag may only join a cluster with the same flag.
export function onlineCluster(V, tau, seed, guard = null) {
  const r = rng(seed), order = tags.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const dim = V[0].length, clusters = [];
  for (const i of order) {
    let best = -2, bc = null;
    for (const c of clusters) { if (guard && guard[i] !== c.flag) continue; const s = dot(V[i], c.cent); if (s > best) { best = s; bc = c; } }
    if (bc && best >= tau) { bc.members.push(i); for (let d = 0; d < dim; d++) bc.sum[d] += V[i][d]; bc.cent = normalize(bc.sum); }
    else clusters.push({ sum: Float32Array.from(V[i]), cent: Float32Array.from(V[i]), members: [i], flag: guard ? guard[i] : null });
  }
  const lab = new Array(N); clusters.forEach((c, k) => c.members.forEach((m) => { lab[m] = k; }));
  const bc = (key) => {
    let P = 0, R = 0;
    for (let i = 0; i < N; i++) {
      const sameC = clusters[lab[i]].members, inter = sameC.filter((j) => tags[j][key] === tags[i][key]).length;
      const sameL = tags.filter((x) => x[key] === tags[i][key]).length;
      P += inter / sameC.length; R += inter / sameL;
    }
    P /= N; R /= N; return { p: P, r: R, f1: (2 * P * R) / (P + R) };
  };
  const mixed = clusters.filter((c) => new Set(c.members.map(isSens)).size > 1);
  // with a guard, a mixed cluster is only a LEAK if the cluster is treated as non-sensitive (flag false) yet holds a
  // truly sensitive tag; flag-true mixed clusters are over-protection of a non-sensitive tag.
  const unsafe = guard ? clusters.filter((c) => !c.flag && c.members.some(isSens) && c.members.length > 1) : mixed;
  return { n_clusters: clusters.length, singletons: clusters.filter((c) => c.members.length === 1).length,
    b3_concept: bc('c'), b3_family: bc('f'), mixed: mixed.map((c) => c.members.map((m) => tags[m].t)), unsafe: unsafe.map((c) => c.members.map((m) => tags[m].t)),
    clusters: clusters.map((c) => c.members.map((m) => tags[m].t)).sort((a, b) => b.length - a.length) };
}
export function clusterAgg(V, tau, seeds = [1, 2, 3, 4, 5], guard = null) {
  const runs = seeds.map((s) => onlineCluster(V, tau, s, guard));
  const ms = (f) => { const a = runs.map(f); return { mean: r3(mean(a)), sd: r3(std(a)) }; };
  return { tau, seeds: seeds.length, n_clusters: ms((r) => r.n_clusters), singletons: ms((r) => r.singletons),
    b3_concept: { p: ms((r) => r.b3_concept.p), r: ms((r) => r.b3_concept.r), f1: ms((r) => r.b3_concept.f1) },
    b3_family: { p: ms((r) => r.b3_family.p), r: ms((r) => r.b3_family.r), f1: ms((r) => r.b3_family.f1) },
    mixed_sensitive_clusters: ms((r) => r.mixed.length), ...(guard ? { unsafe_mixed_clusters: ms((r) => r.unsafe.length), unsafe_examples_seed1: runs[0].unsafe } : {}), _runs: runs };
}

// ---------------- (5) concept-level bootstrap (resample concepts with replacement) ----------------
export const conceptIds = [...byConcept.keys()];
export function bootstrapSample(r) {
  const picked = conceptIds.map(() => conceptIds[Math.floor(r() * conceptIds.length)]);
  const inBag = new Set(picked);
  return { idx: picked.flatMap((c) => byConcept.get(c)), oob: conceptIds.filter((c) => !inBag.has(c)).flatMap((c) => byConcept.get(c)) };
}
