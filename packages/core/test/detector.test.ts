import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  decodePrototypes,
  detectorMargin,
  encodePrototypes,
  isDetectorFlag,
  PROTOTYPE_LISTS,
  prototypeTexts,
  reconcileDetectorMargin,
  StalePrototypesError,
} from '../src/interests/detector';
import {
  DETECTOR_MARGIN_THRESHOLD,
  deviceModelFiles,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  embeddingInput,
  isModelVector,
  renormalize,
} from '../src/interests/model';

const unit = (i: number, dim = EMBEDDING_DIM): Float32Array => {
  const v = new Float32Array(dim);
  v[i % dim] = 1;
  return v;
};
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

describe('pinned model (§5.1, D1)', () => {
  it('pins the calibrated EmbeddingGemma 2 q4 graph, prompt and thresholds', () => {
    expect(EMBEDDING_MODEL).toMatchObject({
      modelKey: 'eg2-q4@daa72c5',
      revision: 'daa72c51243991dfcaf9f9137d2c573d8f7790c0',
      dtype: 'q4',
      dim: 768,
      tagPrompt: 'task: sentence similarity | query: ',
      detectorPrompt: 'task: sentence similarity | query: ',
      detectorMargin: -0.03,
      assign: { ordinaryMerge: 0.93, ordinaryLink: 0.9 },
    });
    expect(DETECTOR_MARGIN_THRESHOLD).toBe(-0.03);
    expect(embeddingInput('madlavning')).toBe('task: sentence similarity | query: madlavning');
    expect(EMBEDDING_MODEL.device).toMatchObject({ nativeOrt: '1.30.0', executionProviders: ['cpu'], npm: { 'onnxruntime-react-native': '1.24.3' } });
  });

  it('lists every device file with a sha256 and its size, smallest first', () => {
    const files = deviceModelFiles();
    expect(files.map((f) => f.path)).toEqual(['tokenizer_config.json', 'onnx/model_q4.onnx', 'tokenizer.json', 'onnx/model_q4.onnx_data']);
    for (const f of EMBEDDING_MODEL.files) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(files.find((f) => f.path === 'onnx/model_q4.onnx_data')?.bytes).toBe(174_028_800);
    expect(files.reduce((s, f) => s + f.bytes, 0)).toBeLessThan(210_000_000);
  });

  it('accepts only finite unit vectors of the model dimension', () => {
    expect(isModelVector(unit(3))).toBe(true);
    expect(isModelVector(unit(3).map((x) => x * 1.0009))).toBe(true);
    expect(isModelVector(unit(3).map((x) => x * 1.0011))).toBe(false);
    expect(isModelVector(unit(3, 767))).toBe(false);
    expect(isModelVector(unit(3).map((x, i) => (i === 0 ? Number.NaN : x)))).toBe(false);
    expect(Array.from(renormalize([3, 4]))).toEqual([expect.closeTo(0.6, 6), expect.closeTo(0.8, 6)]);
    expect(() => renormalize([0, 0])).toThrow();
  });
});

describe('detector (§5.2 (5)), pure for the device', () => {
  const lists = { art9: [{ phrase: 'p', category: 'health' as const }], anchors: ['a', 'b'], versions: { art9: 'art9-x', anchors: 'anchors-x' } };

  it('locks the phrase lists: changing them must bump their versions', () => {
    // Update the hashes together with the versions in data/*.json, then rebuild prototypes.bin.
    expect(PROTOTYPE_LISTS.versions).toEqual({ art9: 'art9-2026-11-04.1', anchors: 'anchors-2026-11-04.1' });
    expect(sha256(JSON.stringify(PROTOTYPE_LISTS.art9))).toBe('a4461f252107fbb4d3139565d2fabd845307521bbd43bfda94a50ca52b9c218c');
    expect(sha256(JSON.stringify(PROTOTYPE_LISTS.anchors))).toBe('bc3fadff17ab442150a701e22839466db33925cb14cfaf245de757aa3028b719');
    expect({ art9: PROTOTYPE_LISTS.art9.length, anchors: PROTOTYPE_LISTS.anchors.length }).toEqual({ art9: 110, anchors: 31 });
    expect(prototypeTexts()[0]).toBe(`task: sentence similarity | query: ${PROTOTYPE_LISTS.art9[0]!.phrase}`);
  });

  it('computes margin = max cos to Art. 9 prototypes − max cos to anchors', () => {
    const p = { modelKey: 'm', art9: [unit(0)], anchors: [unit(1), unit(2)] };
    const tag = new Float32Array(EMBEDDING_DIM);
    tag[0] = 0.6;
    tag[2] = 0.8;
    expect(detectorMargin(tag, p)).toBeCloseTo(-0.2, 6);
    expect(() => detectorMargin(tag, { ...p, anchors: [] })).toThrow();
  });

  it('flags at or above −0.03 and fails closed', () => {
    expect(isDetectorFlag(-0.03)).toBe(true);
    expect(isDetectorFlag(-0.0301)).toBe(false);
    expect(isDetectorFlag(null)).toBe(true);
    expect(isDetectorFlag(Number.NaN)).toBe(true);
    expect(isDetectorFlag(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('keeps the more cautious of the client and server margins', () => {
    expect(reconcileDetectorMargin(-0.1, null)).toBe(-0.1);
    expect(reconcileDetectorMargin(-0.1, -0.02)).toBe(-0.02);
    expect(reconcileDetectorMargin(0.05, -0.2)).toBe(0.05);
    expect(reconcileDetectorMargin(Number.NaN, -0.2)).toBeNull();
    expect(reconcileDetectorMargin(-0.2, Number.NaN)).toBeNull();
  });

  it('round-trips prototypes.bin and refuses a file for another model or other phrase lists', () => {
    const vectors = [unit(0), unit(1), unit(2)];
    const bin = encodePrototypes(vectors, EMBEDDING_MODEL, lists);
    const p = decodePrototypes(bin, EMBEDDING_MODEL, lists);
    expect(p.modelKey).toBe('eg2-q4@daa72c5');
    expect(p.art9).toHaveLength(1);
    expect(p.anchors.map((v) => v.indexOf(1))).toEqual([1, 2]);
    expect(() => decodePrototypes(bin, EMBEDDING_MODEL, { ...lists, versions: { ...lists.versions, anchors: 'anchors-y' } })).toThrow(StalePrototypesError);
    expect(() => decodePrototypes(bin, { ...EMBEDDING_MODEL, modelKey: 'other' }, lists)).toThrow(StalePrototypesError);
    expect(() => decodePrototypes(bin.subarray(0, bin.length - 4), EMBEDDING_MODEL, lists)).toThrow(StalePrototypesError);
    expect(() => decodePrototypes(new Uint8Array(20), EMBEDDING_MODEL, lists)).toThrow(StalePrototypesError);
    expect(() => encodePrototypes(vectors.slice(1), EMBEDDING_MODEL, lists)).toThrow();
    // A subarray view (e.g. a slice of a larger download buffer) decodes the same.
    const padded = new Uint8Array(bin.length + 8);
    padded.set(bin, 8);
    expect(decodePrototypes(padded.subarray(8), EMBEDDING_MODEL, lists).anchors[1]![2]).toBe(1);
  });
});
