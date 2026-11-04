import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { EmbedderUnavailableError, getEmbedder, type EmbedderUnavailableReason } from './embedder';

export type EmbedderState =
  /** Loading the session; on Android's first launch this includes copying the model out of the APK. */
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'unavailable'; readonly reason: EmbedderUnavailableReason };

/**
 * Keeps the model loaded while an interests screen is focused and frees it (session and tokenizer, several hundred MB)
 * when the screen loses focus. Adding tags is blocked with a short "preparing" message until it is ready, and with a
 * message and a retry if it cannot be loaded.
 */
export function useEmbedder() {
  const [state, setState] = useState<EmbedderState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      await getEmbedder().load();
      setState({ status: 'ready' });
    } catch (e) {
      setState({ status: 'unavailable', reason: e instanceof EmbedderUnavailableError ? e.reason : 'runtime' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        void getEmbedder().release();
      };
    }, [load]),
  );

  return { state, retry: load };
}
