import { EMBEDDING_MODEL, deviceModelFiles, renormalize, type PinnedModelFile } from '@friendpod/core';
import { loadGoldenReferences, runGoldenTest } from '@/features/interests/embedder/golden';
import { getEmbedder, setEmbedderForTests } from '@/features/interests/embedder';
import { createStubEmbedder } from '@/features/interests/embedder/stub';
import {
  MARKER,
  bundledModelDir,
  installedModelDir,
  markerText,
  prepareModelFiles,
  toNativePath,
  toUri,
  type ModelFs,
  type ModelPlatform,
} from '@/features/interests/embedder/modelFiles';
import { EmbedderUnavailableError } from '@/features/interests/embedder/types';

const DIR = 'models/eg2-test/';
const DOCS = 'file:///data/user/0/dk.friendpod.app/files/';
const IOS_BUNDLE = 'file:///private/var/containers/Bundle/Application/X/Friendpod%20Dev.app/';
const files: PinnedModelFile[] = [
  { path: 'tokenizer.json', sha256: 'a'.repeat(64), bytes: 10, device: true, source: 'hf' },
  { path: 'onnx/model_q4.onnx', sha256: 'b'.repeat(64), bytes: 20, device: true, source: 'hf' },
  { path: 'onnx/model_q4.onnx_data', sha256: 'c'.repeat(64), bytes: 30, device: true, source: 'hf' },
];
type Content = { sha256: string; bytes: number };
const pinned = (f: PinnedModelFile): Content => ({ sha256: f.sha256, bytes: f.bytes });

/** In-memory volume: a file's content is just the sha256 it hashes to and a size; directories are implied. */
/** `volume`: the document volume's size; free space is what its files leave (APK assets do not count). */
function fakeFs(initial: Record<string, Content> = {}, opts: { free?: number; volume?: number; failCopy?: boolean } = {}) {
  const disk = new Map<string, Content | string>(Object.entries(initial));
  const log = { copied: [] as string[], hashed: [] as string[], removed: [] as string[] };
  const under = (dir: string) => [...disk.keys()].filter((k) => k.startsWith(dir));
  const fs: ModelFs = {
    size: (u) => {
      const c = disk.get(u);
      return c === undefined ? null : typeof c === 'string' ? c.length : c.bytes;
    },
    sha256: async (u) => {
      log.hashed.push(u);
      return (disk.get(u) as Content).sha256.toUpperCase();
    },
    async copy(from, to) {
      if (opts.failCopy) throw new Error('ENOSPC');
      const c = disk.get(from);
      if (c === undefined) throw new Error(`no such asset ${from}`);
      log.copied.push(from);
      disk.set(to, c);
    },
    async move(from, to) {
      disk.set(to, disk.get(from)!);
      disk.delete(from);
    },
    remove(u) {
      for (const k of [u, ...under(u.endsWith('/') ? u : `${u}/`)]) if (disk.delete(k)) log.removed.push(k);
    },
    list(dir) {
      return [...new Set(under(dir).map((k) => k.slice(dir.length).split('/')[0]!))];
    },
    readText: async (u) => {
      const c = disk.get(u);
      return typeof c === 'string' ? c : null;
    },
    writeText: async (u, t) => void disk.set(u, t),
    freeBytes: () => {
      if (opts.volume === undefined) return opts.free ?? 1e12;
      const used = [...disk.entries()].filter(([k]) => k.startsWith('file://')).reduce((n, [, c]) => n + (typeof c === 'string' ? c.length : c.bytes), 0);
      return opts.volume - used;
    },
  };
  return { fs, disk, log };
}

const assets = (list: readonly PinnedModelFile[] = files) => Object.fromEntries(list.map((f) => [`asset:///${DIR}${f.path}`, pinned(f)]));
const installed = (list: readonly PinnedModelFile[] = files) => Object.fromEntries(list.map((f) => [`${DOCS}${DIR}${f.path}`, pinned(f)]));
const prepare = (fs: ModelFs, platform: ModelPlatform = 'android', bundleRoot = platform === 'android' ? 'asset://' : IOS_BUNDLE) =>
  prepareModelFiles({ platform, fs, bundleRoot, documentRoot: DOCS, dir: DIR, files });

