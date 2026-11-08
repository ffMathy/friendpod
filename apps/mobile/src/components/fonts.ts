/**
 * The app's two type families, one face per weight, keyed by the family names in theme.ts: Plus Jakarta Sans 400–800
 * (`FontFamily`, everything you read) and Bricolage Grotesque 700/800 (`DisplayFontFamily`, display type; the static
 * opsz 14 cut). The root layout loads these with `useFonts` and holds the splash screen until they are ready;
 * app.config.ts also embeds the same files natively (expo-font plugin).
 */
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DisplayFontFamily, FontFamily } from './theme';

export const FONT_ASSETS = {
  [FontFamily['400']]: PlusJakartaSans_400Regular,
  [FontFamily['500']]: PlusJakartaSans_500Medium,
  [FontFamily['600']]: PlusJakartaSans_600SemiBold,
  [FontFamily['700']]: PlusJakartaSans_700Bold,
  [FontFamily['800']]: PlusJakartaSans_800ExtraBold,
  [DisplayFontFamily['700']]: BricolageGrotesque_700Bold,
  [DisplayFontFamily['800']]: BricolageGrotesque_800ExtraBold,
} as const;
