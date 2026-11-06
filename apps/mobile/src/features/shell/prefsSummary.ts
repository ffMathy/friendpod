import type { Prefs } from '@grouper/core';
import type { TFunction } from 'i18next';

/** Spaces inside one part of the summary don't break, so a wrap falls between the parts, never inside one. */
const keepTogether = (s: string) => s.replace(/ /g, ' ');

/**
 * "Ages 28–42 · about 10 km · Dansk, English" / "28–42 år · ca. 10 km · Dansk, English": the pod preferences in one
 * line, as drop-home sums them up. The languages carry the names the preferences page and the language picker give
 * them, each in itself ("Dansk", "English"), in both app languages, as drop-home does.
 */
export function prefsSummary(t: TFunction, prefs: Pick<Prefs, 'ageMin' | 'ageMax' | 'maxKm' | 'languages'>): string {
  return [
    t('me.prefsAges', { min: prefs.ageMin, max: prefs.ageMax }),
    t('me.prefsKm', { km: prefs.maxKm }),
    prefs.languages.map((l) => t(`languages.${l}`)).join(', '),
  ]
    .map(keepTogether)
    .join(' · ');
}
