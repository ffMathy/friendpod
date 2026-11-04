import {
  isSignInWithEmailLink,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  type ActionCodeSettings,
  type User,
} from '@react-native-firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { auth } from '@/firebase';
import { appConfig, bundleId } from '@/lib/env';

/** The pending sign-in email stays on the device only (PRIVACY.md §12.1), until the link is used. */
const PENDING_EMAIL_KEY = 'emailLink.pendingEmail';

function actionCodeSettings(): ActionCodeSettings {
  const domain = appConfig.emailLinkDomain;
  return {
    url: `https://${domain}/`,
    handleCodeInApp: true,
    // Dynamic Links are gone: the link opens through App Links / Universal Links on the Hosting domain (§11).
    linkDomain: domain,
    iOS: { bundleId },
    android: { packageName: bundleId, installApp: false },
  };
}

export async function sendEmailLink(email: string): Promise<void> {
  const address = email.trim();
  await sendSignInLinkToEmail(auth(), address, actionCodeSettings());
  await SecureStore.setItemAsync(PENDING_EMAIL_KEY, address);
}

export function isEmailLink(link: string): boolean {
  return isSignInWithEmailLink(auth(), link);
}

export async function pendingEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_EMAIL_KEY);
}

/**
 * Completes sign-in from the link; `email` is needed when the link is opened on another device or
 * after the stored address was cleared. A signed-in user (re-authentication before export or deletion)
 * is re-authenticated instead, which refreshes `auth_time`.
 */
export async function completeEmailLink(link: string, email: string): Promise<void> {
  const current = auth().currentUser;
  if (current) {
    await reauthenticateWithCredential(current, EmailAuthProvider.credentialWithLink(email, link));
  } else {
    await signInWithEmailLink(auth(), email, link);
  }
  await SecureStore.deleteItemAsync(PENDING_EMAIL_KEY);
}

export async function sendReauthLink(user: User): Promise<void> {
  if (!user.email) throw new Error('email-link account without an email');
  await sendEmailLink(user.email);
}
