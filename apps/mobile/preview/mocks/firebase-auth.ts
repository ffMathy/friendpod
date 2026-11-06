/**
 * Preview fake of @react-native-firebase/auth (modular API): the scenario's user is signed in from the start and its
 * claims come back from getIdTokenResult. Sign-in calls sign in the scenario's user (or a fresh, not-onboarded one);
 * sign-out signs out. No network.
 */
import { preview } from '../runtime/state';
import type { PreviewUser } from '../runtime/types';

export interface UserInfo {
  readonly providerId: string;
  readonly uid: string;
}

export interface IdTokenResult {
  readonly token: string;
  readonly claims: Record<string, unknown>;
  readonly authTime: string;
  readonly issuedAtTime: string;
  readonly expirationTime: string;
  readonly signInProvider: string | null;
}

export interface User {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly emailVerified: boolean;
  readonly isAnonymous: boolean;
  readonly providerId: string;
  readonly providerData: UserInfo[];
  readonly metadata: { readonly creationTime: string; readonly lastSignInTime: string };
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult>;
  reload(): Promise<void>;
  delete(): Promise<void>;
}

export interface Auth {
  readonly currentUser: User | null;
  readonly app: unknown;
}

export interface ActionCodeSettings {
  readonly url: string;
  readonly handleCodeInApp?: boolean;
  readonly iOS?: { readonly bundleId?: string };
  readonly android?: { readonly packageName: string; readonly installApp?: boolean; readonly minimumVersion?: string };
  readonly linkDomain?: string;
}

export interface AuthCredential {
  readonly providerId: string;
  readonly token: string;
  readonly secret: string;
}

/** The moment the preview "signed in": recent, so re-authentication is not asked for (§9 Auth hardening). */
const signedInAt = new Date().toISOString();
const users = new WeakMap<PreviewUser, User>();

function providerOf(u: PreviewUser): string {
  return u.provider === 'emailLink' ? 'password' : (u.provider ?? 'apple.com');
}

function toUser(u: PreviewUser): User {
  const known = users.get(u);
  if (known) return known;
  const tokenResult = async (): Promise<IdTokenResult> => ({
    token: 'preview-id-token',
    // Read at call time: completeOnboarding's fake sets `onb` on the live user.
    claims: { ...(preview().auth.user?.uid === u.uid ? preview().auth.user?.claims : u.claims) },
    authTime: signedInAt,
    issuedAtTime: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 3_600_000).toISOString(),
    signInProvider: providerOf(u),
  });
  const user: User = {
    uid: u.uid,
    email: u.email ?? null,
    displayName: null,
    emailVerified: true,
    isAnonymous: false,
    providerId: 'firebase',
    providerData: [{ providerId: providerOf(u), uid: u.uid }],
    metadata: { creationTime: signedInAt, lastSignInTime: signedInAt },
    getIdToken: async () => 'preview-id-token',
    getIdTokenResult: tokenResult,
    reload: async () => undefined,
    delete: async () => setUser(null),
  };
  users.set(u, user);
  return user;
}

const auth: Auth = {
  get currentUser() {
    const u = preview().auth.user;
    return u ? toUser(u) : null;
  },
  app: null,
};

function setUser(next: PreviewUser | null): void {
  const state = preview().auth;
  state.user = next;
  for (const listener of [...state.listeners]) listener(next);
}

function listen(_auth: Auth, callback: (user: User | null) => void): () => void {
  const { listeners } = preview().auth;
  const listener = (u: PreviewUser | null) => callback(u ? toUser(u) : null);
  listeners.add(listener);
  // Like the SDK: the current state arrives asynchronously after subscribing.
  const timer = setTimeout(() => listener(preview().auth.user), 0);
  return () => {
    clearTimeout(timer);
    listeners.delete(listener);
  };
}

export const getAuth = (_app?: unknown): Auth => auth;
export const connectAuthEmulator = (): void => undefined;
export const onIdTokenChanged = listen;
export const onAuthStateChanged = listen;
export const getIdToken = (user: User, forceRefresh?: boolean): Promise<string> => user.getIdToken(forceRefresh);
export const getIdTokenResult = (user: User, forceRefresh?: boolean): Promise<IdTokenResult> => user.getIdTokenResult(forceRefresh);

/** Signing in from the preview signs in the scenario's user, or a new account that still has to onboard. */
async function signIn(): Promise<{ user: User }> {
  const next = preview().scenario.user ?? { uid: 'u_preview_new', claims: {} };
  setUser(next);
  return { user: toUser(next) };
}

export const signInWithCredential = (_auth: Auth, _credential: AuthCredential) => signIn();
export const signInWithEmailLink = (_auth: Auth, _email: string, _link?: string) => signIn();
export const isSignInWithEmailLink = (_auth: Auth, link: string): boolean => link.includes('oobCode=');
export const sendSignInLinkToEmail = async (_auth: Auth, _email: string, _settings: ActionCodeSettings): Promise<void> => undefined;
export const reauthenticateWithCredential = async (user: User, _credential: AuthCredential) => ({ user });
export const revokeToken = async (_auth: Auth, _code: string): Promise<void> => undefined;
export const deleteUser = async (_user: User): Promise<void> => setUser(null);
export const signOut = async (_auth?: Auth): Promise<void> => setUser(null);

const credential = (providerId: string) => (token: string, secret = ''): AuthCredential => ({ providerId, token, secret });
export const AppleAuthProvider = { PROVIDER_ID: 'apple.com', credential: credential('apple.com') };
export const GoogleAuthProvider = { PROVIDER_ID: 'google.com', credential: credential('google.com') };
export const EmailAuthProvider = {
  PROVIDER_ID: 'password',
  credential: credential('password'),
  credentialWithLink: (email: string, link: string): AuthCredential => ({ providerId: 'emailLink', token: email, secret: link }),
};

export default () => auth;
