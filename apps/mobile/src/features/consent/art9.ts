import { consentProofFor, currentLegalText, type Art9BlanketConsent, type LegalTextId, type Locale } from '@friendpod/core';
import { appVersion } from '@/lib/appVersion';

/** What a consent callable receives (PRIVACY.md §3.4): the proof of the exact text shown, never its content. */
export interface ConsentPayload {
  readonly textVersion: string;
  readonly textSha256: string;
  /** Recorded on the consent event (PRIVACY.md §3.4). */
  readonly appVersion: string;
  readonly checked: true;
}

export interface Art9BlanketCopy {
  readonly textId: LegalTextId;
  readonly copy: Art9BlanketConsent;
}

/** The current blanket Art. 9 consent text for the UI language (D3), verbatim from @friendpod/core. */
export function art9BlanketCopy(locale: Locale): Art9BlanketCopy {
  const text = currentLegalText('art9Blanket', locale);
  if (text.kind !== 'art9Blanket') throw new Error('art9Blanket text has the wrong kind');
  return { textId: text.id as LegalTextId, copy: text.content };
}

export function consentPayload(textId: LegalTextId): ConsentPayload {
  const proof = consentProofFor(textId);
  return { textVersion: proof.textVersion, textSha256: proof.textSha256, appVersion, checked: true };
}

/** The withdrawal confirmation (art9-withdraw-all), verbatim. */
export function art9WithdrawCopy(locale: Locale): string {
  const text = currentLegalText('withdrawConfirmation', locale);
  if (text.kind !== 'withdrawConfirmation') throw new Error('withdrawConfirmation text has the wrong kind');
  return text.content.text;
}
