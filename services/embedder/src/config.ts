/**
 * The one place for the embedding model and every model-specific number (DESIGN.md §5.1, §5.2).
 * Thresholds hold only for one model revision, dtype, prompt and dimension [CAL], so nothing else in
 * the embedder may hard-code them. Switching models means re-calibrating and re-embedding every tag
 * (§5.2 (8) "Model upgrade"); `modelId` in every cache key keeps vectors of different models apart.
 */
import {
  assertV2ThresholdFloors,
  DEFAULT_ASSIGN_THRESHOLDS,
  DETECTOR_MARGIN_THRESHOLD,
  EMBEDDING_DIM,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_ID_V1,
  V1_ASSIGN_THRESHOLDS,
  type AssignThresholds,
} from '@grouper/core';

/** EmbeddingGemma task prompts (model card). `task: clustering` is never used (§5.1). */
export const PROMPTS = {
  sts: 'task: sentence similarity | query: ',
  classification: 'task: classification | query: ',
} as const;

/** A model file pinned by content: LFS files by sha256, small git files by their git blob sha1. */
export type PinnedFile =
  | { readonly path: string; readonly sha256: string }
  | { readonly path: string; readonly gitBlobSha1: string };

export interface ModelConfig {
  /** `modelId` in every cache key and on every tag doc (§5.1). */
  readonly modelId: string;
  readonly hfRepo: string;
  readonly revision: string;
  /** Never fp16 or q4f16: EmbeddingGemma activations overflow fp16 (NaN risk) [CAL]. */
  readonly dtype: 'q4';
  /** EmbeddingGemma 2 is multimodal: null the vision/audio configs so only the text encoder loads. */
  readonly textOnly: boolean;
  readonly files: readonly PinnedFile[];
  /** Tags, concepts and prototypes (A2). The graph's output is already 768-d and L2-normalized. */
  readonly dim: number;
  readonly tagPrompt: string;
  /** v2 uses the tag prompt, so one embedding per tag serves matching and detection (A3). */
  readonly detectorPrompt: string;
  readonly assign: AssignThresholds;
  /** Flag as suspected when margin >= this (§5.2 (5) row 4). */
  readonly detectorMargin: number;
  readonly licence: string;
}

const V2: ModelConfig = {
  modelId: EMBEDDING_MODEL_ID,
  hfRepo: 'onnx-community/embeddinggemma-2-ONNX',
  revision: 'daa72c51243991dfcaf9f9137d2c573d8f7790c0',
  dtype: 'q4',
  textOnly: true,
  files: [
    { path: 'config.json', gitBlobSha1: 'b267dcb270ba41f67a8d14001bf470f23a9525fb' },
    { path: 'config_sentence_transformers.json', gitBlobSha1: 'ba7dd4d5481cbaf271d5e8d1ad4271c5a45d2fd7' },
    { path: 'tokenizer_config.json', gitBlobSha1: 'a9afd12fb3ca2c418fd405320ace85ad46748d03' },
    { path: 'tokenizer.json', sha256: '4d777ef5bdc1aa36227abdfb77c3e49e7b9c892d16e1b6bda41c393504828be4' },
    { path: 'onnx/model_q4.onnx', sha256: 'f9eeba97acddf139b8ee2ddf04bc30dceafa88de93fadf74d7644e0d61a477a9' },
    { path: 'onnx/model_q4.onnx_data', sha256: 'c3975f2d1ab7a1878ae31a7d7a9b7804a827aff3800b60dfceafce21cac3df49' },
  ],
  dim: EMBEDDING_DIM,
  tagPrompt: PROMPTS.sts,
  detectorPrompt: PROMPTS.sts,
  assign: DEFAULT_ASSIGN_THRESHOLDS,
  detectorMargin: DETECTOR_MARGIN_THRESHOLD,
  licence: 'Apache-2.0',
};

