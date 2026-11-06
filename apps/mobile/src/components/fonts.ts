/**
 * Plus Jakarta Sans, one face per weight, keyed by the family names in theme.ts `FontFamily`. The root layout
 * loads these with `useFonts` and holds the splash screen until they are ready; app.config.ts also embeds the
 * same files natively (expo-font plugin).
 */
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { FontFamily } from './theme';

export const FONT_ASSETS = {
  [FontFamily['400']]: PlusJakartaSans_400Regular,
  [FontFamily['500']]: PlusJakartaSans_500Medium,
  [FontFamily['600']]: PlusJakartaSans_600SemiBold,
  [FontFamily['700']]: PlusJakartaSans_700Bold,
  [FontFamily['800']]: PlusJakartaSans_800ExtraBold,
} as const;
