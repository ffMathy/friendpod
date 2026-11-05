/**
 * The one place for the embedding model and every model-specific number (DESIGN.md §5.1, §5.2), shared by the app,
 * which embeds every tag on the device (D1), and the server, which checks and stores what the app sends.
 * Thresholds hold only for one model revision, dtype, prompt and dimension [CAL]: switching models means
 * re-calibrating, a new `modelKey` for every client at once, and re-embedding every stored tag.
 */
import { DEFAULT_ASSIGN_THRESHOLDS, V1_ASSIGN_THRESHOLDS, type AssignThresholds } from './assign';
import eg2Json from './data/eg2-q4.model.json';

/** `modelKey` sent with every vector and stored on every tag doc; the server refuses any other (§5.1). */
export const EMBEDDING_MODEL_ID = 'eg2-q4@daa72c5';
/** The calibrated fallback, EmbeddingGemma-300m q4 (§5.1). */
export const EMBEDDING_MODEL_ID_V1 = 'eg300m-q4@5090578';
export const EMBEDDING_DIM = 768;

/** EmbeddingGemma task prompts (model card). `task: clustering` is never used (§5.1). */
export const PROMPTS = {
  sts: 'task: sentence similarity | query: ',
  classification: 'task: classification | query: ',
} as const;

/** Detector margin threshold for EmbeddingGemma 2 q4 / STS prompt / 768-d: 100% recall on the labelled set [CAL]. */
export const DETECTOR_MARGIN_THRESHOLD = -0.03;

/**
 * Where a build fetches a pinned file: `hf` from the model's Hugging Face repo at the pinned revision (or the
 * MODEL_MIRROR_URL mirror), `mirror` only from the mirror (files we build ourselves, such as prototypes.bin).
 */
export type ModelFileSource = 'hf' | 'mirror';

/** A model file pinned by content. `device` files are bundled inside the app and checked with `sha256`. */
export interface PinnedModelFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly device: boolean;
  readonly source: ModelFileSource;
}

/**
 * Reads pins from `data/*.model.json` (JSON so the app's build scripts share them without TypeScript) and refuses a
 * malformed one at import, before anything is fetched or loaded against it.
 */
function parsePinnedFiles(name: string, files: readonly { path: string; sha256: string; bytes: number; device: boolean; source: string }[]): readonly PinnedModelFile[] {
  return files.map((f) => {
    if (!/^[0-9a-f]{64}$/.test(f.sha256)) throw new Error(`${name}: ${f.path} has no lower-case hex sha256`);
    if (!Number.isSafeInteger(f.bytes) || f.bytes <= 0) throw new Error(`${name}: ${f.path} has no byte size`);
    if (f.source !== 'hf' && f.source !== 'mirror') throw new Error(`${name}: ${f.path} has an unknown source ${f.source}`);
    if (f.path.startsWith('/') || f.path.split('/').includes('..')) throw new Error(`${name}: ${f.path} is not a relative path`);
    return { path: f.path, sha256: f.sha256, bytes: f.bytes, device: f.device, source: f.source };
  });
}

/** The ONNX graph contract the app feeds (research: on-device EmbeddingGemma 2, 2026-11-04). */
export interface EmbeddingGraph {
  readonly modelFile: string;
  readonly inputIds: 'input_ids';
  readonly attentionMask: 'attention_mask';
  /** Multimodal inputs that must be fed as empty float32 tensors of shape [0, 512]. */
  readonly emptyFeatureInputs: readonly string[];
  readonly emptyFeatureShape: readonly [0, 512];
  /** Mean-pooled, projected and L2-normalised in the graph; re-normalise defensively. */
  readonly output: 'sentence_embedding';
}

/**
 * The on-device runtime the thresholds were verified against. onnxruntime-react-native leaves its native core
 * unpinned, so the app pins it; contrib ops (MatMulNBits, GatherBlockQuantized, RotaryEmbedding) run only on the CPU EP.
 */
export interface DeviceRuntime {
  readonly npm: { readonly 'onnxruntime-react-native': string; readonly '@huggingface/tokenizers': string };
  readonly nativeOrt: string;
  readonly executionProviders: readonly ['cpu'];
  readonly graphOptimizationLevel: 'all';
  readonly intraOpNumThreads: number;
  /**
   * Where the bundled device files sit, relative to the app bundle (iOS resources, Android assets) and, on Android,
   * to the document directory they are copied to on first launch (assets are not file paths). Also the object
   * prefix in the EU models bucket. The build's source folder is `apps/mobile/assets/model/<last segment>/`.
   */
  readonly dir: string;
}

export interface EmbeddingModelConfig {
  readonly modelKey: string;
  readonly hfRepo: string;
  readonly revision: string;
  /** Never fp16 or q4f16: EmbeddingGemma activations overflow fp16 (NaN risk) [CAL]. */
  readonly dtype: 'q4';
  /** EmbeddingGemma 2 is multimodal; only the text encoder is used. */
  readonly textOnly: boolean;
  readonly files: readonly PinnedModelFile[];
  readonly dim: number;
  /** One STS embedding per tag serves matching and the detector (A3). */
  readonly tagPrompt: string;
  readonly detectorPrompt: string;
  readonly assign: AssignThresholds;
  /** A tag is flagged when margin >= this (§5.2 (5)). */
  readonly detectorMargin: number;
  readonly licence: string;
  readonly graph: EmbeddingGraph | null;
  readonly device: DeviceRuntime | null;
}

