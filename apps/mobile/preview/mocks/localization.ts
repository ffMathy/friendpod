/** Preview fake of expo-localization: the device language is the preview's locale, the zone Europe/Copenhagen. */
import { preview } from '../runtime/state';

const TAG = { da: 'da-DK', en: 'en-GB' } as const;

export function getLocales() {
  const locale = preview().locale;
  return [
    {
      languageTag: TAG[locale],
      languageCode: locale,
      languageScriptCode: null,
      regionCode: 'DK',
      languageRegionCode: 'DK',
      currencyCode: 'DKK',
      currencySymbol: 'kr.',
      languageCurrencyCode: 'DKK',
      languageCurrencySymbol: 'kr.',
      decimalSeparator: ',',
      digitGroupingSeparator: '.',
      textDirection: 'ltr' as const,
      measurementSystem: 'metric' as const,
      temperatureUnit: 'celsius' as const,
    },
  ];
}

export function getCalendars() {
  return [{ calendar: 'gregory', timeZone: 'Europe/Copenhagen', uses24hourClock: true, firstWeekday: 2 }];
}

export const useLocales = getLocales;
export const useCalendars = getCalendars;
