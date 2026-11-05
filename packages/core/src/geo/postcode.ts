import type { Gh5 } from '../types/ids';
import postcodesJson from './dk-postcodes.json';
import { encodeGeohash } from './geohash';

const TABLE = postcodesJson.postcodes as unknown as Readonly<Record<string, readonly [string, number, number]>>;

/** Attribution that must be shown wherever the postcode table is credited (CC BY 4.0). */
export const POSTCODE_ATTRIBUTION: string = postcodesJson.attribution;

export interface PostcodeInfo {
  readonly postcode: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
}

export function lookupPostcode(postcode: string): PostcodeInfo | null {
  const code = postcode.trim();
  if (!/^\d{4}$/.test(code)) return null;
  const row = TABLE[code];
  return row ? { postcode: code, name: row[0], lat: row[1], lon: row[2] } : null;
}

/**
 * Postcode → geohash-5 on the device (§3.1 step 6). The postcode itself is discarded and never sent.
 */
export function postcodeToGh5(postcode: string): Gh5 | null {
  const info = lookupPostcode(postcode);
  return info ? encodeGeohash(info.lat, info.lon, 5) : null;
}

/** Coarse device location → geohash-5; the coordinates are discarded by the caller. */
export function coordinatesToGh5(lat: number, lon: number): Gh5 {
  return encodeGeohash(lat, lon, 5);
}
