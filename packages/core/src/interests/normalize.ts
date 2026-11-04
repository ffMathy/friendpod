export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 40;

export type NormalizeFailure = 'TAG_TOO_SHORT' | 'TAG_TOO_LONG';

export type NormalizeResult =
  | { readonly ok: true; readonly norm: string; readonly display: string }
  | { readonly ok: false; readonly code: NormalizeFailure };

// Emoji: pictographs plus the joiners, selectors, keycap, skin-tone and tag characters that build sequences.
const EMOJI = /(?:[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}]|\u200d|\ufe0e|\ufe0f|\u20e3|[\u{e0020}-\u{e007f}])/gu;
// Invisible format characters (zero-width spaces, bidi overrides, soft hyphen) would let "mad\u200blavning"
// slip past the lexicon and the cache key, so they are removed with the emoji.
const INVISIBLE = /[\p{Cf}]/gu;
const WHITESPACE = /[\s\p{Cc}]+/gu;
// Punctuation except '#' and '&'; '+' is a math symbol, so "C++" survives as well.
// (Lookahead instead of the `v` flag's set subtraction, which Hermes does not support.)
const EDGE_PUNCTUATION = /^(?:(?![#&])\p{P})+|(?:(?![#&])\p{P})+$/gu;

const collapse = (s: string): string => s.replace(WHITESPACE, ' ').trim();

/** Length in Unicode code points, the unit of the 2–40 limit. */
export function tagLength(s: string): number {
  return [...s].length;
}

/**
 * normalizeTag() per DESIGN.md §5.2 (1), shared by device and server:
 * NFKC → trim/collapse whitespace → remove emoji → toLowerCase() → strip edge punctuation except + # & →
 * require 2–40 characters (reject, never truncate). Diacritics are kept ("får" ≠ "far").
 * Whitespace is collapsed again after each removal so the function is idempotent.
 */
export function normalizeTag(text: string): NormalizeResult {
  const nfkc = text.normalize('NFKC');
  const display = collapse(nfkc.replace(INVISIBLE, ''));
  let norm = collapse(display.replace(EMOJI, ''));
  norm = norm.toLowerCase();
  let prev: string;
  do {
    prev = norm;
    norm = collapse(norm.replace(EDGE_PUNCTUATION, ''));
  } while (norm !== prev);
  const len = tagLength(norm);
  if (len < TAG_MIN_LENGTH) return { ok: false, code: 'TAG_TOO_SHORT' };
  if (len > TAG_MAX_LENGTH) return { ok: false, code: 'TAG_TOO_LONG' };
  return { ok: true, norm, display };
}

/** Tokens for lexicon and pattern matching: letters, digits and the kept symbols + # &. */
export function tagTokens(norm: string): string[] {
  return norm.split(/[^\p{L}\p{M}\p{N}+#&]+/u).filter((t) => t.length > 0);
}
