import type { ConsentScope } from '../types/domain';
import { getLegalText, LEGAL_TEXTS, type LegalTextId } from './consent-texts';

/**
 * SHA-256 (hex) of `canonicalLegalText()` of each text. Precomputed so the device needs
 * no hashing; test/legal.test.ts recomputes every value and locks it.
 */
export const LEGAL_TEXT_SHA256 = {
  'art9-blanket-en-v2': '6d0512a9a8ed7cfe833009eb80a2fcc97eac46f953ed85b3c395ae5156c4e333',
  'art9-blanket-da-v2': 'ecedcf6f82c44b5c41ce2d9c3bdb41f02efde144b4873b5dfa30258fbf0e63b4',
  'gender-en-v2': 'ed1ade304a997b76ceee079c40e445676c0f86056e4332ffeb81bcfa70ac1cf7',
  'gender-nonbinary-en-v2': '0196877153642c2063fb35d9d085e8971daecf373567f950fd4090662f955ef4',
  'gender-da-v2': 'bd4a5a330585f92cfd1aef52185ce45b554ae6e132a979dcaad837628e3fd4a6',
  'interest-notice-en-v2': '596f74a7aaaa5f702483d7c474b68cf41cecfcf3e5d9308c251c76c93f36385c',
  'interest-notice-da-v2': 'b63d67b68971a7a3d2166b15fc69b000928d0dfe9e58e7619be8d43d69bcf3d0',
  'art9-withdraw-all-en-v2': '44aeb4488c24a37bc3679de8082cc3a5eb704a8a710f7f907ea3d7c893c77e15',
  'art9-withdraw-all-da-v2': 'df108230ba9c2ad09e0deba51e03c12827d5fe3856f8d630b0c07dcdc4a1c465',
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
