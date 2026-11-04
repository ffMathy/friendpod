/** Small dense-vector helpers. All embedding vectors in the embedder are unit-length Float32Arrays. */

export function dot(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error('dot: dimension mismatch');
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/** Returns a unit-length copy; throws on a zero or non-finite norm (the NaN guard of §5.1). */
export function normalized(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  const n = Math.sqrt(s);
  if (!Number.isFinite(n) || n === 0) throw new Error('normalized: zero or non-finite vector');
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

/** Matryoshka truncation: keep the first `dim` components, then re-normalize (§5.1). */
export function truncateNormalize(v: Float32Array, dim: number): Float32Array {
  if (dim > v.length) throw new Error('truncateNormalize: dim larger than vector');
  return normalized(v.subarray(0, dim));
}

export function addInto(sum: Float32Array, v: Float32Array, sign: 1 | -1): void {
  if (sum.length !== v.length) throw new Error('addInto: dimension mismatch');
  for (let i = 0; i < v.length; i++) sum[i] = sum[i]! + sign * v[i]!;
}

/** Float32 little-endian bytes, the layout of `concepts.sum` and `concepts.c128` (§8.2). */
export function toF32Bytes(v: Float32Array): Buffer {
  const buf = Buffer.alloc(v.length * 4);
  for (let i = 0; i < v.length; i++) buf.writeFloatLE(v[i]!, i * 4);
  return buf;
}

export function fromF32Bytes(bytes: Uint8Array, dim: number): Float32Array {
  if (bytes.byteLength !== dim * 4) throw new Error('fromF32Bytes: unexpected length');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(dim);
  for (let i = 0; i < dim; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}
