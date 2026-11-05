/**
 * "About me" (D4): one optional sentence, shown only to confirmed members of the user's pods and never used for
 * matching. Unlike the chat, contact details (a street address and bare profile links included) are refused outright: the sentence is shown to strangers before anyone
 * has met, and there is no "send anyway".
 */
import type { AppErrorCode } from '../errors';
import { isBlocklisted } from '../interests/blocklist';
import { findPii, foldDigits, looksLikeAddress, looksLikeLink, mentionsHandle } from '../interests/pii';

export type AboutMeRejection = Extract<AppErrorCode, 'CONTACT_INFO' | 'BLOCKLIST'>;
export type AboutMeCheck = { readonly ok: true } | { readonly ok: false; readonly code: AboutMeRejection };

const INVISIBLE = /\p{Cf}/gu;

/** Server-side moderation of an already schema-normalised `aboutMe` (the app runs it too, for instant feedback). */
export function checkAboutMe(text: string): AboutMeCheck {
  const folded = foldDigits(text.normalize('NFKC').replace(INVISIBLE, ''));
  if (findPii(folded).length > 0 || mentionsHandle(folded) || looksLikeLink(folded) || looksLikeAddress(folded)) return { ok: false, code: 'CONTACT_INFO' };
  if (isBlocklisted(folded.toLowerCase(), 'chat')) return { ok: false, code: 'BLOCKLIST' };
  return { ok: true };
}
