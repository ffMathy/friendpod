/** Preview fake of expo-screen-capture: nothing to block in a browser screenshot of fixtures. */
export const usePreventScreenCapture = (_key?: string): void => undefined;
export const preventScreenCaptureAsync = async (_key?: string): Promise<void> => undefined;
export const allowScreenCaptureAsync = async (_key?: string): Promise<void> => undefined;
export const addScreenshotListener = () => ({ remove: () => undefined });
export const isAvailableAsync = async (): Promise<boolean> => true;
