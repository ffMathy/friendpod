import type { Gh5 } from '../types/ids';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const DECODE = new Map<string, number>([...BASE32].map((ch, i) => [ch, i]));

export const GH5_PRECISION = 5;
export const GH5_PATTERN = /^[0-9b-hjkmnp-z]{5}$/;

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

export interface GeohashBounds {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLon: number;
  readonly maxLon: number;
}

export function isGh5(value: string): value is Gh5 {
  return GH5_PATTERN.test(value);
}

export function encodeGeohash(lat: number, lon: number, precision: number = GH5_PRECISION): string {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('geohash: latitude out of range');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new RangeError('geohash: longitude out of range');
  if (!Number.isInteger(precision) || precision < 1 || precision > 12) throw new RangeError('geohash: precision 1-12');
  let latLo = -90;
  let latHi = 90;
  let lonLo = -180;
  let lonHi = 180;
  let out = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;
  while (out.length < precision) {
    if (evenBit) {
      const mid = (lonLo + lonHi) / 2;
      if (lon >= mid) {
        ch = (ch << 1) | 1;
        lonLo = mid;
      } else {
        ch <<= 1;
        lonHi = mid;
      }
    } else {
      const mid = (latLo + latHi) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latLo = mid;
      } else {
        ch <<= 1;
        latHi = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      out += BASE32[ch]!;
      bit = 0;
      ch = 0;
    }
  }
  return out;
}

export function geohashBounds(hash: string): GeohashBounds {
  if (hash.length === 0 || hash.length > 12) throw new RangeError('geohash: length 1-12');
  let latLo = -90;
  let latHi = 90;
  let lonLo = -180;
  let lonHi = 180;
  let evenBit = true;
  for (const ch of hash) {
    const v = DECODE.get(ch);
    if (v === undefined) throw new RangeError('geohash: invalid character');
    for (let b = 4; b >= 0; b--) {
      const on = ((v >> b) & 1) === 1;
      if (evenBit) {
        const mid = (lonLo + lonHi) / 2;
        if (on) lonLo = mid;
        else lonHi = mid;
      } else {
        const mid = (latLo + latHi) / 2;
        if (on) latLo = mid;
        else latHi = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { minLat: latLo, maxLat: latHi, minLon: lonLo, maxLon: lonHi };
}

/** Cell centre. H2 compares these centroids, never true positions (§6.1). */
export function geohashCentroid(hash: string): LatLon {
  const b = geohashBounds(hash);
  return { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 };
}
