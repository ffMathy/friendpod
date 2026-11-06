import type { PublicPlaceType } from '@grouper/core';
import { toPlace } from './shape';
import { PlaceNotPublicError, type PlacePrediction, type PlacesService } from './types';

interface StubPlace {
  readonly placeId: string;
  readonly name: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly primaryType: string;
}

/** Fixed Aarhus places, plus one non-public result to exercise the type filter. */
export const STUB_PLACES: readonly StubPlace[] = [
  { placeId: 'ChIJstubDokk1Aarhus01', name: 'Dokk1', address: 'Hack Kampmanns Plads 2, Aarhus', lat: 56.1535, lng: 10.2142, primaryType: 'library' },
  { placeId: 'ChIJstubCafeNord0001', name: 'Café Nord', address: 'Nørregade 1, Aarhus', lat: 56.1592, lng: 10.2087, primaryType: 'cafe' },
  { placeId: 'ChIJstubBotanisk0001', name: 'Botanisk Have', address: 'Peter Holms Vej, Aarhus', lat: 56.1601, lng: 10.1942, primaryType: 'botanical_garden' },
  { placeId: 'ChIJstubAroS00000001', name: 'ARoS', address: 'Aros Allé 2, Aarhus', lat: 56.1539, lng: 10.1997, primaryType: 'museum' },
  { placeId: 'ChIJstubPrivateHome1', name: 'Nørregade 12, 3. tv', address: 'Nørregade 12, Aarhus', lat: 56.1593, lng: 10.2081, primaryType: 'street_address' },
];

/** Deterministic Places for tests and for development builds with EXPO_PUBLIC_PLACES=stub; nothing leaves the phone. */
export function createStubPlaces(): PlacesService {
  return {
    kind: 'stub',
    newSession: () => ({
      async autocomplete(input) {
        const q = input.trim().toLowerCase();
        if (q.length === 0) return [];
        return STUB_PLACES.filter((p) => p.primaryType !== 'street_address' && p.name.toLowerCase().includes(q)).map(
          (p): PlacePrediction => ({ placeId: p.placeId, name: p.name, secondary: p.address, type: p.primaryType as PublicPlaceType }),
        );
      },
      async details(placeId) {
        const p = STUB_PLACES.find((x) => x.placeId === placeId);
        if (!p) throw new PlaceNotPublicError();
        return toPlace({ ...p, types: [p.primaryType] });
      },
    }),
  };
}
