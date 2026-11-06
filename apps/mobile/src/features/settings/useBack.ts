import { useRouter, type Href } from 'expo-router';

/**
 * The in-page back chevron of Me, Settings and the info pages (they draw ScreenHeader instead of a native bar): back
 * when there is history, otherwise to `fallback` (the screen was opened by a deep link or a notification at launch).
 */
export function useBack(fallback: Href): () => void {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace(fallback));
}
