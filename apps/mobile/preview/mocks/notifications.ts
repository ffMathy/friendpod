/** Preview fake of expo-notifications (not used by the app today; mapped so a future import cannot break the preview). */
const subscription = () => ({ remove: () => undefined });
const permission = async () => ({ status: 'undetermined', granted: false, canAskAgain: true, expires: 'never' });

export const getPermissionsAsync = permission;
export const requestPermissionsAsync = permission;
export const setNotificationHandler = (): void => undefined;
export const addNotificationReceivedListener = subscription;
export const addNotificationResponseReceivedListener = subscription;
export const getLastNotificationResponseAsync = async () => null;
export const scheduleNotificationAsync = async () => 'preview-notification';
export const cancelAllScheduledNotificationsAsync = async (): Promise<void> => undefined;
export const setBadgeCountAsync = async (): Promise<boolean> => true;
export const getDevicePushTokenAsync = async () => ({ type: 'web', data: 'preview' });
export const useLastNotificationResponse = () => null;
