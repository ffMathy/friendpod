/**
 * Deterministic stand-ins for the device's EmbeddingGemma vectors (D1). Each text gets a pseudo-random unit vector
 * seeded by its SHA-256; a link `{to, cos}` rotates it so that cos(text, to) is exactly `cos`, which lets a test place
 * a tag precisely relative to a concept's centroid or to a detector prototype.
 */
import { createHash } from 'node:crypto';
import { EMBEDDING_MODEL, detectorMargin, normalizeTag, type Prototypes } from '@friendpod/core';

export interface Link {
  readonly to: string;
  readonly cos: number;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function normalized(v: Float32Array): Float32Array {
  const n = Math.sqrt(dot(v, v));
  return v.map((x) => x / n);
}

function seededUnitVector(text: string, dim: number): Float32Array {
  const seed = createHash('sha256').update(text).digest();
  // xorshift128 seeded from the digest, Box-Muller for Gaussian components.
  let a = seed.readUInt32LE(0) | 1;
  let b = seed.readUInt32LE(4);
  let c = seed.readUInt32LE(8);
  let d = seed.readUInt32LE(12);
  const next = (): number => {
    const t = a ^ (a << 11);
    a = b;
    b = c;
    c = d;
    d = (d ^ (d >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return (d + 1) / 4294967297;
  };
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i += 2) {
    const r = Math.sqrt(-2 * Math.log(next()));
    const theta = 2 * Math.PI * next();
    v[i] = r * Math.cos(theta);
    if (i + 1 < dim) v[i + 1] = r * Math.sin(theta);
  }
  return normalized(v);
}

export class StubVectors {
  readonly #links: ReadonlyMap<string, Link>;

  constructor(links: Readonly<Record<string, Link>>) {
    this.#links = new Map(Object.entries(links));
  }

  vector(text: string, depth = 0): Float32Array {
    if (depth > 8) throw new Error('StubVectors: link chain too deep');
    const base = seededUnitVector(text, EMBEDDING_MODEL.dim);
    const link = this.#links.get(text);
    if (!link) return base;
    const anchor = this.vector(link.to, depth + 1);
    // Gram-Schmidt: the part of `base` orthogonal to `anchor`, then mix to the requested angle.
    const along = dot(base, anchor);
    const ortho = normalized(base.map((x, i) => x - along * anchor[i]!));
    const sin = Math.sqrt(Math.max(0, 1 - link.cos * link.cos));
    return normalized(anchor.map((x, i) => link.cos * x + sin * ortho[i]!));
  }

  prototypes(art9: readonly string[], anchors: readonly string[]): Prototypes {
    return { modelKey: EMBEDDING_MODEL.modelKey, art9: art9.map((t) => this.vector(t)), anchors: anchors.map((t) => this.vector(t)) };
  }

  /** One addInterests item as an honest app sends it: the vector of the normalized text and its detector margin. */
  item(text: string, prototypes: Prototypes, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const n = normalizeTag(text);
    const norm = n.ok ? n.norm : text;
    const vector = this.vector(norm);
    return { text, vector: Array.from(vector), detector: { margin: detectorMargin(vector, prototypes) }, ...extra };
  }
}
