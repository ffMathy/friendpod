import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  decodePrototypes,
  deviceModelFiles,
  embeddingInput,
  renormalize,
  StalePrototypesError,
  type Prototypes,
} from '@grouper/core';
import type { Tokenizer } from '@huggingface/tokenizers';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import type * as Ort from 'onnxruntime-react-native';
import { createLifecycle } from './lifecycle';
import { ensureModelFiles, type Connectivity, type ModelFs } from './modelFiles';
import { EmbedderUnavailableError, type Embedder, type LoadOptions } from './types';

/** Built by the backend from `prototypeTexts()` and pinned in EMBEDDING_MODEL.files next to the model (§5.2 (5)). */
export const PROTOTYPES_FILE = 'prototypes.bin';
const TOKENIZER_FILE = 'tokenizer.json';
const TOKENIZER_CONFIG_FILE = 'tokenizer_config.json';

const expoFs: ModelFs = {
  size(path) {
    const f = new File(path);
    return f.exists ? f.size : null;
  },
  sha256: (path) => new File(path).digest('SHA-256'),
  async download(url, path, onBytes) {
    const f = new File(path);
    f.parentDirectory.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(url, f, { idempotent: true, onProgress: ({ bytesWritten }) => onBytes(bytesWritten) });
  },
  move: (from, to) => new File(from).move(new File(to), { overwrite: true }),
  remove: (path) => new File(path).delete(),
};

async function connectivity(): Promise<Connectivity> {
  const state = await Network.getNetworkStateAsync();
  if (state.isConnected === false || state.type === Network.NetworkStateType.NONE) return 'offline';
  return state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET ? 'unmetered' : 'metered';
}

interface Loaded {
  readonly session: Ort.InferenceSession;
  readonly tokenizer: Tokenizer;
  readonly prototypes: Prototypes;
  readonly ort: typeof Ort;
}

/**
 * EmbeddingGemma 2 q4 on onnxruntime-react-native (CPU EP only: the graph's contrib ops do not run on CoreML/NNAPI),
 * tokenised in JS with @huggingface/tokenizers. The research run matched the calibration vectors to cosine ≥ 0.9999993
 * on x86; ARM numerics are checked by the dev-build golden test (DEVICE_GOLDEN_TOLERANCE), not here.
 *
 * Files live under the document directory (models/…, excluded from iCloud backup by withFirestoreBackupExclusion)
 * and are fetched from `baseUrl`, our EU bucket. The native runtime is imported only on load: importing it installs
 * the JSI binding, which must not happen at app start or in tests.
 */
export function createDeviceEmbedder(baseUrl: string): Embedder {
  const device = EMBEDDING_MODEL.device;
  const graph = EMBEDDING_MODEL.graph;
  if (!device || !graph) throw new Error('EMBEDDING_MODEL has no device runtime');
  const dir = new Directory(Paths.document, device.dir).uri.replace(/\/?$/, '/');
  const verified = new Set<string>();

  const doLoad = async (opts: LoadOptions): Promise<Loaded> => {
    const files = deviceModelFiles();
    if (!files.some((f) => f.path === PROTOTYPES_FILE)) throw new EmbedderUnavailableError('notPinned', PROTOTYPES_FILE);
    const paths = await ensureModelFiles({
      fs: expoFs,
      baseUrl,
      dir,
      files,
      connectivity,
      allowCellular: opts.allowCellular === true,
      verified,
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
    });
    try {
      const prototypes = decodePrototypes(await new File(paths[PROTOTYPES_FILE]!).bytes());
      const { Tokenizer: TokenizerClass } = await import('@huggingface/tokenizers');
      const tokenizer = new TokenizerClass(
        JSON.parse(await new File(paths[TOKENIZER_FILE]!).text()) as object,
        JSON.parse(await new File(paths[TOKENIZER_CONFIG_FILE]!).text()) as object,
      );
      const ort = await import('onnxruntime-react-native');
      // A path, not a buffer: the runtime then finds model_q4.onnx_data next to the graph.
      const session = await ort.InferenceSession.create(paths[graph.modelFile]!, {
        executionProviders: [...device.executionProviders],
        graphOptimizationLevel: device.graphOptimizationLevel,
        intraOpNumThreads: device.intraOpNumThreads,
      });
      return { session, tokenizer, prototypes, ort };
    } catch (e) {
      if (e instanceof StalePrototypesError) throw new EmbedderUnavailableError('integrity', e.message);
      throw new EmbedderUnavailableError('runtime', e instanceof Error ? e.message : String(e));
    }
  };

  const runtime = createLifecycle(doLoad, (l) => l.session.release());

  const embedOne = async (l: Loaded, norm: string): Promise<Float32Array> => {
    const ids = l.tokenizer.encode(embeddingInput(norm)).ids;
    const n = ids.length;
    const empty = (): Ort.Tensor => new l.ort.Tensor('float32', new Float32Array(0), [...graph.emptyFeatureShape]);
    const feeds: Record<string, Ort.Tensor> = {
      [graph.inputIds]: new l.ort.Tensor('int64', BigInt64Array.from(ids, (id) => BigInt(id)), [1, n]),
      [graph.attentionMask]: new l.ort.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]),
    };
    for (const name of graph.emptyFeatureInputs) feeds[name] = empty();
    const out = await l.session.run(feeds, [graph.output]);
    const data = out[graph.output]?.data;
    if (!(data instanceof Float32Array) || data.length !== EMBEDDING_DIM) {
      throw new EmbedderUnavailableError('runtime', `unexpected ${graph.output}`);
    }
    return renormalize(data);
  };

  return {
    kind: 'device',
    load: (opts = {}) => runtime.load(opts),
    embed: (norms) =>
      runtime.use(async (l) => {
        const out: Float32Array[] = [];
        // One run per tag keeps memory flat; onboarding batches tags into one call, not one tensor.
        for (const norm of norms) out.push(await embedOne(l, norm));
        return out;
      }),
    prototypes: () => runtime.use(async (l) => l.prototypes),
    release: () => runtime.release(),
  };
}