export const EMBEDDING_MODEL: EmbeddingModelConfig = {
  modelKey: EMBEDDING_MODEL_ID,
  hfRepo: eg2Json.hfRepo,
  revision: eg2Json.revision,
  dtype: 'q4',
  textOnly: true,
  files: parsePinnedFiles('data/eg2-q4.model.json', eg2Json.files),
  dim: EMBEDDING_DIM,
  tagPrompt: PROMPTS.sts,
  detectorPrompt: PROMPTS.sts,
  assign: DEFAULT_ASSIGN_THRESHOLDS,
  detectorMargin: DETECTOR_MARGIN_THRESHOLD,
  licence: 'Apache-2.0',
  graph: {
    modelFile: 'onnx/model_q4.onnx',
    inputIds: 'input_ids',
    attentionMask: 'attention_mask',
    emptyFeatureInputs: ['image_features', 'video_features', 'audio_features'],
    emptyFeatureShape: [0, 512],
    output: 'sentence_embedding',
  },
  device: {
    npm: { 'onnxruntime-react-native': '1.24.3', '@huggingface/tokenizers': '0.2.0' },
    nativeOrt: '1.30.0',
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    intraOpNumThreads: 2,
    dir: eg2Json.dir,
  },
};

/**
 * The calibrated fallback (§5.1, Q1): merge 0.86 / medoid 0.82, did-you-mean 0.78–0.86, `classification` detector.
 * Server-calibrated only; never verified on a device runtime.
 */
export const EMBEDDING_MODEL_V1: EmbeddingModelConfig = {
  modelKey: EMBEDDING_MODEL_ID_V1,
  hfRepo: 'onnx-community/embeddinggemma-300m-ONNX',
  revision: '5090578d9565bb06545b4552f76e6bc2c93e4a66',
  dtype: 'q4',
  textOnly: false,
  files: [
    { path: 'tokenizer.json', sha256: '4dda02faaf32bc91031dc8c88457ac272b00c1016cc679757d1c441b248b9c47', bytes: 20_323_312, device: true, source: 'hf' },
    { path: 'onnx/model_q4.onnx', sha256: 'ad1dfee81a70f7944b9b9d1cc6e48075b832881cf33fab2f2b248be78f3f0043', bytes: 519_322, device: true, source: 'hf' },
    { path: 'onnx/model_q4.onnx_data', sha256: '599962c3143b040de2dd05e5975be3e9091dd067cacc6a8f7186e3203bab9e02', bytes: 196_725_760, device: true, source: 'hf' },
  ],
  dim: EMBEDDING_DIM,
  tagPrompt: PROMPTS.sts,
  detectorPrompt: PROMPTS.classification,
  assign: V1_ASSIGN_THRESHOLDS,
  // [EXP]: −0.03 with the classification prompt gave 100% recall for v1 as well.
  detectorMargin: -0.03,
  licence: 'Gemma Terms of Use',
  graph: null,
  device: null,
};

/**
 * Golden test for a device build (research, "Does the phone output match the server?"): every reference text's
 * vector within this cosine of its calibration vector, and every pairwise score within `pairwiseAbs`.
 */
export const DEVICE_GOLDEN_TOLERANCE = { minCosine: 0.9999, pairwiseAbs: 0.001, texts: 50 } as const;

/** Text the model embeds for a tag: the STS prompt plus `normalizeTag().norm` (§5.1). */
export function embeddingInput(norm: string, model: EmbeddingModelConfig = EMBEDDING_MODEL): string {
  return model.tagPrompt + norm;
}

/** Maximum |‖v‖ − 1| accepted from a client vector. */
export const VECTOR_NORM_TOLERANCE = 1e-3;

export function vectorNorm(v: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  return Math.sqrt(s);
}

/** Finite, the model's dimension, and unit length within VECTOR_NORM_TOLERANCE. */
export function isModelVector(v: ArrayLike<number>, model: EmbeddingModelConfig = EMBEDDING_MODEL): boolean {
  if (v.length !== model.dim) return false;
  for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) return false;
  return Math.abs(vectorNorm(v) - 1) <= VECTOR_NORM_TOLERANCE;
}

/** Unit vector in the same direction; throws on a zero or non-finite vector rather than inventing one. */
export function renormalize(v: ArrayLike<number>): Float32Array {
  const n = vectorNorm(v);
  if (!(n > 0) || !Number.isFinite(n)) throw new Error('renormalize: zero or non-finite vector');
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

/** Device files only (the ones bundled in the app), smallest first, so a broken or incomplete copy fails fast. */
export function deviceModelFiles(model: EmbeddingModelConfig = EMBEDDING_MODEL): readonly PinnedModelFile[] {
  return model.files.filter((f) => f.device).sort((a, b) => a.bytes - b.bytes);
}

/** Input to `tagKey = sha256(modelId|768|sts|norm)` (§5.2 (3)); hashing happens server-side. */
export function tagKeyMaterial(norm: string, modelId: string = EMBEDDING_MODEL_ID): string {
  return `${modelId}|${EMBEDDING_DIM}|sts|${norm}`;
}
