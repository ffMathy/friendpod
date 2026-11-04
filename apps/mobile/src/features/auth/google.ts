import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, reauthenticateWithCredential, signInWithCredential, type User } from '@react-native-firebase/auth';
import { auth } from '@/firebase';
import { appConfig } from '@/lib/env';
import { AuthCancelled } from './errors';

let configured = false;

function configure(): void {
  if (configured) return;
  if (!appConfig.googleWebClientId) throw new Error('GOOGLE_WEB_CLIENT_ID is not set for this build');
  // The smallest request the SDK allows (§11 Auth); M0 checks whether the ID token still carries name and picture.
  GoogleSignin.configure({ webClientId: appConfig.googleWebClientId, scopes: [] });
  configured = true;
}

async function googleIdToken(): Promise<string> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new AuthCancelled();
  if (!response.data.idToken) throw new Error('Google returned no ID token');
  return response.data.idToken;
}

export async function signInWithGoogle(): Promise<void> {
  const idToken = await googleIdToken();
  await signInWithCredential(auth(), GoogleAuthProvider.credential(idToken));
}

export async function reauthenticateWithGoogle(user: User): Promise<void> {
  const idToken = await googleIdToken();
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
}

export async function signOutOfGoogle(): Promise<void> {
  if (configured) await GoogleSignin.signOut();
}
