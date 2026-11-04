import { getIdTokenResult, type User } from '@react-native-firebase/auth';
import { reauthenticateWithApple } from './apple';
import { sendReauthLink } from './emailLink';
import { reauthenticateWithGoogle } from './google';

/** exportData and deleteAccount require `auth_time` within 5 minutes (§9); keep a margin for the call itself. */
const RECENT_LOGIN_MS = 4 * 60 * 1000;

export type ReauthOutcome =
  | { readonly kind: 'done'; readonly appleAuthorizationCode: string | null }
  /** Email-link accounts re-authenticate by opening a new link; the user repeats the action afterwards. */
  | { readonly kind: 'emailLinkSent' };

export async function isRecentLogin(user: User, now = Date.now()): Promise<boolean> {
  const token = await getIdTokenResult(user);
  return now - Date.parse(token.authTime) < RECENT_LOGIN_MS;
}

/**
 * Re-authenticates with the provider the account uses. Apple always re-authenticates, because account
 * deletion needs a fresh `authorizationCode` for token revocation (§3.10).
 */
export async function reauthenticate(user: User, opts: { readonly forDeletion: boolean }): Promise<ReauthOutcome> {
  const providers = new Set(user.providerData.map((p) => p.providerId));
  if (providers.has('apple.com')) {
    if (!opts.forDeletion && (await isRecentLogin(user))) return { kind: 'done', appleAuthorizationCode: null };
    return { kind: 'done', appleAuthorizationCode: await reauthenticateWithApple(user) };
  }
  if (await isRecentLogin(user)) return { kind: 'done', appleAuthorizationCode: null };
  if (providers.has('google.com')) {
    await reauthenticateWithGoogle(user);
    return { kind: 'done', appleAuthorizationCode: null };
  }
  await sendReauthLink(user);
  return { kind: 'emailLinkSent' };
}
