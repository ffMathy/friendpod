import { revokeToken, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { auth } from '@/firebase';
import { callFunction } from '@/firebase/callables';
import { pushPermissionGranted, unregisterPush } from '@/features/notifications/push';
import { reauthenticate, type ReauthOutcome } from '@/features/auth/reauth';
import { signOutOfGoogle } from '@/features/auth/google';
import { endDeviceSession } from './deviceSession';

/**
 * Set once `deleteAccount` succeeded, so the welcome screen can confirm it (§3.10 step 3) after the guard has
 * switched to the signed-out stack. Read once.
 */
let accountDeleted = false;
export function consumeAccountDeleted(): boolean {
  const was = accountDeleted;
  accountDeleted = false;
  return was;
}

/**
 * Drops this device's FCM token before the session ends: `pushTokens/{uid}` keeps it until FCM reports it gone, so
 * without this the next account on the same phone would get the previous one's pushes. The next sign-in that has
 * notifications on registers a fresh token (usePushTokenSync).
 */
async function dropPushToken(): Promise<void> {
  if (await pushPermissionGranted()) await unregisterPush();
}

export async function signOut(): Promise<void> {
  await dropPushToken().catch(() => undefined);
  await signOutOfGoogle().catch(() => undefined);
  await firebaseSignOut(auth());
  await endDeviceSession();
}

async function revokeAppleToken(code: string): Promise<void> {
  // Retried once; a failed revocation never blocks deletion (§3.10).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await revokeToken(auth(), code);
      return;
    } catch {
      // next attempt
    }
  }
}

export type AccountActionOutcome = { readonly kind: 'done' } | Extract<ReauthOutcome, { kind: 'emailLinkSent' }>;

/** Settings → Delete account (§3.10): re-authenticate, revoke Apple, delete, then sign out and clear caches. */
export async function deleteAccount(): Promise<AccountActionOutcome> {
  const user = auth().currentUser;
  if (!user) throw new Error('not signed in');
  const reauth = await reauthenticate(user, { forDeletion: true });
  if (reauth.kind === 'emailLinkSent') return reauth;
  if (reauth.appleAuthorizationCode) await revokeAppleToken(reauth.appleAuthorizationCode);
  await callFunction('deleteAccount', {});
  accountDeleted = true;
  // The server has already deleted the Auth user; signing out only clears local state.
  await signOut().catch(() => endDeviceSession());
  return { kind: 'done' };
}

/** Settings → Privacy → Download my data (§3.9). */
export async function requestDataExport(): Promise<AccountActionOutcome> {
  const user = auth().currentUser;
  if (!user) throw new Error('not signed in');
  const reauth = await reauthenticate(user, { forDeletion: false });
  if (reauth.kind === 'emailLinkSent') return reauth;
  await callFunction('exportData', {});
  return { kind: 'done' };
}
