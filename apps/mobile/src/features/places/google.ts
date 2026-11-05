import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { z } from 'zod';
import { publicPlaceType, toPlace } from './shape';
import { PlacesUnavailableError, type PlacePrediction, type PlacesService, type PlacesSession } from './types';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';
/** Bias, not a restriction: a pod may meet in the next town. */
const BIAS_RADIUS_M = 20_000;
const DETAILS_FIELDS = 'id,displayName,shortFormattedAddress,formattedAddress,location,primaryType,types';

const text = z.object({ text: z.string() });
const autocompleteResponse = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string(),
            text: text.optional(),
            structuredFormat: z.object({ mainText: text, secondaryText: text.optional() }).optional(),
            types: z.array(z.string()).default([]),
          })
          .optional(),
      }),
    )
    .default([]),
});
const detailsResponse = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }),
  shortFormattedAddress: z.string().optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  primaryType: z.string().optional(),
  types: z.array(z.string()).default([]),
});

/**
 * Places API (New) over REST from the app (D8): Autocomplete with a session token, then Place Details with the same
 * token, which closes the session for billing. The key is restricted to the app ids, so every call names the app.
 * Predictions are filtered here to PUBLIC_PLACE_TYPES: the API accepts at most 5 `includedPrimaryTypes` per request.
 * Google receives the typed text, the device's IP address and a bias circle around the user's ~5 km cell.
 */
export function createGooglePlaces(apiKey: string, appId: string, androidCertSha1: string | null): PlacesService {
  const headers = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    ...(Platform.OS === 'ios' ? { 'X-Ios-Bundle-Identifier': appId } : { 'X-Android-Package': appId }),
    ...(Platform.OS === 'android' && androidCertSha1 ? { 'X-Android-Cert': androidCertSha1 } : {}),
  });

  return {
    kind: 'google',
    newSession({ language, near }): PlacesSession {
      if (!apiKey) throw new PlacesUnavailableError('EXPO_PUBLIC_PLACES_KEY is not set');
      const sessionToken = Crypto.randomUUID();
      return {
        async autocomplete(input) {
          const res = await fetch(AUTOCOMPLETE_URL, {
            method: 'POST',
            headers: { ...headers(), 'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types' },
            body: JSON.stringify({
              input,
              sessionToken,
              languageCode: language,
              regionCode: 'dk',
              ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lon }, radius: BIAS_RADIUS_M } } } : {}),
            }),
          });
          if (!res.ok) throw new PlacesUnavailableError(`autocomplete ${res.status}`);
          const body = autocompleteResponse.parse(await res.json());
          return body.suggestions.flatMap(({ placePrediction: p }): PlacePrediction[] => {
            if (!p || publicPlaceType(null, p.types) === null) return [];
            const name = p.structuredFormat?.mainText.text ?? p.text?.text ?? '';
            return name ? [{ placeId: p.placeId, name, secondary: p.structuredFormat?.secondaryText?.text ?? '' }] : [];
          });
        },
        async details(placeId) {
          const url = `${DETAILS_URL}${encodeURIComponent(placeId)}?languageCode=${language}&sessionToken=${encodeURIComponent(sessionToken)}`;
          const res = await fetch(url, { headers: { ...headers(), 'X-Goog-FieldMask': DETAILS_FIELDS } });
          if (!res.ok) throw new PlacesUnavailableError(`details ${res.status}`);
          const d = detailsResponse.parse(await res.json());
          return toPlace({
            placeId: d.id,
            name: d.displayName.text,
            address: d.shortFormattedAddress ?? d.formattedAddress ?? d.displayName.text,
            lat: d.location.latitude,
            lng: d.location.longitude,
            primaryType: d.primaryType,
            types: d.types,
          });
        },
      };
    },
  };
}
