import { PLACE_ADDRESS_MAX, PLACE_NAME_MAX, PUBLIC_PLACE_TYPES, googleMapsPlaceUrl, placeSchema, roundPlaceCoord, type Place, type PublicPlaceType } from '@friendpod/core';
import { PlaceNotPublicError } from './types';

const PUBLIC: ReadonlySet<string> = new Set(PUBLIC_PLACE_TYPES);

/** The first public type, preferring the primary one; null for anything else (homes, offices, addresses). */
export function publicPlaceType(primary: string | null | undefined, types: readonly string[]): PublicPlaceType | null {
  if (primary && PUBLIC.has(primary)) return primary as PublicPlaceType;
  return (types.find((t) => PUBLIC.has(t)) as PublicPlaceType | undefined) ?? null;
}

/** A Place exactly as proposeOption validates it: rounded coordinates and the built map URL (D8). */
export function toPlace(p: {
  readonly placeId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly primaryType: string | null | undefined;
  readonly types: readonly string[];
}): Place {
  const type = publicPlaceType(p.primaryType, p.types);
  if (!type) throw new PlaceNotPublicError();
  const name = clip(p.name, PLACE_NAME_MAX);
  return placeSchema.parse({
    placeId: p.placeId,
    name,
    address: clip(p.address, PLACE_ADDRESS_MAX),
    lat: roundPlaceCoord(p.lat),
    lng: roundPlaceCoord(p.lng),
    type,
    mapUrl: googleMapsPlaceUrl(p.placeId, name),
  });
}

/**
 * Trimmed to at most `max` UTF-16 units, trimmed again (the schema trims before it compares the map URL) and never
 * ending in half a surrogate pair, which encodeURIComponent would throw on.
 */
export function clip(text: string, max: number): string {
  let cut = text.trim().slice(0, max);
  if (/[\uD800-\uDBFF]$/u.test(cut)) cut = cut.slice(0, -1);
  return cut.trim();
}
