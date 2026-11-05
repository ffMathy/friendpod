import type { ConsentScope } from '../types/domain';
import { getLegalText, LEGAL_TEXTS, type LegalTextId } from './consent-texts';

/**
 * SHA-256 (hex) of `canonicalLegalText()` of each text. Precomputed so the device needs
 * no hashing; test/legal.test.ts recomputes every value and locks it.
 */
export const LEGAL_TEXT_SHA256 = {
  'art9-blanket-en-v1': '0fd60c2dfeea917ba93d31635bb80ad9423f31815f25fde628f041e53d9bc60c',
  'art9-blanket-da-v1': '443dbe0ab033c96307879c6a975f96220f95cd45f7f2a00b7f817b9ff19068ba',
  'gender-en-v1': '1dee9a6f14751e78b3421d9709df1407cd0454e12386429bd29fcb7d1e077004',
  'gender-nonbinary-en-v1': '5749af3c6bd3faff814fddd802af9d84031fe343474fbe33776296d17e59a44c',
  'gender-da-v1': 'e10d655e35efbb81bb67d79b4122d92f0cc8b69d42f8881e4b39868576f19974',
  'interest-notice-en-v2': '596f74a7aaaa5f702483d7c474b68cf41cecfcf3e5d9308c251c76c93f36385c',
  'interest-notice-da-v2': 'b63d67b68971a7a3d2166b15fc69b000928d0dfe9e58e7619be8d43d69bcf3d0',
  'art9-withdraw-all-en-v1': '984ec9e1a0d3b196745db8d757390eae48cc7422ccee9e16dcfd3163c7807416',
  'art9-withdraw-all-da-v1': '958d083e39f64d4411bfe769763538d6bcb700f330b5977b553999d7b05e9632',
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

/** The blanket Art. 9 consent proof for setArt9Consent (D3): a known `art9Blanket` text with its exact hash. */
export function isValidArt9ConsentProof(proof: ConsentProof): boolean {
  return isValidConsentProof(proof, 'art9') && getLegalText(proof.textVersion)?.kind === 'art9Blanket';
}

export const CONSENT_TEXT_IDS: readonly LegalTextId[] = LEGAL_TEXTS.filter((t) => t.scope !== null).map((t) => t.id);
