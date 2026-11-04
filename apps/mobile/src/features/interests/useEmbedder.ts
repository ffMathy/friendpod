import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { EmbedderUnavailableError, getEmbedder, type EmbedderUnavailableReason } from './embedder';

export type EmbedderState =
  | { readonly status: 'loading'; readonly progress: number | null }
  | { readonly status: 'ready' }
  | { readonly status: 'unavailable'; readonly reason: EmbedderUnavailableReason };

/**
 * Keeps the model loaded while an interests screen is focused and frees it (session and tokenizer, several hundred MB)
 * when the screen loses focus. Adding tags is blocked with a message and a retry until it is ready; "Use mobile
 * data" retries with `allowCellular`.
 */
export function useEmbedder() {
  const [state, setState] = useState<EmbedderState>({ status: 'loading', progress: null });

  const load = useCallback(async (allowCellular = false) => {
    setState({ status: 'loading', progress: null });
    try {
      await getEmbedder().load({ allowCellular, onProgress: (progress) => setState({ status: 'loading', progress }) });
      setState({ status: 'ready' });
    } catch (e) {
      setState({ status: 'unavailable', reason: e instanceof EmbedderUnavailableError ? e.reason : 'runtime' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
      return () => {
        void getEmbedder().release();
      };
    }, [load]),
  );

  return { state, retry: load };
}
