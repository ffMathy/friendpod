/** Preview fake of @react-native-firebase/messaging: permission from the scenario, a fixed token, no pushes. */
import { preview } from '../runtime/state';

export interface Messaging {
  readonly preview: true;
}

export interface RemoteMessage {
  readonly messageId?: string;
  readonly data?: Record<string, string>;
  readonly notification?: { readonly title?: string; readonly body?: string };
}

export const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 } as const;

const MESSAGING: Messaging = { preview: true };
let granted: boolean | null = null;

function status(): number {
  if (granted !== null) return granted ? AuthorizationStatus.AUTHORIZED : AuthorizationStatus.DENIED;
  switch (preview().scenario.pushPermission) {
    case 'granted':
      return AuthorizationStatus.AUTHORIZED;
    case 'denied':
      return AuthorizationStatus.DENIED;
    default:
      return AuthorizationStatus.NOT_DETERMINED;
  }
}

const unsubscribe = () => () => undefined;

export const getMessaging = (_app?: unknown): Messaging => MESSAGING;
export const hasPermission = async (_m?: Messaging): Promise<number> => status();
export const requestPermission = async (_m?: Messaging, _options?: unknown): Promise<number> => {
  granted = true;
  return status();
};
export const getToken = async (_m?: Messaging): Promise<string> => 'preview-fcm-token';
export const deleteToken = async (_m?: Messaging): Promise<void> => undefined;
export const registerDeviceForRemoteMessages = async (_m?: Messaging): Promise<void> => undefined;
export const unregisterDeviceForRemoteMessages = async (_m?: Messaging): Promise<void> => undefined;
export const isDeviceRegisteredForRemoteMessages = (_m?: Messaging): boolean => true;
export const getInitialNotification = async (_m?: Messaging): Promise<RemoteMessage | null> => null;
export const onNotificationOpenedApp = unsubscribe;
export const onMessage = unsubscribe;
export const onTokenRefresh = unsubscribe;
export const setBackgroundMessageHandler = (): void => undefined;
export const setAutoInitEnabled = async (): Promise<void> => undefined;

export default () => MESSAGING;
