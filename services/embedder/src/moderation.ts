/**
 * Input-time moderation before any model call (DESIGN.md §5.2 (2)). Rejections carry a reason code and
 * nothing is persisted; the device renders the DSA Art. 17 statement of reasons from the code.
 * Contact details use core's PII patterns; third-party kinship is a signal for the sensitivity step.
 */
import { detectThirdParty, findPii, tagTokens } from '@grouper/core';

export const MODERATION_RULES_VERSION = 'moderation-2026-11-04.1';

/**
 * Starter blocklist, checked on a leetspeak-folded copy of the tag. Deliberately phrase-based: bare drug
 * or illness words would also block recovery and support interests, which are core sensitive use cases.
 * TODO(M0): the founder curates the full da/en lists, including slurs and anything sexualising minors.
 */
const BLOCKED_TOKENS = new Set([
  'escort', 'escortpige', 'escortpiger', 'sugardaddy', 'sugarbaby', 'onlyfans', 'nudes', 'sexdate', 'knald', 'mlm',
]);
const BLOCKED_PHRASES: readonly (readonly string[])[] = [
  'sugar daddy', 'sugar baby', 'betalt sex', 'paid sex', 'sex for money', 'sex mod betaling', 'one night stand',
  'selling drugs', 'drug dealer', 'køb hash', 'sælger hash', 'køb stoffer', 'sælger stoffer', 'buy weed', 'sell weed',
  'kill people', 'dræbe folk', 'skyde folk', 'bomb threat',
  'crypto signals', 'forex signals', 'make money fast', 'tjen penge hurtigt', 'pyramid scheme',
].map((p) => p.split(' '));

const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '€': 'e' };

export function leetFold(norm: string): string {
  return [...norm].map((ch) => LEET[ch] ?? ch).join('');
}

function blocklisted(norm: string): boolean {
  const tokens = tagTokens(leetFold(norm));
  if (tokens.some((t) => BLOCKED_TOKENS.has(t))) return true;
  return BLOCKED_PHRASES.some((words) => {
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (words.every((w, j) => tokens[i + j] === w)) return true;
    }
    return false;
  });
}

export type ModerationResult =
  | { readonly ok: true; readonly thirdParty: boolean }
  | { readonly ok: false; readonly reason: 'PII' | 'BLOCKLIST' };

/**
 * `display` (NFKC, invisible characters removed, case and edge punctuation kept) is what the PII patterns
 * see, so "@handle" is still a handle; `norm` is what the blocklist and kinship patterns see.
 */
export function moderateTag(norm: string, display: string): ModerationResult {
  if (findPii(display).length > 0) return { ok: false, reason: 'PII' };
  if (blocklisted(norm)) return { ok: false, reason: 'BLOCKLIST' };
  return { ok: true, thirdParty: detectThirdParty(norm).hit };
}
