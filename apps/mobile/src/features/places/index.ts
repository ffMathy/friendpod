import { bundleId, placesApiKey, placesMode } from '@/lib/env';
import { createGooglePlaces } from './google';
import { createStubPlaces } from './stub';
import type { PlacesService } from './types';

export { PlaceNotPublicError, PlacesUnavailableError, type PlacePrediction, type PlacesService, type PlacesSession } from './types';

let instance: PlacesService | null = null;

export function getPlaces(): PlacesService {
  instance ??=
    placesMode === 'stub'
      ? createStubPlaces()
      : createGooglePlaces(placesApiKey, bundleId, process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1 ?? null);
  return instance;
}
