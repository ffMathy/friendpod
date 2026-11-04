/**
 * The detector's prototype vectors on the server (DESIGN.md §5.2 (5), D1). The app computes the margin on the device;
 * the server recomputes it from the client's vector when it has `prototypes.bin` and keeps the more cautious of the
 * two (core's reconcileDetectorMargin). The file is embedded offline with the pinned model and hosted in the EU
 * models bucket next to the model files; the app's build fetches it from there and bundles it (DESIGN.md F32).
 *
 * Without the file (not built yet, not readable) the server decides with the client's margin alone, which is what
 * D1 trusts anyway; a stale file is a deploy error and fails loudly.
 */
import { EMBEDDING_MODEL, decodePrototypes, type Prototypes } from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import { PROTOTYPES_RETRY_MS } from './config';

export type PrototypeSource = () => Promise<Prototypes | null>;

/** Object path in `gs://grouper-<env>-models`, the directory the app mirrors (EMBEDDING_MODEL.device.dir). */
export const PROTOTYPES_OBJECT = `${EMBEDDING_MODEL.device?.dir ?? ''}prototypes.bin`;

/** Decodes and, once core pins prototypes.bin among the model files, checks its sha256 first. */
export function parsePrototypes(bytes: Uint8Array): Prototypes {
  const pinned = EMBEDDING_MODEL.files.find((f) => f.path === 'prototypes.bin');
  if (pinned && sha256Hex(bytes) !== pinned.sha256) throw new Error('prototypes.bin does not match its pinned sha256');
  return decodePrototypes(bytes, EMBEDDING_MODEL);
}

export interface PrototypeLoaderOptions {
  readonly read: () => Promise<Uint8Array | null>;
  readonly now: () => number;
  readonly onUnavailable: (reason: 'missing' | 'unreadable') => void;
}

/**
 * Per-instance cache. A decoded file is kept for the instance's lifetime; a missing or unreadable one is retried
 * after PROTOTYPES_RETRY_MS, so a file uploaded after the deploy is picked up without one.
 */
export function prototypeLoader(o: PrototypeLoaderOptions): PrototypeSource {
  let loaded: Prototypes | null = null;
  let retryAt = 0;
  let pending: Promise<Prototypes | null> | null = null;
  return async () => {
    if (loaded) return loaded;
    if (o.now() < retryAt) return null;
    pending ??= (async () => {
      let bytes: Uint8Array | null;
      try {
        bytes = await o.read();
      } catch {
        o.onUnavailable('unreadable');
        retryAt = o.now() + PROTOTYPES_RETRY_MS;
        return null;
      }
      if (!bytes) {
        o.onUnavailable('missing');
        retryAt = o.now() + PROTOTYPES_RETRY_MS;
        return null;
      }
      loaded = parsePrototypes(bytes);
      return loaded;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
