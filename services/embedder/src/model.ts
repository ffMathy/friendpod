/**
 * Text embedding behind one interface (DESIGN.md §5.1, §5.2 (4)): the real EmbeddingGemma through
 * transformers.js, and a deterministic stub for tests.
 */
import { createHash } from 'node:crypto';
import type { ModelConfig } from './config';
import { dot, normalized, truncateNormalize } from './lib/vectors';

export interface Embedder {
  readonly modelId: string;
  /** Unit vectors of the configured dimension, one per text, each embedded as `prompt + text`. */
  embed(texts: readonly string[], prompt: string): Promise<Float32Array[]>;
  /** Loads the model if it is not loaded yet (the `items: []` warm-up, §10.2). */
  warm(): Promise<void>;
}

interface Loaded {
  readonly tokenizer: (texts: string[], opts: { padding: boolean; truncation: boolean }) => Promise<unknown>;
  readonly model: (inputs: unknown) => Promise<{ sentence_embedding: { dims: number[]; data: Float32Array } }>;
}

export interface TransformersEmbedderOptions {
  /** Directory holding `<hfRepo>/…` as written by scripts/fetch-model.mjs. */
  readonly modelDir: string;
  readonly threads: number;
  readonly onLoaded?: (ms: number) => void;
}

const BATCH = 32;

/**
 * EmbeddingGemma via @huggingface/transformers, CPU, local files only. Nothing is imported or loaded
 * until the first `embed`/`warm`, which the callable reaches only after Auth, App Check and the rate
 * limit (§7 Embedder), so unauthenticated traffic never pays for a model load.
 */
export class TransformersEmbedder implements Embedder {
  readonly modelId: string;
  #loading: Promise<Loaded> | null = null;
  readonly #config: ModelConfig;
  readonly #opts: TransformersEmbedderOptions;

  constructor(config: ModelConfig, opts: TransformersEmbedderOptions) {
    this.modelId = config.modelId;
    this.#config = config;
    this.#opts = opts;
  }

  async warm(): Promise<void> {
    await this.#load();
  }

  async embed(texts: readonly string[], prompt: string): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const { tokenizer, model } = await this.#load();
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH).map((t) => prompt + t);
      const inputs = await tokenizer(batch, { padding: true, truncation: true });
      const { sentence_embedding: emb } = await model(inputs);
      const [n, d] = emb.dims;
      if (n !== batch.length || d === undefined || d < this.#config.dim) throw new Error('unexpected embedding shape');
      for (let r = 0; r < n; r++) {
        // The graph output is already L2-normalized; truncation (if any) and the NaN guard re-normalize.
        out.push(truncateNormalize(emb.data.slice(r * d, (r + 1) * d), this.#config.dim));
      }
    }
    return out;
  }

  #load(): Promise<Loaded> {
    this.#loading ??= this.#doLoad().catch((err: unknown) => {
      // A failed load (e.g. a missing file) must not poison the instance for every later request.
      this.#loading = null;
      throw err;
    });
    return this.#loading;
  }

  async #doLoad(): Promise<Loaded> {
    const t0 = performance.now();
    const { AutoConfig, AutoModel, AutoTokenizer, env } = await import('@huggingface/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = this.#opts.modelDir;
    const { hfRepo, dtype, textOnly } = this.#config;
    const tokenizer = await AutoTokenizer.from_pretrained(hfRepo);
    const modelConfig = textOnly ? await AutoConfig.from_pretrained(hfRepo) : undefined;
    if (modelConfig) {
      // EmbeddingGemma 2 model card, "Selective Encoder Loading": text encoder only.
      Object.assign(modelConfig, { vision_config: null, audio_config: null });
    }
    const model = await AutoModel.from_pretrained(hfRepo, {
      dtype,
      device: 'cpu',
      ...(modelConfig ? { config: modelConfig } : {}),
      session_options: { intraOpNumThreads: this.#opts.threads, interOpNumThreads: 1 },
    });
    this.#opts.onLoaded?.(performance.now() - t0);
    return { tokenizer: tokenizer as unknown as Loaded['tokenizer'], model: model as unknown as Loaded['model'] };
  }
}

export interface StubLink {
  /** Another text whose vector this one is pulled towards. */
  readonly to: string;
  /** Exact cosine to the vector of `to`. */
  readonly cos: number;
}

/**
 * Deterministic stand-in for tests. Each text gets a pseudo-random unit vector seeded by its SHA-256.
 * A link `{to, cos}` rotates it so that cos(text, to) equals `cos` exactly, which lets a test place a
 * tag precisely relative to a concept's centroid or to a detector prototype. Prompts are recorded but
 * do not change vectors.
 */
export class StubEmbedder implements Embedder {
  readonly calls: { readonly texts: readonly string[]; readonly prompt: string }[] = [];
  warmups = 0;
  readonly modelId: string;
  readonly dim: number;
  readonly #links: ReadonlyMap<string, StubLink>;

  constructor(modelId: string, dim: number, links: Readonly<Record<string, StubLink>> = {}) {
    this.modelId = modelId;
    this.dim = dim;
    this.#links = new Map(Object.entries(links));
  }

  async warm(): Promise<void> {
    this.warmups += 1;
  }

  async embed(texts: readonly string[], prompt: string): Promise<Float32Array[]> {
    this.calls.push({ texts: [...texts], prompt });
    return texts.map((t) => this.vector(t));
  }

  vector(text: string, depth = 0): Float32Array {
    if (depth > 8) throw new Error('StubEmbedder: link chain too deep');
    const base = seededUnitVector(text, this.dim);
    const link = this.#links.get(text);
    if (!link) return base;
    if (!(link.cos > -1 && link.cos <= 1)) throw new Error('StubEmbedder: cos must be in (-1, 1]');
    const anchor = this.vector(link.to, depth + 1);
    // Gram-Schmidt: the part of `base` orthogonal to `anchor`, then mix to the requested angle.
    const along = dot(base, anchor);
    const ortho = normalized(base.map((x, i) => x - along * anchor[i]!));
    const sin = Math.sqrt(Math.max(0, 1 - link.cos * link.cos));
    return normalized(anchor.map((a, i) => link.cos * a + sin * ortho[i]!));
  }
}

function seededUnitVector(text: string, dim: number): Float32Array {
  const seed = createHash('sha256').update(text).digest();
  // xorshift128 seeded from the digest, Box-Muller for Gaussian components.
  let a = seed.readUInt32LE(0) | 1;
  let b = seed.readUInt32LE(4);
  let c = seed.readUInt32LE(8);
  let d = seed.readUInt32LE(12);
  const next = (): number => {
    const t = a ^ (a << 11);
    a = b;
    b = c;
    c = d;
    d = (d ^ (d >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return (d + 1) / 4294967297;
  };
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i += 2) {
    const r = Math.sqrt(-2 * Math.log(next()));
    const theta = 2 * Math.PI * next();
    v[i] = r * Math.cos(theta);
    if (i + 1 < dim) v[i + 1] = r * Math.sin(theta);
  }
  return normalized(v);
}
