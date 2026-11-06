import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Top padding of a tab page that draws its own title (drop-home: 40 px above "This week"). Under a status bar the
 * safe-area inset already gives most of that room, so the page adds only what is missing, at least 16.
 */
export function useTabTopPadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(16, 40 - insets.top);
}
