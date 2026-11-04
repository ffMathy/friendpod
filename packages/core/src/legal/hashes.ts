import type { ConsentScope } from '../types/domain';
import { getLegalText, LEGAL_TEXTS, type LegalTextId } from './consent-texts';

/**
 * SHA-256 (hex) of `canonicalLegalText()` of each unfilled template. Precomputed so the device needs
 * no hashing; test/legal.test.ts recomputes every value and locks it.
 */
export const LEGAL_TEXT_SHA256 = {
  'art9-tag-en-v1': 'c61666e57897b3e51186c67c4fd2d9a1b0984f4cc1621ed4b28090db85585c5c',
  'art9-tag-da-v1': '0e4f91d75744d38f8a0bfac0c339e5662518c4ca48c46823cd302d671fe1a0cb',
  'gender-en-v1': '1dee9a6f14751e78b3421d9709df1407cd0454e12386429bd29fcb7d1e077004',
  'gender-nonbinary-en-v1': '5749af3c6bd3faff814fddd802af9d84031fe343474fbe33776296d17e59a44c',
  'gender-da-v1': 'e10d655e35efbb81bb67d79b4122d92f0cc8b69d42f8881e4b39868576f19974',
  'interest-notice-en-v1': 'b6840ae41002dc8f0f435036dc7c3ec8893aea7e3bce85a291d19a43e29b5d80',
  'interest-notice-da-v1': '112c7c125ca91b74d5c608fea7a167d01304009fc28fb5eec38224b9ab46f058',
  'art9-withdraw-en-v1': '82ee0a12f3f3fb170eaf777ec15d5f8fab1526f2e911a2602f4ccd1bdfac1f70',
  'art9-withdraw-da-v1': '8bf1aaff1fa65806928c8efd44e733fa330aa6bd9af6559e27c5965e1a57aa44',
} as const satisfies Record<LegalTextId, string>;

export interface ConsentProof {
  readonly textVersion: string;
  readonly textSha256: string;
}

/** What the client sends with a consent: the shown text's version and hash. */
export function consentProofFor(id: LegalTextId): ConsentProof {
  return { textVersion: id, textSha256: LEGAL_TEXT_SHA256[id] };
}

/**
 * Server check (PRIVACY.md §3.4): the pair must name a known text of the expected consent scope.
 * Unknown pairs are rejected, so a stored consent record always proves which text was shown.
 */
export function isValidConsentProof(proof: ConsentProof, scope: ConsentScope): boolean {
  const text = getLegalText(proof.textVersion);
  if (!text || text.scope !== scope) return false;
  return (LEGAL_TEXT_SHA256 as Record<string, string>)[proof.textVersion] === proof.textSha256;
}

export const CONSENT_TEXT_IDS: readonly LegalTextId[] = LEGAL_TEXTS.filter((t) => t.scope !== null).map((t) => t.id);
