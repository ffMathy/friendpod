/**
 * The shape of a preview scenario (preview/README.md): one fixed "world" a screen is rendered against. Scenarios are
 * plain data plus optional callable handlers; nothing here talks to Firebase or any other real service.
 */
import type { CallableInput, CallableName, CallableOutput, Locale } from '@grouper/core';
import type { PreviewStore } from './store';

/** Firestore document fields. Timestamps are `ts(...)` values (anything with `toMillis()`), as the app's schemas expect. */
export type DocData = Readonly<Record<string, unknown>>;

export interface PreviewUser {
  readonly uid: string;
  readonly email?: string;
  /** ID-token custom claims; `{ onb: true }` once completeOnboarding has run (§9 Auth hardening). */
  readonly claims?: Readonly<Record<string, unknown>>;
  /** Sign-in provider, which decides the re-authentication path (Settings → Delete account). Default 'apple.com'. */
  readonly provider?: 'apple.com' | 'google.com' | 'emailLink';
}

export interface CallableContext {
  readonly store: PreviewStore;
  readonly uid: string | null;
  readonly now: number;
}

export type CallableHandler<N extends CallableName> = (
  input: CallableInput<N>,
  ctx: CallableContext,
) => CallableOutput<N> | Promise<CallableOutput<N>>;

export type CallableHandlers = { readonly [N in CallableName]?: CallableHandler<N> };

/** A Google Places (New) result for the place search (D8). Use placeholder names, never real venues. */
export interface PlaceFixture {
  readonly placeId: string;
  readonly name: string;
  /** Short formatted address, e.g. "Latin Quarter, Aarhus C". */
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly primaryType: string;
}

export interface Scenario {
  /** Must equal the file name (scenarios/<id>.ts). */
  readonly id: string;
  /** One line: what this world shows, e.g. "Pod scheduled, the day before the meetup; chat open". */
  readonly title: string;
  /** The fixed "now" the app sees (Date and Date.now start here and then run normally): ISO with offset, or epoch ms. */
  readonly now: string | number;
  /** Default UI language; the URL's `?locale=` wins. Default 'en'. */
  readonly locale?: Locale;
  /** What the app's own code sees as Platform.OS. Default 'ios' (Sign in with Apple shows, as on the storyboards). */
  readonly platform?: 'ios' | 'android';
  /** The signed-in user, or null when signed out. */
  readonly user: PreviewUser | null;
  /**
   * The device flag set after the post-claim onboarding steps (features/session/onboardingFlag.ts). Default: true when
   * `claims.onb` is true. Set false to land in the post-claim onboarding steps.
   */
  readonly onboardingFinished?: boolean;
  /**
   * Firestore documents by full path, e.g. `users/u_me`, `users/u_me/pods/<podId>`, `pods/<podId>/options/o1`; or a
   * function of the preview's language, for content people write in their own language (chat, About me).
   */
  readonly docs?: Readonly<Record<string, DocData>> | ((ctx: { readonly locale: Locale }) => Readonly<Record<string, DocData>>);
  /** Callable overrides; every other callable answers with a valid default (runtime/callables.ts). */
  readonly callables?: CallableHandlers;
  /** Photo per owner uid (an image URL, e.g. a data: URI). Default: a generated initial avatar. */
  readonly photos?: Readonly<Record<string, string>>;
  /** Place search results (Google Places is stubbed on the network layer). */
  readonly places?: readonly PlaceFixture[];
  /** OS notification permission as the app sees it. Default 'notDetermined'. */
  readonly pushPermission?: 'granted' | 'denied' | 'notDetermined';
  /** Extra expo-secure-store entries (device-local flags). */
  readonly secureStore?: Readonly<Record<string, string>>;
}
