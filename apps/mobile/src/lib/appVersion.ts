import Constants from 'expo-constants';

/**
 * The version from app.config.ts, recorded on consent events (PRIVACY.md §3.4). Kept apart from env.ts, which
 * validates the whole config at import time, so consent code stays importable where no config exists (jest).
 */
export const appVersion: string = Constants.expoConfig?.version ?? '0.0.0';
