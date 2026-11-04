import type { Prototypes } from '@grouper/core';

/** Why the on-device model cannot be used right now; each has its own message and retry in the UI. */
export type EmbedderUnavailableReason =
  /** Files are missing and the phone is on mobile data: the user is asked before ~180 MB are downloaded. */
  | 'cellular'
  | 'offline'
  /** Download failed (server, connection dropped, not enough space). */
  | 'download'
  /** A file's SHA-256 does not match the pin in @grouper/core: it is deleted and never loaded. */
  | 'integrity'
  /** The runtime could not create a session or run the graph (too little memory, unsupported device). */
  | 'runtime'
  /** A file the app needs has no pin in @grouper/core yet (prototypes.bin before the backend publishes it). */
  | 'notPinned';

export class EmbedderUnavailableError extends Error {
  readonly reason: EmbedderUnavailableReason;

  constructor(reason: EmbedderUnavailableReason, detail?: string) {
    super(detail ? `embedder unavailable (${reason}): ${detail}` : `embedder unavailable (${reason})`);
    this.name = 'EmbedderUnavailableError';
    this.reason = reason;
  }
}

export interface LoadOptions {
  /** The user agreed to download over mobile data. */
  readonly allowCellular?: boolean;
  /** 0..1 over all files that still have to be downloaded. */
  readonly onProgress?: (fraction: number) => void;
}

/**
 * The on-device embedding model (D1, DESIGN.md §5.1). Every tag is embedded on the phone with the pinned
 * EmbeddingGemma 2 q4 graph and STS prompt; the server stores what the app sends.
 */
export interface Embedder {
  readonly kind: 'device' | 'stub';
  /** Downloads and verifies what is missing, then loads the session, tokenizer and prototypes. Idempotent. */
  load(opts?: LoadOptions): Promise<void>;
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
