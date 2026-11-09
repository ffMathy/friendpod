/**
 * Which of the six pod colours a pod or an interest gets (blend spec §3, founder decision 9).
 *
 * The colour comes from the **word shown**, normalized: `normalizeTag(word).norm` from core (when the word does not
 * normalize, e.g. too short, NFKC + trim + lower case instead). The same word gets the same colour everywhere, for
 * everyone: an interest chip, a pod card and a pod page that all say "brætspil" are all Tomat, on every phone.
 *
 *   key   = "grouper:3410:" + normalized word
 *   h     = FNV-1a 32-bit over the UTF-8 bytes of key   (offset basis 0x811c9dc5, prime 0x01000193)
 *   index = floor(h * 6 / 2^32)                        (0..5; never `h % 6`)
 *
 * Index → colour: 0 Solsikke, 1 Blad, 2 Bær, 3 Tomat, 4 Fjord, 5 Blomme. The salt "3410" is fixed: it gives the
 * storyboards' colours (brætspil Tomat, sourdough Solsikke, far på barsel Fjord, trail running Blad, coffee Bær,
 * hiking Blomme), so never change it. Open-to-anyone pods (no theme word) use "grouper:" + pod id the same way.
 * Private (sensitive) themes and interests get no colour at all (`null`): they stay quiet. The function is pure, so a
 * word keeps its colour forever and nothing needs storing.
 *
 * Trade-off accepted by the founder: the colour follows the wording, not the concept. Members who see the same pod
 * theme in different wordings (their own synonym, or a different app language) may see the pod in different colours.
 *
 * Pure TypeScript (no React Native): the backend or a script can use the same file.
 */
import { normalizeTag } from '@grouper/core';

/** The six pod colours in index order (the order is the colour index, so never reorder it). */
export const POD_COLORS = ['solsikke', 'blad', 'baer', 'tomat', 'fjord', 'blomme'] as const;

/** One of the six pod colours: Solsikke, Blad, Bær, Tomat, Fjord, Blomme. */
export type PodColor = (typeof POD_COLORS)[number];

/** 0 Solsikke, 1 Blad, 2 Bær, 3 Tomat, 4 Fjord, 5 Blomme. */
export type PodColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

const PREFIX = 'grouper:';
/** The salt for words (see the header): reproduces the storyboards' colours. */
const WORD_PREFIX = 'grouper:3410:';

/** The UTF-8 bytes of a string (code points, so astral characters take four bytes, as in TextEncoder). */
function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

/** FNV-1a, 32 bit, over the UTF-8 bytes of `s`; an unsigned integer. */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (const b of utf8(s)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The bucket of an unsigned 32-bit hash: floor(h * 6 / 2^32). Exact in doubles (h * 6 < 2^35). */
export function bucketOf(h: number): PodColorIndex {
  return Math.floor(((h >>> 0) * 6) / 2 ** 32) as PodColorIndex;
}

/** The colour index (0..5) for a pod id (an open-to-anyone pod). */
export function podColorIndex(podId: string): PodColorIndex {
  return bucketOf(fnv1a32(PREFIX + podId));
}

/** The key a word is coloured by: `normalizeTag`'s `norm`, or NFKC + trim + lower case when it does not normalize. */
export function colorKeyOfWord(word: string): string {
  const n = normalizeTag(word);
  return n.ok ? n.norm : word.normalize('NFKC').trim().toLowerCase();
}

/** The colour index (0..5) for a word shown (an interest, or a pod's theme word). */
export function wordColorIndex(word: string): PodColorIndex {
  return bucketOf(fnv1a32(WORD_PREFIX + colorKeyOfWord(word)));
}

export interface PodColorInput {
  /** The word shown: the interest's (normalized) word, or the pod's theme word. */
  readonly word?: string | null;
  /** The pod id: used only when there is no word (an open-to-anyone pod). */
  readonly podId?: string | null;
  /** A private (sensitive) theme or interest: no colour, ever. */
  readonly sensitive?: boolean;
}

/**
 * The pod colour for a pod theme or an interest, or `null` when it gets none: private (sensitive) themes and
 * interests, and nothing to hash.
 *
 *   podColorFor({ word: 'brætspil' })                     → 'tomat'
 *   podColorFor({ word: card.themeLabel, sensitive: card.themeSensitive })
 *   podColorFor({ podId })                               → open-to-anyone pod, from its pod id
 *   podColorFor({ word: 'gravid', sensitive: true })     → null (private stays quiet)
 */
export function podColorFor({ word, podId, sensitive = false }: PodColorInput): PodColor | null {
  if (sensitive) return null;
  if (word !== undefined && word !== null && colorKeyOfWord(word) !== '') return POD_COLORS[wordColorIndex(word)];
  if (podId === undefined || podId === null || podId === '') return null;
  return POD_COLORS[podColorIndex(podId)];
}

/** An interest's colour, from its own word: its `norm` when present, else its `display`. */
export function interestColor(interest: { readonly norm?: string | null; readonly display: string }): PodColor | null {
  return podColorFor({ word: interest.norm ?? interest.display });
}

/**
 * The clash rule (decision 9): on a pod's own screens (proposal, waiting, confirmed, pod page, chat, plan, member,
 * feedback) the pod's colour is reserved. Any *other* interest that would get the same colour is drawn as a plain
 * chip there (`Chip kind="clash"`). Returns the colour to draw the interest in, `'clash'` when it must be plain, or
 * `null` when it has no colour anyway (private, unsettled). `isPodTheme`: the interest is the pod's own theme.
 */
export function colorOnPodScreen(interest: PodColor | null, pod: PodColor | null, isPodTheme = false): PodColor | 'clash' | null {
  if (interest === null) return null;
  return !isPodTheme && pod !== null && interest === pod ? 'clash' : interest;
}
