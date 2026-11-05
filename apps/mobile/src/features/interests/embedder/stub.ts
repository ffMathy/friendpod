import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL_ID,
  PROTOTYPE_LISTS,
  lexiconCheck,
  normalizeTag,
  renormalize,
  xxhash32,
  type Prototypes,
} from '@grouper/core';
import type { Embedder } from './types';

/** Mulberry32: a tiny seeded PRNG, so a norm always maps to the same vector. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(text: string): Float32Array {
  const next = prng(xxhash32(text, 0x67727570));
  const v = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < v.length; i++) v[i] = next() - 0.5;
  return renormalize(v);
}

// Two reserved axes make the detector's answer predictable: Art. 9 prototypes point along one, hobby anchors
// along the other, and every stub vector leans mostly towards one of them.
const ORDINARY_AXIS = 0;
const SENSITIVE_AXIS = 1;
const AXIS_WEIGHT = 0.8;
const NOISE_WEIGHT = 0.6;

function axisVector(axis: number, text: string): Float32Array {
  const n = noise(text);
  const v = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < v.length; i++) v[i] = NOISE_WEIGHT * n[i]!;
  v[axis] = v[axis]! + AXIS_WEIGHT;
  return renormalize(v);
}

const ART9_NORMS: ReadonlySet<string> = new Set(
  PROTOTYPE_LISTS.art9.flatMap((p) => {
    const n = normalizeTag(p.phrase);
    return n.ok ? [n.norm] : [];
  }),
);

/** The stub's stand-in for the model's judgement: a lexicon hit or an exact Art. 9 prototype phrase. */
export function stubLooksSensitive(norm: string): boolean {
  return lexiconCheck(norm).hit || ART9_NORMS.has(norm);
}

/**
 * Deterministic embedder for tests and for development builds with EXPO_PUBLIC_EMBEDDER=stub (no model download).
 * Equal norms give equal vectors and different norms nearly orthogonal ones, so the server's merge and
 * "did you mean" paths still behave; the detector flags exactly the tags `stubLooksSensitive` names. The vectors
 * are not the model's: a stub build must never talk to a real backend (env.ts refuses it outside development).
 */
export function createStubEmbedder(): Embedder {
  const prototypes: Prototypes = {
    modelKey: EMBEDDING_MODEL_ID,
    art9: [axisVector(SENSITIVE_AXIS, 'stub-art9')],
    anchors: [axisVector(ORDINARY_AXIS, 'stub-anchor')],
  };
  return {
    kind: 'stub',
    load: async () => undefined,
    embed: async (norms) => norms.map((norm) => axisVector(stubLooksSensitive(norm) ? SENSITIVE_AXIS : ORDINARY_AXIS, norm)),
    prototypes: async () => prototypes,
    release: async () => undefined,
  };
}
