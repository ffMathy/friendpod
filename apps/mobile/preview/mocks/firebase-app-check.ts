/** Preview fake of @react-native-firebase/app-check. */
export interface AppCheck {
  readonly preview: true;
}

export class ReactNativeFirebaseAppCheckProvider {
  configure(_options: unknown): void {
    // Nothing to configure in the preview.
  }
}

const INSTANCE: AppCheck = { preview: true };
const TOKEN = { token: 'preview-app-check-token' };

export const initializeAppCheck = (_app?: unknown, _options?: unknown): AppCheck => INSTANCE;
export const getToken = async (_appCheck?: AppCheck, _forceRefresh?: boolean) => TOKEN;
export const getLimitedUseToken = async (_appCheck?: AppCheck) => TOKEN;
export const setTokenAutoRefreshEnabled = (): void => undefined;
export const onTokenChanged = (): (() => void) => () => undefined;

export default () => INSTANCE;