describe('bundled model files (D1)', () => {
  it('pins every device file of the model, prototypes included once the backend publishes them', () => {
    const paths = deviceModelFiles().map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(['tokenizer.json', 'tokenizer_config.json', 'onnx/model_q4.onnx', 'onnx/model_q4.onnx_data']));
    for (const f of deviceModelFiles()) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(EMBEDDING_MODEL.device?.executionProviders).toEqual(['cpu']);
    expect(EMBEDDING_MODEL.device?.dir).toMatch(/^models\/[a-z0-9-]+\/$/);
  });

  describe('path resolution', () => {
    it('reads iOS files inside the app bundle and Android files from APK assets', () => {
      expect(bundledModelDir('ios', IOS_BUNDLE, DIR)).toBe(`${IOS_BUNDLE}${DIR}`);
      // expo-file-system reports the iOS bundle as a plain path.
      expect(bundledModelDir('ios', '/var/containers/Bundle/Application/X/Friendpod Dev.app', DIR)).toBe(
        `file:///var/containers/Bundle/Application/X/Friendpod%20Dev.app/${DIR}`,
      );
      expect(bundledModelDir('android', 'asset://', DIR)).toBe(`asset:///${DIR}`);
      expect(installedModelDir('file:///data/files', DIR)).toBe(`file:///data/files/${DIR}`);
    });

    it('hands onnxruntime a plain, decoded file path', () => {
      expect(toNativePath(`${IOS_BUNDLE}${DIR}onnx/model_q4.onnx`)).toBe(`/private/var/containers/Bundle/Application/X/Friendpod Dev.app/${DIR}onnx/model_q4.onnx`);
      expect(toNativePath(`${DOCS}${DIR}onnx/model_q4.onnx`)).toBe(`/data/user/0/dk.friendpod.app/files/${DIR}onnx/model_q4.onnx`);
      expect(() => toNativePath(`asset:///${DIR}onnx/model_q4.onnx`)).toThrow(/file URI/);
      expect(toUri('asset:///x')).toBe('asset:///x');
    });
  });

  describe('iOS', () => {
    it('opens the bundled files in place without copying or hashing, and removes a model an older build downloaded', async () => {
      const { fs, disk, log } = fakeFs({
        ...Object.fromEntries(files.map((f) => [`${IOS_BUNDLE}${DIR}${f.path}`, pinned(f)])),
        [`${DOCS}models/eg2-q4-old/onnx/model_q4.onnx_data`]: pinned(files[2]!),
      });
      const paths = await prepare(fs, 'ios');
      expect(paths['onnx/model_q4.onnx']).toBe(`${IOS_BUNDLE}${DIR}onnx/model_q4.onnx`);
      expect(log.copied).toEqual([]);
      expect(log.hashed).toEqual([]);
      expect([...disk.keys()].filter((k) => k.startsWith(DOCS))).toEqual([]);
    });

    it('refuses a build without the model (prebuilt with EXPO_PUBLIC_EMBEDDER=stub)', async () => {
      await expect(prepare(fakeFs().fs, 'ios')).rejects.toMatchObject({ reason: 'notBundled' });
    });
  });

  describe('Android', () => {
    it('copies the assets to internal storage on first launch, verifies each once and writes the marker last', async () => {
      const { fs, disk, log } = fakeFs(assets());
      const paths = await prepare(fs);
      expect(paths['onnx/model_q4.onnx_data']).toBe(`${DOCS}${DIR}onnx/model_q4.onnx_data`);
      expect(log.copied).toEqual(files.map((f) => `asset:///${DIR}${f.path}`));
      expect(log.hashed).toEqual(files.map((f) => `${DOCS}${DIR}${f.path}.part`));
      expect(disk.get(`${DOCS}${DIR}${MARKER}`)).toBe(markerText(files));
      expect([...disk.keys()].some((k) => k.endsWith('.part'))).toBe(false);
    });

    it('trusts the marker on later launches: no copy, no hash', async () => {
      const { fs, log } = fakeFs({ ...assets(), ...installed() });
      await fs.writeText(`${DOCS}${DIR}${MARKER}`, markerText(files));
      await prepare(fs);
      expect(log.copied).toEqual([]);
      expect(log.hashed).toEqual([]);
    });

    it('does not trust a marker for other pins or a file whose size changed', async () => {
      const { fs, disk, log } = fakeFs({ ...assets(), ...installed() });
      await fs.writeText(`${DOCS}${DIR}${MARKER}`, markerText(files.slice(1)));
      await prepare(fs);
      expect(log.copied).toEqual([]); // the files were fine, only re-verified
      expect(log.hashed).toHaveLength(files.length);
      expect(disk.get(`${DOCS}${DIR}${MARKER}`)).toBe(markerText(files));

      disk.set(`${DOCS}${DIR}tokenizer.json`, { sha256: 'f'.repeat(64), bytes: 9 });
      log.copied.length = 0;
      await prepare(fs);
      expect(log.copied).toEqual([`asset:///${DIR}tokenizer.json`]);
    });

    it('resumes an interrupted first copy, keeping the files that verify', async () => {
      const { fs, log } = fakeFs({ ...assets(), ...installed(files.slice(0, 1)), [`${DOCS}${DIR}onnx/model_q4.onnx`]: { sha256: 'e'.repeat(64), bytes: 20 } });
      await prepare(fs);
      expect(log.copied).toEqual([`asset:///${DIR}onnx/model_q4.onnx`, `asset:///${DIR}onnx/model_q4.onnx_data`]);
    });

    it('deletes a partial copy left by a killed first launch before checking free space', async () => {
      const MARGIN = 50 * 1024 * 1024;
      const part = `${DOCS}${DIR}onnx/model_q4.onnx_data.part`;
      const needed = files.reduce((n, f) => n + f.bytes, 0);
      // With the stale 25-byte .part counted as used, the volume is one byte short of needed + margin.
      const { fs, disk, log } = fakeFs({ ...assets(), [part]: { sha256: 'f'.repeat(64), bytes: 25 } }, { volume: 25 + needed + MARGIN - 1 });
      await prepare(fs);
      expect(log.removed).toContain(part);
      expect(disk.has(part)).toBe(false);
      expect(log.copied).toHaveLength(files.length);
      expect(disk.has(`${DOCS}${DIR}${MARKER}`)).toBe(true);
      // Without the .part, the same volume really is too small.
      await expect(prepare(fakeFs(assets(), { volume: needed + MARGIN - 1 }).fs)).rejects.toMatchObject({ reason: 'storage' });
    });

    it('removes older model folders and keeps the current one', async () => {
      const { fs, disk } = fakeFs({
        ...assets(),
        [`${DOCS}models/eg2-q4-old/onnx/model_q4.onnx_data`]: pinned(files[2]!),
        [`${DOCS}models/eg2-q4-old/${MARKER}`]: pinned(files[0]!),
        [`${DOCS}other/keep.txt`]: pinned(files[0]!),
      });
      await prepare(fs);
      expect([...disk.keys()].filter((k) => k.startsWith(`${DOCS}models/eg2-q4-old`))).toEqual([]);
      expect(disk.has(`${DOCS}other/keep.txt`)).toBe(true);
      expect(disk.has(`${DOCS}${DIR}onnx/model_q4.onnx_data`)).toBe(true);
    });

    it('deletes a copy whose sha256 does not match the pin and never moves it into place or marks it', async () => {
      const { fs, disk } = fakeFs({ ...assets(), [`asset:///${DIR}onnx/model_q4.onnx`]: { sha256: 'd'.repeat(64), bytes: 20 } });
      const err = await prepare(fs).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(EmbedderUnavailableError);
      expect(err).toMatchObject({ reason: 'integrity' });
      expect(disk.has(`${DOCS}${DIR}onnx/model_q4.onnx`)).toBe(false);
      expect(disk.has(`${DOCS}${DIR}onnx/model_q4.onnx.part`)).toBe(false);
      expect(disk.has(`${DOCS}${DIR}${MARKER}`)).toBe(false);
    });

    it('says why a copy cannot happen: too little space, a failed copy, or no model in the build', async () => {
      await expect(prepare(fakeFs(assets(), { free: 100 }).fs)).rejects.toMatchObject({ reason: 'storage' });
      const failing = fakeFs(assets(), { failCopy: true });
      await expect(prepare(failing.fs)).rejects.toMatchObject({ reason: 'storage' });
      expect([...failing.disk.keys()].some((k) => k.endsWith('.part'))).toBe(false);
      await expect(prepare(fakeFs(assets(files.slice(0, 2))).fs)).rejects.toMatchObject({ reason: 'notBundled' });
    });
  });

  it('uses the stub embedder in tests (EXPO_PUBLIC_EMBEDDER=stub path): nothing is located or copied', async () => {
    setEmbedderForTests(null);
    const embedder = getEmbedder();
    expect(embedder.kind).toBe('stub');
    await expect(embedder.load()).resolves.toBeUndefined();
    setEmbedderForTests(null);
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
