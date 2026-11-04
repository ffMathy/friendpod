import { EMBEDDING_MODEL, deviceModelFiles } from '@grouper/core';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IOSConfig } from 'expo/config-plugins';
import { readPins, sourceDir, type ModelPins } from '../plugins/modelPins';
import withBundledModel from '../plugins/withBundledModel';

const { shouldBundle, stageModel, addModelFolderReference, addNoCompress } = withBundledModel;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** A tiny model with real hashes, so the plugin's checks run against actual files. */
const CONTENT: Record<string, string> = { 'tokenizer.json': '{"t":1}', 'onnx/model_q4.onnx': 'graph', 'onnx/model_q4.onnx_data': 'weights!' };
const pins: ModelPins = {
  hfRepo: 'example/model',
  revision: 'abcdef0123',
  dir: 'models/eg2-test/',
  folder: 'eg2-test',
  files: Object.entries(CONTENT).map(([path, text]) => ({ path, sha256: sha(text), bytes: Buffer.byteLength(text), device: true, source: 'hf' as const })),
};

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bundled-model-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function fetched(content: Record<string, string> = CONTENT) {
  for (const [p, text] of Object.entries(content)) {
    const dest = join(sourceDir(root, pins), p);
    mkdirSync(join(dest, '..'), { recursive: true });
    writeFileSync(dest, text);
  }
}

const decide = (appEnv: string, embedder: 'device' | 'stub') => () => shouldBundle({ projectRoot: root, pins, appEnv, embedder });

describe('bundled model build (founder decision 2026-11-04)', () => {
  it('reads the same pins as core: device files, revision and bundle directory', () => {
    const real = readPins();
    expect(real.dir).toBe(EMBEDDING_MODEL.device?.dir);
    expect(real.folder).toBe(EMBEDDING_MODEL.device?.dir.split('/')[1]);
    expect(real.revision).toBe(EMBEDDING_MODEL.revision);
    expect(real.hfRepo).toBe(EMBEDDING_MODEL.hfRepo);
    expect(real.files).toEqual(deviceModelFiles());
    expect(sourceDir('/app', real)).toBe(`/app/assets/model/eg2-q4-${EMBEDDING_MODEL.revision.slice(0, 7)}`);
  });

  it('bundles a fetched and verified model', () => {
    fetched();
    expect(decide('production', 'device')()).toBe(true);
  });

  it('fails the prebuild when the model is missing or differs from its pin, naming the fix', () => {
    expect(decide('production', 'device')).toThrow(/missing: {2}onnx\/model_q4\.onnx_data[\s\S]*npm run fetch-model/);
    fetched({ ...CONTENT, 'onnx/model_q4.onnx_data': 'weights?' });
    expect(decide('development', 'device')).toThrow(/mismatch: onnx\/model_q4\.onnx_data/);
  });

  it('lets only a development stub build go without the model', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(decide('development', 'stub')()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/EXPO_PUBLIC_EMBEDDER=stub/));
    warn.mockRestore();
    expect(decide('production', 'stub')).toThrow(/APP_ENV=development only/);
  });

  it('stages exactly the pinned files under models/<folder>/ and drops stale ones', () => {
    fetched({ ...CONTENT, 'stray.part': 'partial download' });
    const nativeRoot = join(root, 'android', 'app', 'src', 'main', 'assets');
    mkdirSync(join(nativeRoot, 'models', 'eg2-q4-old'), { recursive: true });
    writeFileSync(join(nativeRoot, 'models', 'eg2-q4-old', 'tokenizer.json'), 'old');
    stageModel({ projectRoot: root, nativeRoot, pins, bundle: true });
    expect(readdirSync(join(nativeRoot, 'models'))).toEqual(['eg2-test']);
    for (const [p, text] of Object.entries(CONTENT)) expect(readFileSync(join(nativeRoot, pins.dir, p), 'utf8')).toBe(text);
    expect(existsSync(join(nativeRoot, pins.dir, 'stray.part'))).toBe(false);

    stageModel({ projectRoot: root, nativeRoot, pins, bundle: false });
    expect(readdirSync(join(nativeRoot, 'models'))).toEqual([]);
  });

  it('stores the ONNX files uncompressed in the APK, once', () => {
    const gradle = 'android {\n  namespace "dk.grouper.app"\n}\n';
    const out = addNoCompress(gradle);
    expect(out).toMatch(/androidResources \{\n\s+noCompress 'onnx', 'onnx_data'\n\s+\}/);
    expect(addNoCompress(out)).toBe(out);
  });

  it('adds models/ to Copy Bundle Resources as a folder reference, once', () => {
    cpSync(join(__dirname, 'fixtures', 'ios-sdk58'), join(root, 'ios'), { recursive: true });
    const project = IOSConfig.XcodeUtils.getPbxproj(root);
    addModelFolderReference(project, 'GrouperDev');
    addModelFolderReference(project, 'GrouperDev');
    const out: string = project.writeSync();
    const refs = out.split('\n').filter((l) => l.includes('isa = PBXFileReference') && l.includes('path = "GrouperDev/models"'));
    expect(refs).toHaveLength(1);
    expect(refs[0]).toContain('lastKnownFileType = folder;');
    expect(refs[0]).not.toContain('undefined');
    expect(out.match(/\/\* models in Resources \*\//g)).toHaveLength(2); // the build file and its entry in the phase
  });
});
