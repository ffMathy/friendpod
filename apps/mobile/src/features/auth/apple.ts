import { AppleAuthProvider, reauthenticateWithCredential, signInWithCredential, type User } from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { auth } from '@/firebase';
import { AuthCancelled } from './errors';

/** Sign in with Apple is offered on iOS only (Q9: Google or email on Android). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

interface AppleResult {
  readonly identityToken: string;
  readonly rawNonce: string;
  /** Fresh code for `revokeToken` before account deletion (§3.10). */
  readonly authorizationCode: string | null;
}

async function requestApple(): Promise<AppleResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    // No scopes: Friendpod never asks Apple for the name or email (§11 Auth).
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [], nonce: hashedNonce });
    if (!credential.identityToken) throw new Error('Apple returned no identity token');
    return { identityToken: credential.identityToken, rawNonce, authorizationCode: credential.authorizationCode };
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthCancelled();
    throw error;
  }
}

export async function signInWithApple(): Promise<void> {
  const { identityToken, rawNonce } = await requestApple();
  await signInWithCredential(auth(), AppleAuthProvider.credential(identityToken, rawNonce));
}

/** Re-authenticates (fresh `auth_time`) and returns the authorization code for token revocation. */
export async function reauthenticateWithApple(user: User): Promise<string | null> {
  const { identityToken, rawNonce, authorizationCode } = await requestApple();
  await reauthenticateWithCredential(user, AppleAuthProvider.credential(identityToken, rawNonce));
  return authorizationCode;
}
