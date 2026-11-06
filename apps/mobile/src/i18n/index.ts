/**
 * i18next + react-i18next with the device language from expo-localization (DESIGN.md §11).
 * Danish for any da-* locale, English otherwise. Consent and other legal copy is not here: it comes
 * versioned and hashed from @grouper/core (legal/).
 *
 * DESIGN-DEVIATION: §11 says "ICU plurals"; this uses i18next's built-in CLDR plural keys
 * (`_one` / `_other`, via Intl.PluralRules) instead of adding i18next-icu + intl-messageformat.
 */
import type { Locale } from '@grouper/core';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { da, en } from './resources';

export const resources = { da: { translation: da }, en: { translation: en } } as const;

export function deviceLocale(): Locale {
  const first = getLocales()[0];
  return first?.languageCode === 'da' ? 'da' : 'en';
}

export function initI18n(lng: Locale = deviceLocale()) {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
      initAsync: false,
    });
  } else if (i18n.language !== lng) {
    void i18n.changeLanguage(lng);
  }
  return i18n;
}

/** The UI language as a core Locale (legal texts exist for exactly these). */
export function currentLocale(): Locale {
  return i18n.language === 'da' ? 'da' : 'en';
}

export { i18n };
