/**
 * React Native Firebase, modular API (DESIGN.md §11). The default app is initialised natively from
 * GoogleService-Info.plist / google-services.json; this module adds App Check, the functions region
 * and, in development, the Emulator Suite.
 */
import { getApp } from '@react-native-firebase/app';
import { initializeAppCheck, ReactNativeFirebaseAppCheckProvider, type AppCheck } from '@react-native-firebase/app-check';
import { connectAuthEmulator, getAuth } from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from '@react-native-firebase/functions';
import { getMessaging } from '@react-native-firebase/messaging';
import { connectStorageEmulator, getStorage } from '@react-native-firebase/storage';
import { appCheckDebugToken, appConfig, emulatorHost, useEmulators } from '@/lib/env';

export const FUNCTIONS_REGION = 'europe-west1';

/** Emulator ports from DESIGN.md §13 (firebase.json at the repo root). */
export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, functions: 5001, storage: 9199 } as const;

let appCheckInstance: AppCheck | null = null;
let initialised = false;

/**
 * Must run before the first callable, Firestore or Storage request: App Check tokens are attached
 * automatically once a provider is installed. Idempotent.
 */
export function initFirebase(): void {
  if (initialised) return;
  initialised = true;

  const provider = new ReactNativeFirebaseAppCheckProvider();
  const debug = appConfig.appEnv === 'development';
  const debugToken = debug ? appCheckDebugToken : undefined;
  provider.configure({
    android: { provider: debug ? 'debug' : 'playIntegrity', ...(debugToken ? { debugToken } : {}) },
    apple: { provider: debug ? 'debug' : 'appAttestWithDeviceCheckFallback', ...(debugToken ? { debugToken } : {}) },
    isTokenAutoRefreshEnabled: true,
  });
  appCheckInstance = initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: true });

  if (useEmulators) {
    connectAuthEmulator(getAuth(), `http://${emulatorHost}:${EMULATOR_PORTS.auth}`);
    connectFirestoreEmulator(getFirestore(), emulatorHost, EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions(), emulatorHost, EMULATOR_PORTS.functions);
    connectStorageEmulator(getStorage(), emulatorHost, EMULATOR_PORTS.storage);
  }
}

export const auth = () => getAuth();
export const db = () => getFirestore();
export const functions = () => getFunctions(getApp(), FUNCTIONS_REGION);
export const storage = () => getStorage();
export const messaging = () => getMessaging();

export function appCheck(): AppCheck {
  if (!appCheckInstance) throw new Error('initFirebase() has not run');
  return appCheckInstance;
}
