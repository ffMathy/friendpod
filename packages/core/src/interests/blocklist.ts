import { tagTokens } from './normalize';

/**
 * Starter blocklist (§5.2 (2)), the one list for interest tags (the embedder's moderateTag) and meetup-chat text
 * (checkChatText), checked on a leetspeak-folded copy. Deliberately phrase-based: bare drug or illness words would
 * also block recovery and support interests, which are core sensitive use cases.
 * TODO(M0): the founder curates the full da/en lists, including slurs and anything sexualising minors.
 */
const BLOCKED_TOKENS = new Set([
  'escort', 'escortpige', 'escortpiger', 'sugardaddy', 'sugarbaby', 'onlyfans', 'nudes', 'sexdate', 'knald', 'mlm',
]);
/**
 * Tokens that are ordinary words in a sentence ("I can escort you from the bus", "et knald godt grin"). A tag that
 * is or contains one is still refused; chat text is refused only by the phrases below that use them.
 */
const TAG_ONLY_TOKENS = new Set(['escort', 'knald']);
const BLOCKED_PHRASES: readonly (readonly string[])[] = [
  'sugar daddy', 'sugar baby', 'betalt sex', 'paid sex', 'sex for money', 'sex mod betaling', 'one night stand',
  'escort service', 'escort girl', 'escort girls', 'escort pige', 'escort piger', 'søger knald', 'hurtigt knald',
  'selling drugs', 'drug dealer', 'køb hash', 'sælger hash', 'køb stoffer', 'sælger stoffer', 'buy weed', 'sell weed',
  'kill people', 'dræbe folk', 'skyde folk', 'bomb threat',
  'crypto signals', 'forex signals', 'make money fast', 'tjen penge hurtigt', 'pyramid scheme',
].map((p) => p.split(' '));

const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '€': 'e' };

export function leetFold(norm: string): string {
  return [...norm].map((ch) => LEET[ch] ?? ch).join('');
}

export type BlocklistContext = 'tag' | 'chat';

/** `norm` is lowercased NFKC text (a normalized tag, or chat text folded the same way). */
export function isBlocklisted(norm: string, context: BlocklistContext = 'tag'): boolean {
  const tokens = tagTokens(leetFold(norm));
  if (tokens.some((t) => BLOCKED_TOKENS.has(t) && (context === 'tag' || !TAG_ONLY_TOKENS.has(t)))) return true;
  return BLOCKED_PHRASES.some((words) => {
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (words.every((w, j) => tokens[i + j] === w)) return true;
    }
    return false;
  });
}
