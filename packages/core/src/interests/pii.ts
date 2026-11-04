/**
 * Contact-information patterns (§5.2 (2), §3.5): tags and meetup text that contain them are rejected.
 * Deliberately broad; a false positive costs a rewording, a miss leaks contact details into a pod.
 */
export type PiiKind = 'email' | 'url' | 'phone' | 'handle' | 'cpr';

const EMAIL = /[\p{L}\p{N}._%+-]+\s*(?:@|\(at\)|\[at\])\s*[\p{L}\p{N}-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[\p{L}\p{N}-]+)*\s*(?:\.|\(dot\)|\[dot\])\s*\p{L}{2,}/u;
const URL_SCHEME = /\b(?:https?:\/\/|www\.)\S+/u;
const BARE_DOMAIN =
  /\b[\p{L}\p{N}][\p{L}\p{N}-]*\.(?:dk|com|net|org|io|me|app|eu|de|se|no|nu|co|uk|info|biz|xyz|link|ly|gg|tv|online|site|shop|club|page|dev)\b/u;
const AT_HANDLE = /(?:^|[^\p{L}\p{N}_.])@[\p{L}\p{N}_.]{2,}/u;
const NAMED_HANDLE =
  /\b(?:snap(?:chat)?|insta(?:gram)?|ig|tiktok|discord|telegram|whatsapp|signal|kik|twitter|facebook|fb|messenger|threads|bluesky)\s*[:=]\s*\S{2,}/u;
const CPR = /(?:^|\D)(\d{2})(\d{2})(\d{2})[-\s]?\d{4}(?!\d)/u;
const PHONE_CANDIDATE = /(?:\+|00)?\d(?:[\s().-]*\d){7,14}/gu;
const YEAR_RANGE = /^(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}$/u;

function looksLikeCpr(text: string): boolean {
  const m = CPR.exec(text);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
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
