/**
 * Sensitivity detector over precomputed prototype vectors (DESIGN.md §5.2 (5)), pure so it runs on the device (D1)
 * and on the server alike.
 *
 * margin = max cos(tag, Art. 9 prototypes) − max cos(tag, hobby anchors); the tag is flagged when the margin reaches
 * DETECTOR_MARGIN_THRESHOLD. The prototype vectors are embedded once from the phrase lists in `data/` with the pinned
 * model and STS prompt, into `prototypes.bin`. Its header names the model and the list versions, so a stale file is
 * refused at load instead of silently skewing the detector.
 */
import { ART9_CATEGORIES, type Art9Category } from '../types/domain';
import anchorsJson from './data/anchors.json';
import art9Json from './data/art9.da-en.json';
import { DETECTOR_MARGIN_THRESHOLD, EMBEDDING_MODEL, type EmbeddingModelConfig } from './model';

export interface PrototypeLists {
  readonly art9: readonly { readonly phrase: string; readonly category: Art9Category }[];
  readonly anchors: readonly string[];
  readonly versions: { readonly art9: string; readonly anchors: string };
}

function isArt9Category(c: string): c is Art9Category {
  return (ART9_CATEGORIES as readonly string[]).includes(c);
}

function loadLists(): PrototypeLists {
  const art9: { phrase: string; category: Art9Category }[] = [];
  for (const [category, phrases] of Object.entries(art9Json.categories)) {
    if (!isArt9Category(category)) throw new Error(`data/art9.da-en.json: unknown category ${category}`);
    for (const phrase of phrases) art9.push({ phrase, category });
  }
  return { art9, anchors: anchorsJson.phrases, versions: { art9: art9Json.version, anchors: anchorsJson.version } };
}

export const PROTOTYPE_LISTS: PrototypeLists = loadLists();

/** Texts to embed for prototypes.bin, in file order: Art. 9 phrases, then anchors, each with the detector prompt. */
export function prototypeTexts(lists: PrototypeLists = PROTOTYPE_LISTS, model: EmbeddingModelConfig = EMBEDDING_MODEL): string[] {
  return [...lists.art9.map((p) => p.phrase), ...lists.anchors].map((t) => model.detectorPrompt + t);
}

export interface Prototypes {
  readonly modelKey: string;
  readonly art9: readonly Float32Array[];
  readonly anchors: readonly Float32Array[];
}

// ---------------------------------------------------------------- prototypes.bin

const MAGIC = 'GPROTO02';
const FORMAT = 'grouper-prototypes/2';

interface BinHeader {
  readonly format: typeof FORMAT;
  readonly modelKey: string;
  readonly dim: number;
  readonly versions: PrototypeLists['versions'];
  readonly counts: { readonly art9: number; readonly anchors: number };
}

export class StalePrototypesError extends Error {
  constructor(reason: string) {
    super(`prototypes.bin does not match this build (${reason}); rebuild it from the phrase lists`);
    this.name = 'StalePrototypesError';
  }
}

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0x7f) throw new Error('prototypes.bin header must be ASCII');
    out[i] = c;
  }
  return out;
}

function asciiString(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    if (b > 0x7f) throw new StalePrototypesError('header not ASCII');
    s += String.fromCharCode(b);
  }
  return s;
}

function headerFor(model: EmbeddingModelConfig, lists: PrototypeLists): BinHeader {
  return {
    format: FORMAT,
    modelKey: model.modelKey,
    dim: model.dim,
    versions: lists.versions,
    counts: { art9: lists.art9.length, anchors: lists.anchors.length },
  };
}

/**
 * Layout: magic (8 bytes) · u32 LE header length · ASCII JSON header · zero padding to 4 · float32 LE vectors
 * (Art. 9 prototypes, then anchors). `vectors` are in prototypeTexts() order.
 */
export function encodePrototypes(vectors: readonly ArrayLike<number>[], model: EmbeddingModelConfig = EMBEDDING_MODEL, lists: PrototypeLists = PROTOTYPE_LISTS): Uint8Array {
  const header = headerFor(model, lists);
  if (vectors.length !== header.counts.art9 + header.counts.anchors) throw new Error('encodePrototypes: wrong vector count');
  const headerBytes = asciiBytes(JSON.stringify(header));
  const dataStart = Math.ceil((12 + headerBytes.length) / 4) * 4;
  const out = new Uint8Array(dataStart + vectors.length * model.dim * 4);
  out.set(asciiBytes(MAGIC), 0);
  const view = new DataView(out.buffer);
  view.setUint32(8, headerBytes.length, true);
  out.set(headerBytes, 12);
  let off = dataStart;
  for (const v of vectors) {
    if (v.length !== model.dim) throw new Error('encodePrototypes: wrong vector dimension');
    for (let i = 0; i < v.length; i++, off += 4) view.setFloat32(off, v[i]!, true);
  }
  return out;
}

export function decodePrototypes(bytes: Uint8Array, model: EmbeddingModelConfig = EMBEDDING_MODEL, lists: PrototypeLists = PROTOTYPE_LISTS): Prototypes {
  if (bytes.length < 12 || asciiString(bytes.subarray(0, 8)) !== MAGIC) throw new StalePrototypesError('bad magic');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(8, true);
  if (12 + headerLength > bytes.length) throw new StalePrototypesError('length');
  let header: BinHeader;
  try {
    header = JSON.parse(asciiString(bytes.subarray(12, 12 + headerLength))) as BinHeader;
  } catch {
    throw new StalePrototypesError('header');
  }
  if (JSON.stringify(header) !== JSON.stringify(headerFor(model, lists))) throw new StalePrototypesError('model or phrase lists');
  const dataStart = Math.ceil((12 + headerLength) / 4) * 4;
  const { art9, anchors } = header.counts;
  if (bytes.length !== dataStart + (art9 + anchors) * model.dim * 4) throw new StalePrototypesError('length');
  let off = dataStart;
  const read = (n: number): Float32Array[] =>
    Array.from({ length: n }, () => {
      const v = new Float32Array(model.dim);
      for (let i = 0; i < model.dim; i++, off += 4) v[i] = view.getFloat32(off, true);
      return v;
    });
  return { modelKey: header.modelKey, art9: read(art9), anchors: read(anchors) };
}

// ---------------------------------------------------------------- scoring

function maxCos(v: ArrayLike<number>, set: readonly Float32Array[]): number {
  if (set.length === 0) throw new Error('detectorMargin: empty prototype set');
  let best = -Infinity;
  for (const p of set) {
    if (p.length !== v.length) throw new Error('detectorMargin: dimension mismatch');
    let dot = 0;
    for (let i = 0; i < p.length; i++) dot += v[i]! * p[i]!;
    if (dot > best) best = dot;
  }
  return best;
}

/** Margin of a unit tag vector (the model's own, STS prompt). */
export function detectorMargin(tagVec: ArrayLike<number>, p: Prototypes): number {
  return maxCos(tagVec, p.art9) - maxCos(tagVec, p.anchors);
}

/** Flagged at or above the threshold; a missing or non-finite margin fails closed as flagged. */
export function isDetectorFlag(margin: number | null, threshold: number = DETECTOR_MARGIN_THRESHOLD): boolean {
  return margin === null || !Number.isFinite(margin) || margin >= threshold;
}
