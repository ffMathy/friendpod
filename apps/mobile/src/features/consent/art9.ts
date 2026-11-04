import {
  consentProofFor,
  currentLegalText,
  fillTag,
  type Art9Category,
  type Art9ConsentSheet,
  type LegalTextId,
  type Locale,
} from '@grouper/core';
import { appVersion } from '@/lib/appVersion';

/** What `addInterests` receives with an explicit consent (§5.2 (5), PRIVACY.md §3.4). */
export interface ConsentPayload {
  readonly textVersion: string;
  readonly textSha256: string;
  /** Recorded on the consent event (PRIVACY.md §3.4). */
  readonly appVersion: string;
  readonly checked: true;
}

export interface Art9ConsentGrant {
  readonly consent: ConsentPayload;
  /** Optional: the user may name the category; the sheet lists all of them (PRIVACY.md §3.1). */
  readonly category?: Art9Category;
}

export interface Art9ConsentCopy {
  readonly textId: LegalTextId;
  readonly sheet: Art9ConsentSheet;
}

/** The current Art. 9 consent text for the UI language, verbatim from @grouper/core. */
export function art9ConsentCopy(locale: Locale): Art9ConsentCopy {
  const text = currentLegalText('art9Consent', locale);
  if (text.kind !== 'art9Consent') throw new Error('art9Consent text has the wrong kind');
  return { textId: text.id as LegalTextId, sheet: text.content };
}

/** The proof names the unfilled template (version + SHA-256), never the tag itself. */
export function art9ConsentPayload(textId: LegalTextId): ConsentPayload {
  const proof = consentProofFor(textId);
  return { textVersion: proof.textVersion, textSha256: proof.textSha256, appVersion, checked: true };
}

export function fillSheet(sheet: Art9ConsentSheet, tag: string): Art9ConsentSheet {
  return {
    ...sheet,
    intro: fillTag(sheet.intro, tag),
    bullets: sheet.bullets.map((b) => fillTag(b, tag)),
    withdrawal: fillTag(sheet.withdrawal, tag),
    checkbox: fillTag(sheet.checkbox, tag),
  };
}
