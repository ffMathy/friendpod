import type { Prefs } from '@friendpod/core';
import type { TFunction } from 'i18next';

/** Spaces inside one part of the summary don't break, so a wrap never falls inside a part. */
const keepTogether = (s: string) => s.replace(/ /g, ' ');

/**
 * The pod preferences under Me's "Pod preferences" row, in two lines: the ages and the distance, then the meetup
 * languages ("Ages 28–42 · about 10 km" / "Danish, English"; "28–42 år · ca. 10 km" / "Dansk, Engelsk"). The
 * languages always start their own line, so a narrow screen or a longer language never wraps the summary at a
 * separator and leaves a "·" at the end of a line. They carry the names the Preferences page behind the row gives
 * them, in the reader's language ("Engelsk" in Danish), not the language picker's own names.
 */
export function prefsSummary(t: TFunction, prefs: Pick<Prefs, 'ageMin' | 'ageMax' | 'maxKm' | 'languages'>): string {
  const reach = [t('me.prefsAges', { min: prefs.ageMin, max: prefs.ageMax }), t('me.prefsKm', { km: prefs.maxKm })].map(keepTogether).join(' · ');
  const languages = prefs.languages.map((l) => keepTogether(t(`prefs.language.${l}`))).join(', ');
  return `${reach}\n${languages}`;
}
