/**
 * Sensitivity detector and abuse similarity over precomputed prototype vectors (DESIGN.md §5.2 (2), (4), (5)).
 *
 * margin = max cos(tag, Art. 9 prototypes) − max cos(tag, hobby anchors); the tag is suspected when the
 * margin reaches the configured threshold. Prototype vectors are computed at build time into
 * `prototypes.bin`; its header carries a fingerprint of model, prompts and phrase lists, so a stale file
 * is refused at load instead of silently skewing the detector.
 */
import { createHash } from 'node:crypto';
import { ART9_CATEGORIES, type Art9Category } from '@grouper/core';
import abuseJson from '../prototypes/abuse.json';
import anchorsJson from '../prototypes/anchors.json';
import art9Json from '../prototypes/art9.da-en.json';
import { ABUSE_SHADOW, type ModelConfig } from './config';
import type { Embedder } from './model';
import { dot } from './lib/vectors';

export interface PrototypeLists {
  readonly art9: readonly { readonly phrase: string; readonly category: Art9Category }[];
  readonly anchors: readonly string[];
  readonly abuse: readonly string[];
  readonly versions: { readonly art9: string; readonly anchors: string; readonly abuse: string };
}

function isArt9Category(c: string): c is Art9Category {
  return (ART9_CATEGORIES as readonly string[]).includes(c);
}

function loadLists(): PrototypeLists {
  const art9: { phrase: string; category: Art9Category }[] = [];
  for (const [category, phrases] of Object.entries(art9Json.categories)) {
    if (!isArt9Category(category)) throw new Error(`prototypes/art9.da-en.json: unknown category ${category}`);
    for (const phrase of phrases) art9.push({ phrase, category });
  }
  return {
    art9,
    anchors: anchorsJson.phrases,
    abuse: abuseJson.phrases,
    versions: { art9: art9Json.version, anchors: anchorsJson.version, abuse: abuseJson.version },
  };
}

export const PROTOTYPE_LISTS: PrototypeLists = loadLists();

export interface Prototypes {
  readonly fingerprint: string;
  /** Embedded with the detector prompt. */
  readonly art9: readonly Float32Array[];
  readonly art9Categories: readonly Art9Category[];
  readonly anchors: readonly Float32Array[];
  /** Embedded with the tag prompt: compared against the tag's own vector. */
  readonly abuse: readonly Float32Array[];
}

export function prototypeFingerprint(model: ModelConfig, lists: PrototypeLists): string {
  const material = {
    modelId: model.modelId,
    dim: model.dim,
    detectorPrompt: model.detectorPrompt,
    tagPrompt: model.tagPrompt,
    art9: lists.art9,
    anchors: lists.anchors,
    abuse: lists.abuse,
  };
  return createHash('sha256').update(JSON.stringify(material)).digest('hex');
}

export async function computePrototypes(embedder: Embedder, model: ModelConfig, lists: PrototypeLists): Promise<Prototypes> {
  if (embedder.modelId !== model.modelId) throw new Error('computePrototypes: embedder and config disagree on the model');
  const art9 = await embedder.embed(lists.art9.map((p) => p.phrase), model.detectorPrompt);
  const anchors = await embedder.embed(lists.anchors, model.detectorPrompt);
  const abuse = await embedder.embed(lists.abuse, model.tagPrompt);
  return {
    fingerprint: prototypeFingerprint(model, lists),
    art9,
    art9Categories: lists.art9.map((p) => p.category),
    anchors,
    abuse,
  };
}

// ---------------------------------------------------------------- prototypes.bin

const MAGIC = 'GPROTO01';
const FORMAT = 'grouper-prototypes/1';

interface BinHeader {
  readonly format: typeof FORMAT;
  readonly fingerprint: string;
  readonly modelId: string;
  readonly dim: number;
  readonly counts: { readonly art9: number; readonly anchors: number; readonly abuse: number };
  readonly art9Categories: readonly Art9Category[];
}

