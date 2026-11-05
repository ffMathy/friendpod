/**
 * Contact-information patterns (§5.2 (2), §3.5): tags and meetup text that contain them are rejected.
 * Deliberately broad; a false positive costs a rewording, a miss leaks contact details into a pod.
 */
export type PiiKind = 'email' | 'url' | 'phone' | 'handle' | 'cpr';

const PLATFORMS = String.raw`snap(?:chat)?|insta(?:gram)?|ig|tiktok|discord|telegram|whatsapp|signal|kik|twitter|facebook|fb|messenger|threads|bluesky|bsky|mastodon|linktree`;

const EMAIL = /[\p{L}\p{N}._%+-]+\s*(?:@|\(at\)|\[at\])\s*[\p{L}\p{N}-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[\p{L}\p{N}-]+)*\s*(?:\.|\(dot\)|\[dot\])\s*\p{L}{2,}/u;
const URL_SCHEME = /\b(?:https?:\/\/|www\.)\S+/u;
const BARE_DOMAIN =
  /\b[\p{L}\p{N}][\p{L}\p{N}-]*\.(?:dk|com|net|org|io|me|app|eu|de|se|no|nu|co|uk|info|biz|xyz|link|ly|gg|tv|online|site|shop|club|page|dev)\b/u;
const AT_HANDLE = /(?:^|[^\p{L}\p{N}_.])@[\p{L}\p{N}_.]{2,}/u;
const NAMED_HANDLE = new RegExp(String.raw`\b(?:${PLATFORMS})\s*[:=]\s*\S{2,}`, 'u');
// Every candidate is checked: an earlier 10-digit run with an impossible date (+4520304050) must not hide a CPR.
const CPR = /(?<!\d)(\d{2})(\d{2})(\d{2})[-\s]?\d{4}(?!\d)/gu;
const PHONE_CANDIDATE = /(?:\+|00)?\d(?:[\s().-]*\d){7,14}/gu;
const YEAR_RANGE = /^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/u;

function looksLikeCpr(text: string): boolean {
  for (const m of text.matchAll(CPR)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return true;
  }
  return false;
}

function looksLikePhone(text: string): boolean {
  for (const m of text.matchAll(PHONE_CANDIDATE)) {
    const candidate = m[0].trim();
    if (YEAR_RANGE.test(candidate)) continue;
    const digits = candidate.replace(/\D/g, '').length;
    if (digits >= 8 && digits <= 15) return true;
  }
  return false;
}

/** Kinds of contact information found in `text` (NFKC-folded and lowercased first). */
export function findPii(text: string): PiiKind[] {
  const t = text.normalize('NFKC').toLowerCase();
  const kinds: PiiKind[] = [];
  if (EMAIL.test(t)) kinds.push('email');
  if (URL_SCHEME.test(t) || BARE_DOMAIN.test(t)) kinds.push('url');
  if (AT_HANDLE.test(t) || NAMED_HANDLE.test(t)) kinds.push('handle');
  const cpr = looksLikeCpr(t);
  if (cpr) kinds.push('cpr');
  if (!cpr && looksLikePhone(t)) kinds.push('phone');
  return kinds;
}

export function containsPii(text: string): boolean {
  return findPii(text).length > 0;
}

const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/gu;
const DECIMAL_DIGIT = /^\p{Nd}$/u;

/**
 * Replaces every decimal digit of another script (Arabic-Indic ٠١٢, Persian ۰۱۲, Devanagari, Thai, ...) with its
 * ASCII digit. `\d` and NFKC leave them alone, so a phone or CPR number typed on such a keyboard would pass every
 * pattern. Unicode encodes each script's digits as a contiguous 0–9 run, so a digit's value is its distance from
 * the start of its run, modulo 10 (some runs hold several sets).
 */
export function foldDigits(text: string): string {
  return text.replace(NON_ASCII_DIGIT, (digit) => {
    const cp = digit.codePointAt(0)!;
    let zero = cp;
    while (zero > 0 && DECIMAL_DIGIT.test(String.fromCodePoint(zero - 1))) zero -= 1;
    return String((cp - zero) % 10);
  });
}

