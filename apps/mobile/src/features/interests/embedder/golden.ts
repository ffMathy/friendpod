import { DEVICE_GOLDEN_TOLERANCE, normalizeTag } from '@grouper/core';
import type { Embedder } from './types';

export interface GoldenReference {
  readonly text: string;
  /** The calibration run's vector for `text` (server ORT, STS prompt). */
  readonly vector: ArrayLike<number>;
}

export interface GoldenResult {
  readonly pass: boolean;
  readonly minCosine: number;
  /** Largest |cos_device(a, b) − cos_reference(a, b)| over all pairs. */
  readonly maxPairwiseDiff: number;
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/**
 * The dev-build golden test (research: "Does the phone output match the server?"): ARM kernels differ slightly from
 * x86, so a device must reproduce the calibration vectors within DEVICE_GOLDEN_TOLERANCE before its vectors are
 * trusted against the shared thresholds. Run on every model or ORT version change.
 */
export async function runGoldenTest(embedder: Embedder, refs: readonly GoldenReference[]): Promise<GoldenResult> {
  const norms = refs.map((r) => {
    const n = normalizeTag(r.text);
    if (!n.ok) throw new Error(`golden text does not normalize: ${r.text}`);
    return n.norm;
  });
  await embedder.load();
  const got = await embedder.embed(norms);
  let minCosine = 1;
  for (let i = 0; i < refs.length; i++) minCosine = Math.min(minCosine, dot(got[i]!, refs[i]!.vector));
  let maxPairwiseDiff = 0;
  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      maxPairwiseDiff = Math.max(maxPairwiseDiff, Math.abs(dot(got[i]!, got[j]!) - dot(refs[i]!.vector, refs[j]!.vector)));
    }
  }
  const pass = minCosine >= DEVICE_GOLDEN_TOLERANCE.minCosine && maxPairwiseDiff <= DEVICE_GOLDEN_TOLERANCE.pairwiseAbs;
  return { pass, minCosine, maxPairwiseDiff };
}

/**
 * The reference set (DEVICE_GOLDEN_TOLERANCE.texts calibration texts and their vectors) is not packaged yet: it has to
 * be exported from research/embedding-calibration into core alongside prototypes.bin.
 */
export async function loadGoldenReferences(): Promise<readonly GoldenReference[]> {
  throw new Error('NOT_IMPLEMENTED: golden reference vectors are not packaged in @grouper/core yet');
}
