/**
 * Known-ordinary hobby words (D2): a shipped da/en allowlist that turns a detector flag off for exact everyday
 * hobby tags. How the list was made and why it needs no maintenance is in the data file's header.
 */
import listJson from './data/known-ordinary.da-en.json';

export const KNOWN_ORDINARY_VERSION: string = listJson.version;

/** Every entry, both languages; each is already `normalizeTag().norm` (enforced by a test). */
export const KNOWN_ORDINARY_WORDS: readonly string[] = [...listJson.da, ...listJson.en];

const WORDS: ReadonlySet<string> = new Set(KNOWN_ORDINARY_WORDS);

/** Exact match of a normalised tag; no stemming, so the list can never reach further than it says. */
export function isKnownOrdinary(norm: string): boolean {
  return WORDS.has(norm);
}
