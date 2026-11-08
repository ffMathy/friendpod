/**
 * Which of the six pod colours a pod or an interest gets (blend spec §3, founder decision 9).
 *
 * The colour comes from the theme's **concept id**, never from the word a member sees: members see a theme in their
 * own wording, so the word differs per person while the concept id is the same for everyone.
 *
 *   h     = FNV-1a 32-bit over the UTF-8 bytes of "grouper:" + id   (offset basis 0x811c9dc5, prime 0x01000193)
 *   index = floor(h * 6 / 2^32)                                       (0..5; never `h % 6`)
 *
 * Index → colour: 0 Solsikke, 1 Blad, 2 Bær, 3 Tomat, 4 Fjord, 5 Blomme. Open-to-anyone pods (no concept) use the
 * pod id the same way. Private (sensitive) themes and interests get no colour at all (`null`): they stay quiet.
 * The function is pure, so a concept keeps its colour forever and nothing needs storing.
 *
 * Pure TypeScript (no React Native): the backend or a script can use the same file.
 */

/** The six pod colours in index order (the order is the colour index, so never reorder it). */
export const POD_COLORS = ['solsikke', 'blad', 'baer', 'tomat', 'fjord', 'blomme'] as const;

/** One of the six pod colours: Solsikke, Blad, Bær, Tomat, Fjord, Blomme. */
export type PodColor = (typeof POD_COLORS)[number];

/** 0 Solsikke, 1 Blad, 2 Bær, 3 Tomat, 4 Fjord, 5 Blomme. */
export type PodColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

const PREFIX = 'grouper:';

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

/** The colour index (0..5) for a concept id (or, for an open-to-anyone pod, its pod id). */
export function podColorIndex(key: string): PodColorIndex {
  return bucketOf(fnv1a32(PREFIX + key));
}

export interface PodColorInput {
  /** The theme's (or the interest's) concept id. */
  readonly conceptId?: string | null;
  /** The pod id: used only when there is no concept (an open-to-anyone pod). */
  readonly podId?: string | null;
  /** A private (sensitive) theme or interest: no colour, ever. */
  readonly sensitive?: boolean;
}

/**
 * The pod colour for a pod theme or an interest, or `null` when it gets none: private (sensitive) themes and
 * interests, and interests that have no concept yet (unsettled, "Did you mean" pending).
 *
 *   podColorFor({ conceptId: 'seed_sourdough' })                 → 'baer'
 *   podColorFor({ conceptId: theme.conceptId, sensitive: theme.sensitive })
 *   podColorFor({ podId })                                       → open-to-anyone pod, from its pod id
 *   podColorFor({ conceptId: 'c_…', sensitive: true })           → null (private stays quiet)
 */
export function podColorFor({ conceptId, podId, sensitive = false }: PodColorInput): PodColor | null {
  if (sensitive) return null;
  const key = conceptId ?? podId;
  if (key === undefined || key === null || key === '') return null;
  return POD_COLORS[podColorIndex(key)];
}

/** A pod theme as stored on pod documents and cards (`podThemeSchema` in core). */
export type PodThemeLike = { readonly kind: 'concept'; readonly conceptId: string; readonly sensitive: boolean } | { readonly kind: 'openToAnyone' };

/** The colour of a pod from its theme: the concept's colour, the pod id's for open-to-anyone, `null` when private. */
export function podColorOfTheme(theme: PodThemeLike, podId: string): PodColor | null {
  if (theme.kind === 'openToAnyone') return podColorFor({ podId });
  return podColorFor({ conceptId: theme.conceptId, sensitive: theme.sensitive });
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