// JS `\b` treats å and ø as non-word characters, so word edges are lookarounds on letters and digits.
const START = String.raw`(?<![\p{L}\p{N}])`;
const END = String.raw`(?![\p{L}\p{N}])`;
const HANDLE_TOKEN_SEP = String.raw`\s*(?:[:=-]|${START}(?:is|er|på|hedder)${END})?\s*@?`;
/** "snap annak92", "insta er anna.k92": a platform name, then a token shaped like a handle. */
const PLATFORM_THEN_TOKEN = new RegExp(String.raw`${START}(?:${PLATFORMS})${END}${HANDLE_TOKEN_SEP}([\p{L}\p{N}_.#]+)`, 'gu');
/** "add me on snap anna", "skriv på insta anna": an explicit invitation to a platform, with any following name. */
const INVITE_TO_PLATFORM = new RegExp(
  String.raw`${START}(?:add|follow|find|text|message|dm|tilføj|følg|skriv)(?:\s+(?:til\s+)?(?:me|mig))?\s+(?:on|at|via|på)\s+(?:${PLATFORMS})${END}${HANDLE_TOKEN_SEP}[\p{L}\p{N}_.]{2,}`,
  'u',
);

/**
 * A handle given in running text, without the ':' or '=' that `findPii` needs ("add me on snap annak92").
 * Meetup chat only: in a tag, "discord gaming" or "snap 2026" must stay allowed, and the plain token rules here
 * would refuse too many of them.
 */
export function mentionsHandle(text: string): boolean {
  const t = text.normalize('NFKC').toLowerCase();
  if (INVITE_TO_PLATFORM.test(t)) return true;
  for (const m of t.matchAll(PLATFORM_THEN_TOKEN)) {
    const token = m[1]!.replace(/\.+$/u, '');
    // Plain words ("signal er dårlig", "et kik på kortet") are not handles; digits, '_', '#' or an inner '.' are typical.
    if (token.length >= 3 && /\p{L}/u.test(token) && /[\d_.#]/u.test(token)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- addresses and links in free sentences

/** "12, 2. tv", "4 st. th": a house number with a Danish floor and side, which only a home address has. */
const FLOOR_SIDE = new RegExp(String.raw`${START}\d{1,4}\s?\p{L}?\s*,?\s*(?:\d{1,2}\.?|st\.?|kld\.?)\s*(?:tv|th|mf)\.?${END}`, 'u');
/** "vestergade 12," or "… strandvej 4b." at the end of a clause: a Danish street name and a house number. */
const DA_STREET = new RegExp(
  String.raw`\p{L}(?:gade|gaden|vej|vejen|allé|alle|stræde|strædet|plads|pladsen|boulevard|torv|torvet|vænge|vænget)\s+\d{1,4}\s?\p{L}?${END}\s*(?:[,.;]|$|\d{4}${END})`,
  'u',
);
/** "12 Baker Street": a number, one to three capitalised words, a street word (case-sensitive on purpose). */
const EN_STREET = /(?<![\p{L}\p{N}])\d{1,4}[A-Za-z]?\s+(?:\p{Lu}[\p{L}'-]*\s+){1,3}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Lane|Drive|Close)(?![\p{L}\p{N}])/u;
/** ", 8000 Aarhus C": a postcode and a capitalised town after a comma. */
const POSTCODE_TOWN = /,\s*\d{4}\s+\p{Lu}\p{L}+/u;

/** A street address in a free sentence (Danish or English). Used where nobody has met yet ("about me", places). */
export function looksLikeAddress(text: string): boolean {
  const t = text.normalize('NFKC');
  const lower = t.toLowerCase();
  return FLOOR_SIDE.test(lower) || DA_STREET.test(lower) || EN_STREET.test(t) || POSTCODE_TOWN.test(t);
}

/** True when `text` has a home address's floor and side ("2. tv"), which a public place's address never needs. */
export function hasFloorAndSide(text: string): boolean {
  return FLOOR_SIDE.test(text.normalize('NFKC').toLowerCase());
}

/** "linktr.ee/annak", "annak.bsky.social": a host with a path, or one of three or more labels, whatever its TLD. */
const HOST_WITH_PATH = /(?<![\p{L}\p{N}])[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}\/[^\s]+/u;
const MULTI_LABEL_HOST = /(?<![\p{L}\p{N}.])[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+){1,}\.\p{L}{2,}(?![\p{L}\p{N}])/u;

/** A link or profile address that `findPii`'s TLD list misses. Too broad for tags; fine for a sentence. */
export function looksLikeLink(text: string): boolean {
  const t = text.normalize('NFKC').toLowerCase();
  return HOST_WITH_PATH.test(t) || MULTI_LABEL_HOST.test(t);
}
