import { usePreventScreenCapture } from 'expo-screen-capture';

/** Mounted on sensitive-themed pod screens only (PRIVACY.md §4.3 Copying). */
export function ScreenCaptureGuard() {
  usePreventScreenCapture('sensitive-pod');
  return null;
}
