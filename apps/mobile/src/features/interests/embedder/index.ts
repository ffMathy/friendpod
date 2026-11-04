import { appConfig, embedderMode } from '@/lib/env';
import { createDeviceEmbedder } from './device';
import { createStubEmbedder } from './stub';
import type { Embedder } from './types';

export { EmbedderUnavailableError, type Embedder, type EmbedderUnavailableReason, type LoadOptions } from './types';

let instance: Embedder | null = null;

/** One embedder per app process: the device one, or the stub under EXPO_PUBLIC_EMBEDDER=stub and in tests. */
export function getEmbedder(): Embedder {
  instance ??= embedderMode === 'stub' ? createStubEmbedder() : createDeviceEmbedder(appConfig.modelBaseUrl);
  return instance;
}

/** Tests only. */
export function setEmbedderForTests(e: Embedder | null): void {
  instance = e;
}