/** Layout: magic (8 bytes) · u32 LE header length · JSON header · zero padding to 4 · float32 LE vectors. */
export function encodePrototypes(p: Prototypes, model: ModelConfig): Buffer {
  const header: BinHeader = {
    format: FORMAT,
    fingerprint: p.fingerprint,
    modelId: model.modelId,
    dim: model.dim,
    counts: { art9: p.art9.length, anchors: p.anchors.length, abuse: p.abuse.length },
    art9Categories: p.art9Categories,
  };
  const headerBytes = Buffer.from(JSON.stringify(header), 'utf8');
  const prefix = 8 + 4 + headerBytes.length;
  const dataStart = Math.ceil(prefix / 4) * 4;
  const vectors = [...p.art9, ...p.anchors, ...p.abuse];
  const buf = Buffer.alloc(dataStart + vectors.length * model.dim * 4);
  buf.write(MAGIC, 0, 'ascii');
  buf.writeUInt32LE(headerBytes.length, 8);
  headerBytes.copy(buf, 12);
  let off = dataStart;
  for (const v of vectors) {
    if (v.length !== model.dim) throw new Error('encodePrototypes: wrong vector dimension');
    for (const x of v) {
      buf.writeFloatLE(x, off);
      off += 4;
    }
  }
  return buf;
}

export class StalePrototypesError extends Error {
  constructor(reason: string) {
    super(`prototypes.bin does not match this build (${reason}); run \`npm run build-prototypes\``);
    this.name = 'StalePrototypesError';
  }
}

export function decodePrototypes(bytes: Uint8Array, model: ModelConfig, lists: PrototypeLists): Prototypes {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 12 || buf.toString('ascii', 0, 8) !== MAGIC) throw new StalePrototypesError('bad magic');
  const headerLength = buf.readUInt32LE(8);
  const header = JSON.parse(buf.toString('utf8', 12, 12 + headerLength)) as BinHeader;
  const expected = prototypeFingerprint(model, lists);
  if (header.format !== FORMAT) throw new StalePrototypesError('format');
  if (header.fingerprint !== expected || header.modelId !== model.modelId || header.dim !== model.dim) {
    throw new StalePrototypesError('fingerprint');
  }
  const { art9, anchors, abuse } = header.counts;
  const dataStart = Math.ceil((12 + headerLength) / 4) * 4;
  if (buf.length !== dataStart + (art9 + anchors + abuse) * model.dim * 4) throw new StalePrototypesError('length');
  let off = dataStart;
  const read = (n: number): Float32Array[] =>
    Array.from({ length: n }, () => {
      const v = new Float32Array(model.dim);
      for (let i = 0; i < model.dim; i++, off += 4) v[i] = buf.readFloatLE(off);
      return v;
    });
  return {
    fingerprint: header.fingerprint,
    art9: read(art9),
    art9Categories: header.art9Categories,
    anchors: read(anchors),
    abuse: read(abuse),
  };
}

// ---------------------------------------------------------------- scoring

export interface DetectorResult {
  readonly margin: number;
  /** Category of the closest Art. 9 prototype; about 80% right in v1 [EXP], so only a hint (§5.2 (5)). */
  readonly categoryGuess: Art9Category;
}

function maxCos(v: Float32Array, set: readonly Float32Array[]): { cos: number; index: number } {
  let best = { cos: -Infinity, index: -1 };
  set.forEach((p, index) => {
    const cos = dot(v, p);
    if (cos > best.cos) best = { cos, index };
  });
  if (best.index < 0) throw new Error('maxCos: empty prototype set');
  return best;
}

export function detectorMargin(detectorVec: Float32Array, p: Prototypes): DetectorResult {
  const sensitive = maxCos(detectorVec, p.art9);
  const hobby = maxCos(detectorVec, p.anchors);
  const categoryGuess = p.art9Categories[sensitive.index];
  if (!categoryGuess) throw new Error('detectorMargin: prototype without category');
  return { margin: sensitive.cos - hobby.cos, categoryGuess };
}

export type AbuseShadowLevel = 'ok' | 'hold' | 'reject';

/** Shadow mode only (§5.2 (2)): the caller counts the level and never acts on it. */
export function abuseShadowLevel(tagVec: Float32Array, p: Prototypes): AbuseShadowLevel {
  const { cos } = maxCos(tagVec, p.abuse);
  if (cos >= ABUSE_SHADOW.reject) return 'reject';
  if (cos >= ABUSE_SHADOW.hold) return 'hold';
  return 'ok';
}
