import { EmbedderUnavailableError, type LoadOptions } from './types';

/** One loaded runtime (session, tokenizer, prototypes) that a screen holds while focused. */
export interface Lifecycle<L> {
  /** Loads once; concurrent calls share one load. Fails if `release()` came first and nobody asked again. */
  load(opts: LoadOptions): Promise<void>;
  /** Runs `fn` on the loaded runtime; `release()` waits for it before freeing anything. */
  use<T>(fn: (loaded: L) => Promise<T>): Promise<T>;
  /** Frees the runtime once no `use` is running. A load still in flight frees its own result when it lands. */
  release(): Promise<void>;
}

/**
 * The embedder's load/release rules (D1): the model is hundreds of MB, so a screen that loses focus must not keep it,
 * not even when the download or session creation finishes after the screen has gone, and a release must not pull
 * the session out from under an embed that is still running.
 */
export function createLifecycle<L>(create: (opts: LoadOptions) => Promise<L>, dispose: (loaded: L) => Promise<void>): Lifecycle<L> {
  let loaded: L | null = null;
  let loading: Promise<void> | null = null;
  let wanted = false;
  const running = new Set<Promise<unknown>>();

  return {
    async load(opts) {
      wanted = true;
      if (loaded) return;
      loading ??= create(opts)
        .then(async (l) => {
          if (wanted) loaded = l;
          else await dispose(l);
        })
        .finally(() => {
          loading = null;
        });
      await loading;
      if (!loaded) throw new EmbedderUnavailableError('runtime', 'released while loading');
    },
    async use(fn) {
      const l = loaded;
      if (!l) throw new EmbedderUnavailableError('runtime', 'not loaded');
      const run = fn(l);
      running.add(run);
      try {
        return await run;
      } finally {
        running.delete(run);
      }
    },
    async release() {
      wanted = false;
      const l = loaded;
      loaded = null;
      if (l === null) return;
      await Promise.allSettled([...running]);
      await dispose(l);
    },
  };
}
