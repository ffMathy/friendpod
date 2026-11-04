import Constants from 'expo-constants';
import { z } from 'zod';

/** `extra` written by app.config.ts. */
const extraSchema = z.object({
  appEnv: z.enum(['development', 'staging', 'production']),
  emailLinkDomain: z.string().min(1),
  googleWebClientId: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof extraSchema>['appEnv'];

export const appConfig = extraSchema.parse(Constants.expoConfig?.extra);
export const bundleId: string =
  Constants.expoConfig?.ios?.bundleIdentifier ?? Constants.expoConfig?.android?.package ?? 'unknown';

/** EXPO_PUBLIC_* values are inlined at bundle time. */
export const useEmulators = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';
/** Android maps `localhost` to the host machine (10.0.2.2) itself; set this for a physical device. */
export const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? 'localhost';
/** Optional pre-registered App Check debug token for development builds. */
export const appCheckDebugToken = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;
/** Google Places (New) API key, restricted to the app ids and the Places API (D8). */
export const placesApiKey = process.env.EXPO_PUBLIC_PLACES_KEY ?? '';

/**
 * `stub` replaces the bundled ~207 MB model with deterministic fake vectors (EXPO_PUBLIC_EMBEDDER=stub), so a
 * development build can go without it; tests always use it. Stub vectors are not the model's, so they must never reach a real backend's concept space.
 */
export const embedderMode: 'device' | 'stub' =
  process.env.EXPO_PUBLIC_EMBEDDER === 'stub' || process.env.NODE_ENV === 'test' ? 'stub' : 'device';
/** Same for Places: `stub` returns a fixed list of public places (EXPO_PUBLIC_PLACES=stub, and in tests). */
export const placesMode: 'google' | 'stub' =
  process.env.EXPO_PUBLIC_PLACES === 'stub' || process.env.NODE_ENV === 'test' ? 'stub' : 'google';

if (useEmulators && appConfig.appEnv !== 'development') {
  throw new Error('EXPO_PUBLIC_USE_EMULATORS is only allowed with APP_ENV=development');
}
if (embedderMode === 'stub' && appConfig.appEnv !== 'development') {
  throw new Error('EXPO_PUBLIC_EMBEDDER=stub is only allowed with APP_ENV=development');
}
if (placesMode === 'stub' && appConfig.appEnv !== 'development') {
  throw new Error('EXPO_PUBLIC_PLACES=stub is only allowed with APP_ENV=development');
}
