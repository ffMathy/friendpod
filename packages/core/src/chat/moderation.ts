import type { AppErrorCode } from '../errors';
import { isBlocklisted } from '../interests/blocklist';
import { findPii, foldDigits, mentionsHandle } from '../interests/pii';
import { MAP_URL_HOSTS, type ChatWarning } from '../schemas/callables';
import { urlHost } from '../schemas/common';

/** App error codes, so sendMessage can throw them as `invalid-argument` with `details.code`. */
export type ChatTextRejection = Extract<AppErrorCode, 'BLOCKLIST' | 'PII_CPR'>;

export type ChatTextCheck =
  | { readonly ok: true; readonly warning?: ChatWarning }
  | { readonly ok: false; readonly code: ChatTextRejection };

const INVISIBLE = /\p{Cf}/gu;
const HTTPS_TOKEN = /https:\/\/\S+/giu;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»”’]+$/u;

/** Map links (the proposeOption allowlist) carry coordinates and `@` that would read as phone numbers and handles. */
function withoutMapLinks(text: string): string {
  return text.replace(HTTPS_TOKEN, (url) => {
    const host = urlHost(url.replace(TRAILING_PUNCTUATION, ''));
    return host !== null && (MAP_URL_HOSTS as readonly string[]).includes(host) ? ' ' : url;
  });
}

// Times, time ranges and dates, which the phone pattern would read as 8+ digits ("18.30-21.00", "14.11.2026").
// They must stand alone: "20.30.40.50" or "20.30 40.50" stays a phone number.
const TIME = String.raw`(?:[01]?\d|2[0-3])[.:][0-5]\d`;
const DAY = String.raw`(?:0?[1-9]|[12]\d|3[01])`;
const MONTH = String.raw`(?:0?[1-9]|1[0-2])`;
const DATE = String.raw`(?:${DAY}[./-]${MONTH}(?:[./-](?:19|20)?\d{2}|\.)?|(?:19|20)\d{2}-${MONTH}-${DAY})`;
const TIME_RANGE = String.raw`${TIME}(?:\s*[-–]\s*${TIME})?`;
const DATE_OR_TIME = new RegExp(
  String.raw`(?<!\d[\s().-]?)(?:${DATE}(?:\s+(?:kl\.?\s*)?${TIME_RANGE})?|${TIME_RANGE})(?![\s().-]?\d)`,
  'gu',
);
/** "Tak.Se jer snart": a full stop typed without a space before a capitalised word is not a domain like "tak.se". */
const SENTENCE_BREAK = /(?<=[\p{Ll}\p{N}])\.(?=\p{Lu}\p{Ll}+(?![\p{L}\p{N}.@/]))/gu;

/** Contact details for the warning before the meetup; each check sees only what could be a false positive for it. */
function hasContactDetails(text: string): boolean {
  if (findPii(text.replace(SENTENCE_BREAK, '. ')).some((kind) => kind !== 'phone')) return true;
  // The separator breaks digit runs, so removing a date never joins its neighbours into a phone number.
  if (findPii(text.replace(DATE_OR_TIME, ' / ')).includes('phone')) return true;
  return mentionsHandle(text);
}

/**
 * Server-side moderation of a meetup-chat text message. CPR numbers and blocklisted text are always rejected and
 * checked on the whole text, map links included. Other contact details (phone, email, handle, other links) only
 * warn, and only before the meetup: the sender may resend with `ackContactWarning`.
 */
export function checkChatText(text: string, opts: { readonly beforeMeetup: boolean }): ChatTextCheck {
  // Checked on a folded copy: invisible characters would otherwise split "0101901234" or "escort" past the
  // patterns, and Arabic-Indic or Persian digits would pass `\d`.
  const folded = foldDigits(text.normalize('NFKC').replace(INVISIBLE, ''));
  if (findPii(folded).includes('cpr')) return { ok: false, code: 'PII_CPR' };
  if (isBlocklisted(folded.toLowerCase(), 'chat')) return { ok: false, code: 'BLOCKLIST' };
  if (opts.beforeMeetup && hasContactDetails(withoutMapLinks(folded))) return { ok: true, warning: 'CONTACT_INFO_BEFORE_MEETUP' };
  return { ok: true };
}
