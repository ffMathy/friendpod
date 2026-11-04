import { getIdToken, getIdTokenResult, onIdTokenChanged, type User } from '@react-native-firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '@/firebase';
import { syncDeviceSession } from '@/features/account/deviceSession';
import { isOnboardingComplete, setOnboardingComplete } from './onboardingFlag';

/**
 * - signedOut:  no Firebase user
 * - onboarding: signed in, but no `onb` claim yet (steps 3–6) or the post-claim steps 7–11 are unfinished
 * - ready:      `onb` claim and onboarding finished on this device
 */
export type SessionPhase = 'loading' | 'signedOut' | 'onboarding' | 'ready';

export interface Session {
  readonly phase: SessionPhase;
  readonly user: User | null;
  /** The `onb` custom claim set by completeOnboarding (§9 Auth hardening). */
  readonly onboarded: boolean;
  /** Force-refreshes the ID token, e.g. right after completeOnboarding set the claim. */
  refreshClaims(): Promise<void>;
  finishOnboarding(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

interface State {
  readonly user: User | null;
  readonly onboarded: boolean;
  readonly finished: boolean;
  readonly loading: boolean;
}

async function readState(user: User | null): Promise<State> {
  if (!user) return { user: null, onboarded: false, finished: false, loading: false };
  try {
    const token = await getIdTokenResult(user);
    const onboarded = token.claims.onb === true;
    const finished = onboarded && (await isOnboardingComplete(user.uid));
    return { user, onboarded, finished, loading: false };
  } catch {
    // e.g. offline at start-up or a user deleted on the server: claims are unknown, so treat as not onboarded.
    return { user, onboarded: false, finished: false, loading: false };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ user: null, onboarded: false, finished: false, loading: true });

  useEffect(() => {
    let latest = 0;
    return onIdTokenChanged(auth(), (user) => {
      const event = ++latest;
      // The previous account's device data is gone before anything renders for the new state, also when the SDK
      // itself signed the user out (account deleted elsewhere, token revoked).
      void syncDeviceSession(user?.uid ?? null)
        .catch(() => undefined)
        .then(() => readState(user))
        .then((next) => {
          if (event === latest) setState(next);
        });
    });
  }, []);

  const refreshClaims = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) return;
    await getIdToken(user, true);
    setState(await readState(user));
  }, []);

  const finishOnboarding = useCallback(async () => {
    const user = auth().currentUser;
    if (!user) return;
    await setOnboardingComplete(user.uid);
    setState(await readState(user));
  }, []);

  const session = useMemo<Session>(() => {
    let phase: SessionPhase;
    if (state.loading) phase = 'loading';
    else if (!state.user) phase = 'signedOut';
    else phase = state.onboarded && state.finished ? 'ready' : 'onboarding';
    return { phase, user: state.user, onboarded: state.onboarded, refreshClaims, finishOnboarding };
  }, [state, refreshClaims, finishOnboarding]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession() outside SessionProvider');
  return session;
}

/** The signed-in uid; screens behind the `ready`/`onboarding` guards can rely on it. */
export function useUid(): string {
  const { user } = useSession();
  if (!user) throw new Error('useUid() without a signed-in user');
  return user.uid;
}
