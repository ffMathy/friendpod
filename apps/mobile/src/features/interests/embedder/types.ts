import type { Prototypes } from '@friendpod/core';

/** Why the on-device model cannot be used right now; each has its own message and retry in the UI. */
export type EmbedderUnavailableReason =
  /** The build has no model in it (a development build prebuilt with EXPO_PUBLIC_EMBEDDER=stub, run without it). */
  | 'notBundled'
  /** Android's first-launch copy out of the APK failed: almost always too little free space (~207 MB). */
  | 'storage'
  /** A copied file's SHA-256 does not match the pin in @friendpod/core: it is deleted and never loaded. */
  | 'integrity'
  /** The runtime could not create a session or run the graph (too little memory, unsupported device). */
  | 'runtime'
  /** A file the app needs has no pin in @friendpod/core yet (prototypes.bin before the backend publishes it). */
  | 'notPinned';

export class EmbedderUnavailableError extends Error {
  readonly reason: EmbedderUnavailableReason;

  constructor(reason: EmbedderUnavailableReason, detail?: string) {
    super(detail ? `embedder unavailable (${reason}): ${detail}` : `embedder unavailable (${reason})`);
    this.name = 'EmbedderUnavailableError';
    this.reason = reason;
  }
}

/**
 * The on-device embedding model (D1, DESIGN.md §5.1). Every tag is embedded on the phone with the pinned
 * EmbeddingGemma 2 q4 graph and STS prompt; the server stores what the app sends.
 */
export interface Embedder {
  readonly kind: 'device' | 'stub';
  /**
   * Finds the bundled files (on Android's first launch, copies them out of the APK and verifies them), then loads the
   * session, tokenizer and prototypes. Idempotent.
   */
  load(): Promise<void>;
  /**
   * One unit vector (EMBEDDING_DIM) per `normalizeTag().norm`, in order. The prompt is added here
   * (`embeddingInput`), so callers pass the bare norm.
   */
  embed(norms: readonly string[]): Promise<Float32Array[]>;
  /** The detector's prototype vectors for the same model (prototypes.bin). */
  prototypes(): Promise<Prototypes>;
  /** Frees the session and the tokenizer (hundreds of MB); the files stay on disk. */
  release(): Promise<void>;
}
