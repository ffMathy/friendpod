import { describe, expect, it } from 'vitest';
import { MODEL } from '../src/config';
import { dot, fromF32Bytes, toF32Bytes, truncateNormalize } from '../src/lib/vectors';
import { StubEmbedder } from '../src/model';

describe('StubEmbedder', () => {
  const stub = new StubEmbedder(MODEL.modelId, MODEL.dim, {
    child: { to: 'parent', cos: 0.93 },
    grandchild: { to: 'child', cos: 0.5 },
  });

  it('returns deterministic unit vectors of the configured dimension', async () => {
    const [a, b] = await stub.embed(['cooking', 'cooking'], MODEL.tagPrompt);
    expect(a).toHaveLength(MODEL.dim);
    expect(dot(a!, a!)).toBeCloseTo(1, 6);
    expect(Array.from(a!)).toEqual(Array.from(b!));
    expect(new StubEmbedder(MODEL.modelId, MODEL.dim).vector('cooking')).toEqual(a);
    expect(stub.calls.at(-1)).toEqual({ texts: ['cooking', 'cooking'], prompt: MODEL.tagPrompt });
  });

  it('places a linked text at the exact requested cosine', () => {
    expect(dot(stub.vector('child'), stub.vector('parent'))).toBeCloseTo(0.93, 6);
    expect(dot(stub.vector('grandchild'), stub.vector('child'))).toBeCloseTo(0.5, 6);
  });

  it('keeps unrelated texts near-orthogonal', () => {
    expect(Math.abs(dot(stub.vector('løb'), stub.vector('brætspil')))).toBeLessThan(0.2);
  });
});

describe('vectors', () => {
  it('re-normalizes after Matryoshka truncation', () => {
    const v = new StubEmbedder(MODEL.modelId, MODEL.dim).vector('x');
    const t = truncateNormalize(v, 128);
    expect(t).toHaveLength(128);
    expect(dot(t, t)).toBeCloseTo(1, 6);
    expect(() => truncateNormalize(new Float32Array(4), 2)).toThrow(/zero/);
  });

  it('round-trips float32 little-endian bytes', () => {
    const v = Float32Array.from([1.5, -2.25, 3e-7]);
    expect(Array.from(fromF32Bytes(toF32Bytes(v), 3))).toEqual(Array.from(v));
    expect(toF32Bytes(v).readFloatLE(4)).toBe(-2.25);
  });
});
