import { utf8Encode } from './utf8';

const P1 = 0x9e3779b1;
const P2 = 0x85ebca77;
const P3 = 0xc2b2ae3d;
const P4 = 0x27d4eb2f;
const P5 = 0x165667b1;

const rotl = (x: number, r: number): number => ((x << r) | (x >>> (32 - r))) >>> 0;
const mul = (a: number, b: number): number => Math.imul(a, b) >>> 0;
const read32 = (b: Uint8Array, i: number): number =>
  (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

function round(acc: number, lane: number): number {
  return mul(rotl((acc + mul(lane, P2)) >>> 0, 13), P1);
}

/** XXH32 (https://github.com/Cyan4973/xxHash) over the UTF-8 bytes of `input`. Used for deterministic tie-breaks (§6.5). */
export function xxhash32(input: string | Uint8Array, seed = 0): number {
  const b = typeof input === 'string' ? utf8Encode(input) : input;
  const len = b.length;
  let i = 0;
  let h: number;
  if (len >= 16) {
    let v1 = (seed + P1 + P2) >>> 0;
    let v2 = (seed + P2) >>> 0;
    let v3 = seed >>> 0;
    let v4 = (seed - P1) >>> 0;
    for (; i + 16 <= len; i += 16) {
      v1 = round(v1, read32(b, i));
      v2 = round(v2, read32(b, i + 4));
      v3 = round(v3, read32(b, i + 8));
      v4 = round(v4, read32(b, i + 12));
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) >>> 0;
  } else {
    h = (seed + P5) >>> 0;
  }
  h = (h + len) >>> 0;
  for (; i + 4 <= len; i += 4) h = mul(rotl((h + mul(read32(b, i), P3)) >>> 0, 17), P4);
  for (; i < len; i++) h = mul(rotl((h + mul(b[i]!, P5)) >>> 0, 11), P1);
  h = mul(h ^ (h >>> 15), P2);
  h = mul(h ^ (h >>> 13), P3);
  return (h ^ (h >>> 16)) >>> 0;
}
