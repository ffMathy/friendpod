/** Preview fake of expo-calendar (and expo-calendar/legacy): the system "new event" sheet reports "saved". */
export const createEventInCalendarAsync = async (_event?: unknown) => ({ action: 'saved', id: 'preview-event' });
export const requestCalendarPermissionsAsync = async () => ({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' });
export const getCalendarPermissionsAsync = requestCalendarPermissionsAsync;
export const isAvailableAsync = async (): Promise<boolean> => true;
