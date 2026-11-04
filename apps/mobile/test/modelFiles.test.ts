import { EMBEDDING_MODEL, deviceModelFiles, renormalize, type PinnedModelFile } from '@grouper/core';
import { loadGoldenReferences, runGoldenTest } from '@/features/interests/embedder/golden';
import { createStubEmbedder } from '@/features/interests/embedder/stub';
import { ensureModelFiles, type Connectivity, type ModelFs } from '@/features/interests/embedder/modelFiles';
import { EmbedderUnavailableError } from '@/features/interests/embedder/types';

const BASE = 'https://models.example/eg2/';
const DIR = 'file:///docs/models/eg2/';
const files: PinnedModelFile[] = [
  { path: 'tokenizer.json', sha256: 'a'.repeat(64), bytes: 10, device: true },
  { path: 'onnx/model_q4.onnx', sha256: 'b'.repeat(64), bytes: 20, device: true },
];

/** In-memory files: content is just the sha256 it would hash to, plus a size. */
function fakeFs(remote: Record<string, { sha256: string; bytes: number }>) {
  const disk = new Map<string, { sha256: string; bytes: number }>();
  const downloads: string[] = [];
  const fs: ModelFs = {
    size: (p) => disk.get(p)?.bytes ?? null,
    sha256: async (p) => disk.get(p)!.sha256.toUpperCase(),
    async download(url, p, onBytes) {
      downloads.push(url);
      const f = remote[url.slice(BASE.length)];
      if (!f) throw new Error('404');
      onBytes(f.bytes / 2);
      disk.set(p, f);
    },
    async move(from, to) {
      disk.set(to, disk.get(from)!);
      disk.delete(from);
    },
    remove: (p) => void disk.delete(p),
  };
  return { fs, disk, downloads };
}

const good = Object.fromEntries(files.map((f) => [f.path, { sha256: f.sha256, bytes: f.bytes }]));
const opts = (fs: ModelFs, net: Connectivity = 'unmetered', allowCellular = false) => ({
  fs,
  baseUrl: BASE,
  dir: DIR,
  files,
  connectivity: async () => net,
  allowCellular,
});

describe('model download and verification (D1)', () => {
  it('pins every device file of the model, prototypes included once the backend publishes them', () => {
    const paths = deviceModelFiles().map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(['tokenizer.json', 'tokenizer_config.json', 'onnx/model_q4.onnx', 'onnx/model_q4.onnx_data']));
    for (const f of deviceModelFiles()) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(EMBEDDING_MODEL.device?.executionProviders).toEqual(['cpu']);
  });

  it('downloads missing files, verifies them and reports progress', async () => {
    const { fs, disk, downloads } = fakeFs(good);
    const progress: number[] = [];
    const paths = await ensureModelFiles({ ...opts(fs), onProgress: (p) => progress.push(p) });
    expect(downloads).toEqual([`${BASE}tokenizer.json`, `${BASE}onnx/model_q4.onnx`]);
    expect(paths['onnx/model_q4.onnx']).toBe(`${DIR}onnx/model_q4.onnx`);
    expect([...disk.keys()].sort()).toEqual([`${DIR}onnx/model_q4.onnx`, `${DIR}tokenizer.json`]);
    expect(progress.at(-1)).toBe(1);
  });

  it('uses verified files without downloading again', async () => {
    const { fs, downloads } = fakeFs(good);
    await ensureModelFiles(opts(fs));
    downloads.length = 0;
    await ensureModelFiles(opts(fs, 'offline'));
    expect(downloads).toEqual([]);
  });

  it('deletes a file whose hash does not match and never moves it into place', async () => {
    const { fs, disk } = fakeFs({ ...good, 'onnx/model_q4.onnx': { sha256: 'c'.repeat(64), bytes: 20 } });
    await expect(ensureModelFiles(opts(fs))).rejects.toMatchObject({ reason: 'integrity' });
    expect(disk.has(`${DIR}onnx/model_q4.onnx`)).toBe(false);
    expect(disk.has(`${DIR}onnx/model_q4.onnx.part`)).toBe(false);
  });

  it('replaces a corrupted local file', async () => {
    const { fs, disk, downloads } = fakeFs(good);
    disk.set(`${DIR}tokenizer.json`, { sha256: 'f'.repeat(64), bytes: 10 });
    await ensureModelFiles(opts(fs));
    expect(downloads).toContain(`${BASE}tokenizer.json`);
    expect(disk.get(`${DIR}tokenizer.json`)?.sha256).toBe('a'.repeat(64));
  });

  it('asks before using mobile data, and fails clearly offline or on a broken download', async () => {
    await expect(ensureModelFiles(opts(fakeFs(good).fs, 'metered'))).rejects.toMatchObject({ reason: 'cellular' });
    await expect(ensureModelFiles(opts(fakeFs(good).fs, 'metered', true))).resolves.toBeDefined();
    await expect(ensureModelFiles(opts(fakeFs(good).fs, 'offline'))).rejects.toMatchObject({ reason: 'offline' });
    const broken = await ensureModelFiles(opts(fakeFs({}).fs)).catch((e: unknown) => e);
    expect(broken).toBeInstanceOf(EmbedderUnavailableError);
    expect(broken).toMatchObject({ reason: 'download' });
  });
});

describe('golden test (DEVICE_GOLDEN_TOLERANCE)', () => {
  it('passes when the device reproduces the references and fails when one vector drifts', async () => {
    const embedder = createStubEmbedder();
    const texts = ['madlavning', 'løb', 'brætspil', 'gravid'];
    const refs = await embedder.embed(texts);
    await expect(runGoldenTest(embedder, texts.map((text, i) => ({ text, vector: refs[i]! })))).resolves.toMatchObject({ pass: true, minCosine: expect.closeTo(1, 6) });

    const drifted = Float32Array.from(refs[0]!);
    drifted[5] = drifted[5]! + 0.05;
    const result = await runGoldenTest(embedder, texts.map((text, i) => ({ text, vector: i === 0 ? renormalize(drifted) : refs[i]! })));
    expect(result.pass).toBe(false);
  });

  it('has no packaged references yet and says so', async () => {
    await expect(loadGoldenReferences()).rejects.toThrow(/NOT_IMPLEMENTED/);
  });
});
