import type { LatLon, Place, PublicPlaceType } from '@friendpod/core';

/** One Autocomplete row, already filtered to public place types (D8). */
export interface PlacePrediction {
  readonly placeId: string;
  readonly name: string;
  /** Street and town, for telling two cafés apart (without the country). */
  readonly secondary: string;
  /** The first public place type of the prediction ("cafe"), shown as "Café · Aarhus C"; null if unknown. */
  readonly type: PublicPlaceType | null;
}

/**
 * One picking session (Places "session token"): any number of autocomplete calls and one details call are billed
 * as a single session. Start a new one for every pick.
 */
export interface PlacesSession {
  autocomplete(input: string): Promise<PlacePrediction[]>;
  /** Ends the session. Rejects with PlaceNotPublicError if the place is not one of PUBLIC_PLACE_TYPES. */
  details(placeId: string): Promise<Place>;
}

export interface PlacesService {
  readonly kind: 'google' | 'stub';
  newSession(opts: { readonly language: 'da' | 'en'; readonly near: LatLon | null }): PlacesSession;
}

export class PlaceNotPublicError extends Error {
  constructor() {
    super('not a public place type');
    this.name = 'PlaceNotPublicError';
  }
}

export class PlacesUnavailableError extends Error {
  constructor(detail: string) {
    super(`places unavailable: ${detail}`);
    this.name = 'PlacesUnavailableError';
  }
}
