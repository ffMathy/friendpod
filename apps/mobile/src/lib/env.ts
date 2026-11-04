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

if (useEmulators && appConfig.appEnv !== 'development') {
  throw new Error('EXPO_PUBLIC_USE_EMULATORS is only allowed with APP_ENV=development');
}
