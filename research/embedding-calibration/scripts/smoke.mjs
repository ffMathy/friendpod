// Usage: node scripts/smoke.mjs <v1|v2> <q4|q8|fp32>
// Sanity checks before any calibration: which ONNX sessions load, output names, raw norms (are outputs
// already unit-norm?), single-vs-padded-batch consistency, and the model card's own text-search example
// (v2 card, q4 on WebGPU: full [0.684, 0.854, 0.752, 0.783]; 256d [0.706, 0.871, 0.775, 0.807]).
import { loadModel } from './models.mjs';
const [key = 'v2', dtype = 'q4'] = process.argv.slice(2);
const M = await loadModel(key, dtype);
const sess = M.model.sessions.model;
console.log(JSON.stringify({ key, dtype, sessions: M.sessions, inputs: sess?.inputNames, outputs: sess?.outputNames, load_ms: M.load_ms }));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const trunc = (v, d) => { const u = v.slice(0, d); const n = Math.sqrt(dot(u, u)); return u.map((x) => x / n); };

// raw output norms
const inp = await M.tokenizer(['task: sentence similarity | query: madlavning']);
console.log('token ids[0]', Array.from(inp.input_ids.data.slice(0, 20), Number));
const raw = (await M.model(await M.tokenizer(['task: sentence similarity | query: madlavning', 'x'], { padding: true }))).sentence_embedding;
const r0 = raw.data.slice(0, raw.dims[1]);
console.log('raw dims', raw.dims, 'raw norm', Math.sqrt(dot(r0, r0)).toFixed(6), 'finite', r0.every(Number.isFinite));

// single vs padded batch
const [a] = await M.embed(['madlavning'], 'task: sentence similarity | query: ');
const b = (await M.embed(['madlavning', 'a much longer interest tag that forces padding of the other row'], 'task: sentence similarity | query: '))[0];
console.log('single vs padded-batch cos', dot(a, b).toFixed(6));

// model card example
const q = 'task: search result | query: Which planet is known as the Red Planet?';
const docs = [
  "Venus is often called Earth's twin because of its similar size and proximity.",
  'Mars, known for its reddish appearance, is often referred to as the Red Planet.',
  'Jupiter, the largest planet in our solar system, has a prominent red spot.',
  'Saturn, famous for its rings, is sometimes mistaken for the Red Planet.',
].map((x) => 'title: none | text: ' + x);
const E = await M.embed([q, ...docs]);
console.log('card example 768d', E.slice(1).map((v) => dot(E[0], v).toFixed(3)).join(' '));
console.log('card example 256d', E.slice(1).map((v) => dot(trunc(E[0], 256), trunc(v, 256)).toFixed(3)).join(' '));
const P = 'task: sentence similarity | query: ';
const W = ['cooking', 'madlavning', 'brætspil', 'Fortnite', 'pregnant', 'gravid'];
const V = await M.embed(W, P);
console.log('sts pairs', [[0, 1], [1, 2], [0, 3], [4, 5]].map(([i, j]) => `${W[i]}~${W[j]}=${dot(V[i], V[j]).toFixed(3)}`).join('  '));
