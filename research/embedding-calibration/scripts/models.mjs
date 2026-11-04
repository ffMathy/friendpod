// Model registry + one shared loader, so the v1 and v2 runs go through exactly the same code path.
// Models are read from ./models/<id>/ (fetched by scripts/download-model.sh at the pinned revision);
// remote loading is disabled so a run can never silently pull a different revision.
import { AutoConfig, AutoModel, AutoTokenizer, env } from '@huggingface/transformers';

export const MODELS = {
  v1: {
    id: 'onnx-community/embeddinggemma-300m-ONNX',
    revision: '5090578d9565bb06545b4552f76e6bc2c93e4a66',
    base: 'google/embeddinggemma-300m',
    licence: 'Gemma Terms of Use (https://ai.google.dev/gemma/terms); base repo is gated on HF',
    textOnlyConfig: false,
  },
  v2: {
    id: 'onnx-community/embeddinggemma-2-ONNX',
    revision: 'daa72c51243991dfcaf9f9137d2c573d8f7790c0',
    base: 'google/embeddinggemma-2@f9972ac22e696a105c482202646979e33e4b5a1e',
    licence: 'Apache-2.0 (https://ai.google.dev/gemma/docs/gemma_4_license); not gated',
    // Model card, "Selective Encoder Loading": drop the vision/audio encoder configs for a text-only model (270M).
    textOnlyConfig: true,
  },
};
export const ONNX_FILE = { fp32: 'onnx/model.onnx', q8: 'onnx/model_quantized.onnx', q4: 'onnx/model_q4.onnx' };

// Official EmbeddingGemma prompt templates (identical in v1 and v2) + one content template tried in v1.
export const PROMPTS = {
  none: '',
  clustering: 'task: clustering | query: ',
  sts: 'task: sentence similarity | query: ',
  classification: 'task: classification | query: ',
  search_query: 'task: search result | query: ',
  document: 'title: none | text: ',
  sts_group: 'task: sentence similarity | query: A group of people who share an interest in ',
};

export async function loadModel(key, dtype, threads) {
  const m = MODELS[key];
  if (!m) throw new Error(`unknown model key ${key}; use one of ${Object.keys(MODELS)}`);
  if (!ONNX_FILE[dtype]) throw new Error(`dtype ${dtype} not supported (fp16 is unsafe for EmbeddingGemma)`);
  env.allowRemoteModels = false;
  env.localModelPath = new URL('../models/', import.meta.url).pathname;
  const t0 = performance.now();
  const tokenizer = await AutoTokenizer.from_pretrained(m.id);
  const t1 = performance.now();
  const opts = { dtype, device: 'cpu' };
  if (threads) opts.session_options = { intraOpNumThreads: threads, interOpNumThreads: 1 };
  if (m.textOnlyConfig) {
    const config = await AutoConfig.from_pretrained(m.id);
    config.vision_config = config.audio_config = null; // text only
    opts.config = config;
  }
  const model = await AutoModel.from_pretrained(m.id, opts);
  const t2 = performance.now();

  // Both ONNX graphs return `sentence_embedding` = the sentence-transformers head already applied
  // (v1: mean pool -> Dense 768->3072 -> Dense 3072->768 -> L2 norm; v2: mean pool (incl. prompt tokens)
  // -> 512->768 projection -> L2 norm). We still re-normalise defensively and record the raw norms.
  const norms = [];
  async function embed(texts, prefix = '') {
    const inputs = await tokenizer(texts.map((t) => prefix + t), { padding: true, truncation: true, max_length: 2048 });
    const { sentence_embedding } = await model(inputs);
    const [n, d] = sentence_embedding.dims;
    const data = sentence_embedding.data;
    const out = [];
    for (let i = 0; i < n; i++) {
      const v = data.slice(i * d, (i + 1) * d);
      let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s);
      if (!Number.isFinite(s) || s === 0) throw new Error(`non-finite embedding for "${texts[i]}" (NaN guard)`);
      norms.push(s);
      for (let j = 0; j < d; j++) v[j] /= s;
      out.push(v);
    }
    return out;
  }
  return {
    ...m, key, dtype, threads: threads ?? 'default', tokenizer, model, embed, norms,
    load_ms: { tokenizer: +(t1 - t0).toFixed(0), model: +(t2 - t1).toFixed(0) },
    sessions: Object.keys(model.sessions ?? {}),
  };
}

export const hwmMB = async () => {
  const { readFileSync } = await import('node:fs');
  return Number(/VmHWM:\s+(\d+)/.exec(readFileSync('/proc/self/status', 'utf8'))[1]) / 1024;
};
export const rssMB = () => process.memoryUsage().rss / 2 ** 20;
