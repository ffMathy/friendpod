import { genderConsentText, type Gender, type GenderConsentSheet, type LegalTextId, type Locale } from '@grouper/core';
import { consentPayload, type ConsentPayload } from '@/features/consent/art9';

export interface GenderConsentCopy {
  readonly textId: LegalTextId;
  readonly sheet: GenderConsentSheet;
  /** The copy is shown in another language than the UI because no translation exists yet. */
  readonly fallback: boolean;
}

/** Gender consent copy (PRIVACY.md §3.6), verbatim from @grouper/core. */
export function genderConsentCopy(locale: Locale, gender: Gender): GenderConsentCopy {
  const nonbinary = gender === 'nonbinary';
  const exact = genderConsentText(locale, nonbinary);
  // DESIGN-DEVIATION: there is no Danish non-binary addendum (core has no 'gender-nonbinary-da-v2').
  // Rather than hiding the option from Danish users, the reviewed English text is shown and recorded.
  const text = exact ?? genderConsentText('en', nonbinary);
  if (!text || text.kind !== 'genderConsent') throw new Error('missing gender consent text');
  return { textId: text.id as LegalTextId, sheet: text.content, fallback: exact === null };
}

export function genderConsentPayload(textId: LegalTextId): ConsentPayload {
  return consentPayload(textId);
}