/** The calibrated fallback (§5.1, Q1): merge 0.86 / medoid 0.82, did-you-mean 0.78–0.86, `classification` detector. */
const V1: ModelConfig = {
  modelId: EMBEDDING_MODEL_ID_V1,
  hfRepo: 'onnx-community/embeddinggemma-300m-ONNX',
  revision: '5090578d9565bb06545b4552f76e6bc2c93e4a66',
  dtype: 'q4',
  textOnly: false,
  files: [
    { path: 'config.json', gitBlobSha1: 'edb6342fb0d447a42960920034c773ddd6ed6d55' },
    { path: 'added_tokens.json', gitBlobSha1: 'e17bde03d42feda32d1abfca6d3b598b9a020df7' },
    { path: 'generation_config.json', gitBlobSha1: '562150c0903db92148e95aeed8292bbfbf3c93d9' },
    { path: 'special_tokens_map.json', gitBlobSha1: '1a6193244714d3d78be48666cb02cdbfac62ad86' },
    { path: 'tokenizer_config.json', gitBlobSha1: '73b499ae604d0bcbeb2889639a42f46462e9d372' },
    { path: 'tokenizer.json', sha256: '4dda02faaf32bc91031dc8c88457ac272b00c1016cc679757d1c441b248b9c47' },
    { path: 'onnx/model_q4.onnx', sha256: 'ad1dfee81a70f7944b9b9d1cc6e48075b832881cf33fab2f2b248be78f3f0043' },
    { path: 'onnx/model_q4.onnx_data', sha256: '599962c3143b040de2dd05e5975be3e9091dd067cacc6a8f7186e3203bab9e02' },
  ],
  dim: EMBEDDING_DIM,
  tagPrompt: PROMPTS.sts,
  detectorPrompt: PROMPTS.classification,
  assign: V1_ASSIGN_THRESHOLDS,
  // [EXP]: −0.03 with the classification prompt gave 100% recall for v1 as well.
  detectorMargin: -0.03,
  licence: 'Gemma Terms of Use',
};

export const MODELS = { v2: V2, v1: V1 } as const;

// DESIGN-DEVIATION: the embedder brief listed v1's thresholds (merge 0.86 …); DESIGN.md §5.1/§5.2 as of
// commit 1ba0f5c adopts EmbeddingGemma 2 q4 (A1, [CAL]), so v2 is active and v1 is the documented fallback.
export const MODEL: ModelConfig = MODELS.v2;
assertV2ThresholdFloors(MODEL.assign);

/** 128-d float32 copy of each centroid for the matcher (A2, §6.4): truncated, then re-normalized. */
export const C128_DIM = 128;

/** `findNearest` result count over the holding's partition (§5.2 (6)). */
export const CONCEPT_SEARCH_LIMIT = 3;
/** Concept snapshot generation; stays 0 until the in-memory shortlist stage (§5.2 (6), above 20k concepts). */
export const CONCEPT_GEN = 0;

/**
 * Abuse-prototype similarity runs in shadow mode with aggregate counters only (§5.2 (2)). The [MAT] values
 * were never calibrated, and v2 puts unrelated pairs at 0.78–0.85: in a real-model smoke run every tag
 * counted as "reject". Nothing acts on them; calibrate in M0 before the counters mean anything.
 */
export const ABUSE_SHADOW = { reject: 0.8, hold: 0.65 } as const;

export const SERVICE = {
  region: 'europe-west1',
  /** `sa-embedder@` expands to `sa-embedder@<project>.iam.gserviceaccount.com` at deploy (§9 IAM). */
  serviceAccount: 'sa-embedder@',
  memory: '1GiB',
  cpu: 1,
  concurrency: 4,
  minInstances: 0,
  maxInstances: 5,
  callableTimeoutSeconds: 60,
  /** Cloud Tasks' maximum dispatch deadline; enqueuers pass the same value (§7 Cloud Tasks). */
  batchTimeoutSeconds: 1800,
  /** One vCPU: more ORT threads only contend (latency [CAL] 64.6 ms/tag at 1 thread). */
  ortThreads: 1,
} as const;

export const LIMITS = {
  /** Holdings per user, sensitive included (§4.3). */
  maxInterests: 20,
  /** Sensitive holdings created per account per 7 days (S5, §4.3). */
  sensitiveAddsPer7Days: 3,
  /** addInterests calls per uid per hour, warm-ups included; halved for accounts younger than 24 h (§9). */
  callsPerHour: 30,
  newAccountMs: 24 * 3600_000,
  /** Per-instance, in-memory only; generous because of carrier-grade NAT (§9). */
  callsPerIpPerHour: 600,
  /** Global daily budget of embed misses (§9, [A]). */
  embedMissesPerDay: 20_000,
} as const;

/**
 * Whether sensitive (Art. 9) holdings are accepted at all. Off until withdrawSensitive and removeInterest exist:
 * withdrawing consent must be as easy as giving it and take effect at once (Art. 7(3), PRIVACY.md §3.5). While off,
 * a sensitive holding is answered `limit`/SENSITIVE_UNAVAILABLE before any consent is asked for or anything is kept.
 * TODO(M1): switch on together with the withdrawal callables.
 */
export const ART9_HOLDINGS_ENABLED = false;

/** In-memory tag cache (§5.2 (3), [SRV]): about 30 MB of 768-d float32 vectors. */
export const LRU_CAPACITY = 10_000;
export const METRICS_FLUSH_MS = 60_000;
/** `config/app.features` is re-read at most this often per instance. */
export const FEATURE_FLAGS_TTL_MS = 60_000;
