/**
 * completeOnboarding (DESIGN.md §3.1 step 6, §10.1; PRIVACY.md §11). The date of birth is used for the 18+ check
 * and then dropped: only `birthYear` is stored. Under 18, the Auth user is deleted and only 30-day
 * `underageMarkers` entries remain, so a retry with the same sign-in gets the same answer.
 *
 * DESIGN-DEVIATION: §3.1 keys the marker on HMAC(email) only. Sign in with Apple requests no email scope (§11), so
 * its tokens usually carry no email and the guard would never apply; the marker is also keyed on each federated
 * identity in the token (HMAC of provider and provider uid, e.g. Apple's `sub`, which survives deleting and
 * recreating the Firebase user). PRIVACY.md §11 and the §5 retention table should name both keys.
 */
import {
  AVAILABILITY_ALL,
  DEFAULT_RADIUS_KM,
  DROP_TIME_ZONE,
  MIN_AGE,
  defaultAgeRange,
  emailHash,
  getLaunchArea,
  identityHash,
  getMatchingProfile,
  participationEffectiveWeek,
  prefsSchema,
  reliability,
  resolveLaunchArea,
  toLocal,
  type CallableInput,
  type CallableOutput,
  type LaunchArea,
  type MatchProfileDoc,
  type Prefs,
  type UserDoc,
} from '@grouper/core';
import { AppError, grpcCode } from '../lib/errors';
import { docs, ts, UNDERAGE_MARKER_TTL_MS } from '../lib/firestore';
import type { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import type { CallContext } from '../lib/handler';
import type { AppDeps } from '../lib/runtime';

type Input = CallableInput<'completeOnboarding'>;
type Output = CallableOutput<'completeOnboarding'>;

/** Above this the date of birth is treated as a typo, not an age. */
const MAX_PLAUSIBLE_AGE = 120;
const GRPC_ALREADY_EXISTS = 6;

type MarkerRef = ReturnType<ReturnType<typeof docs>['underageMarker']>;

/** `identities.email` lists email addresses (covered by the email key), not a provider's own user id. */
const NOT_A_PROVIDER_IDENTITY = 'email';

/** Age in whole years on the current calendar date in Europe/Copenhagen; null for a date in the future. */
export function ageOn(dob: string, nowMs: number): number | null {
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number];
  const today = toLocal(nowMs, DROP_TIME_ZONE);
  const birthdayPassed = today.month > m || (today.month === m && today.day >= d);
  const age = today.year - y - (birthdayPassed ? 0 : 1);
  return age < 0 ? null : age;
}

export async function completeOnboarding(deps: AppDeps, call: CallContext, input: Input): Promise<Output> {
  const { uid, token, now } = call;
  if (token['onb'] === true) throw new AppError('ALREADY_EXISTS');
  const refs = docs(deps.db);

  const markerRefs = await underageMarkerRefs(deps, token);
  if (markerRefs.length > 0) {
    const markers = await deps.db.getAll(...markerRefs);
    if (markers.some((m) => m.exists && m.data()!.expiresAt.toMillis() > now)) await rejectUnderage(deps, uid, [], now);
  }

  // Callables do not check revocation, so the ID token of an Auth user deleted a moment ago (under 18, or a
  // retry from the same screen) is still valid for up to an hour. Nothing is written for a uid without a user.
  const record = await authUserOrNull(deps, uid);
  if (record === null) throw new AppError('UNAUTHENTICATED');

  const userRef = refs.user(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    // An earlier call wrote the profile but did not finish the Auth steps (e.g. it timed out): finish them.
    await finishAuthUser(deps, record);
    const areaId = existing.data()!.area.areaId;
    return { areaStatus: (areaId === null ? null : getLaunchArea(areaId))?.status ?? 'outside' };
  }

  const age = ageOn(input.dob, now);
  if (age === null || age > MAX_PLAUSIBLE_AGE) throw new AppError('VALIDATION');
  if (age < MIN_AGE) await rejectUnderage(deps, uid, markerRefs, now);

  const area = resolveLaunchArea(input.area.gh5);
  const prefs = initialPrefs(age, area, input);
  const { user, profile } = initialDocs(input, prefs, area, now);

  const batch = deps.db.batch();
  batch.create(userRef, user);
  batch.create(refs.matchProfile(uid), profile);
  try {
    await batch.commit();
  } catch (err) {
    if (grpcCode(err) === GRPC_ALREADY_EXISTS) throw new AppError('ALREADY_EXISTS');
    throw err;
  }
  try {
    await finishAuthUser(deps, record);
  } catch (err) {
    if (!isUserNotFound(err)) throw err;
    // A concurrent under-18 call from the same token deleted the user after the check above: the profile
    // must not outlive it, and nothing else would ever reach it (no Auth user, so no deletion request).
    const cleanup = deps.db.batch();
    cleanup.delete(userRef);
    cleanup.delete(refs.matchProfile(uid));
    await cleanup.commit();
    throw new AppError('UNAUTHENTICATED');
  }
  return { areaStatus: area?.status ?? 'outside' };
}

/** One marker per sign-in key in the token: the email, if any, and each federated identity (provider uid). */
async function underageMarkerRefs(deps: AppDeps, token: DecodedIdToken): Promise<MarkerRef[]> {
  const refs = docs(deps.db);
  const hmac = deps.uidHmac();
  const keys: Promise<string>[] = [];
  if (typeof token.email === 'string' && token.email.includes('@')) keys.push(emailHash(hmac, 'underage', token.email));
  for (const [provider, ids] of Object.entries(token.firebase?.identities ?? {})) {
    const first: unknown = Array.isArray(ids) ? ids[0] : undefined;
    if (provider === NOT_A_PROVIDER_IDENTITY || typeof first !== 'string' || first.length === 0) continue;
    keys.push(identityHash(hmac, 'underage', provider, first));
  }
  return [...new Set(await Promise.all(keys))].map((key) => refs.underageMarker(key));
}

async function rejectUnderage(deps: AppDeps, uid: string, newMarkers: readonly MarkerRef[], now: number): Promise<never> {
  // The markers are written before the Auth user is deleted, so a failed deletion still leaves the retry guard.
  if (newMarkers.length > 0) {
    const batch = deps.db.batch();
    for (const ref of newMarkers) batch.set(ref, { createdAt: ts(now), expiresAt: ts(now + UNDERAGE_MARKER_TTL_MS) });
    await batch.commit();
  }
  try {
    await deps.auth.deleteUser(uid);
  } catch (err) {
    if (!isUserNotFound(err)) throw err;
  }
  throw new AppError('UNDERAGE');
}

function isUserNotFound(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'auth/user-not-found';
}

async function authUserOrNull(deps: AppDeps, uid: string): Promise<UserRecord | null> {
  try {
    return await deps.auth.getUser(uid);
  } catch (err) {
    if (isUserNotFound(err)) return null;
    throw err;
  }
}

function initialPrefs(age: number, area: LaunchArea | null, input: Input): Prefs {
  const profile = getMatchingProfile(area?.profile ?? 'launch');
  const defaults: Prefs = {
    ...defaultAgeRange(age, profile),
    maxKm: DEFAULT_RADIUS_KM,
    languages: [input.locale],
    availability: AVAILABILITY_ALL,
    sameGenderOnly: false,
    openToAnyone: profile.defaults.openToAnyoneDefault,
  };
  const patch = Object.fromEntries(Object.entries(input.prefs ?? {}).filter(([, v]) => v !== undefined));
  const merged = prefsSchema.safeParse({ ...defaults, ...patch });
  if (!merged.success) throw new AppError('VALIDATION');
  return merged.data;
}

function initialDocs(input: Input, prefs: Prefs, area: LaunchArea | null, now: number): { user: UserDoc; profile: MatchProfileDoc } {
  const birthYear = Number(input.dob.slice(0, 4));
  const areaId = area?.id ?? null;
  const at = ts(now);
  const stats = { attended: 0, noShows: 0, lateCancels: 0 };
  const user: UserDoc = {
    firstName: input.firstName,
    locale: input.locale,
    birthYear,
    area: { gh5: input.area.gh5, label: area ? area.label[input.locale] : '', areaId },
    prefs,
    gender: null,
    participation: { mode: 'auto' },
    photo: null,
    stats,
    status: 'active',
    lastDrop: null,
    legal: { terms: input.legal.terms, privacy: input.legal.privacy },
    interestCount: 0,
    createdAt: at,
    lastActiveAt: at,
  };
  const profile: MatchProfileDoc = {
    status: 'active',
    areaId,
    gh5: input.area.gh5,
    birthYear,
    ageMin: prefs.ageMin,
    ageMax: prefs.ageMax,
    maxKm: prefs.maxKm,
    sameGenderOnly: false,
    gender: null,
    languages: prefs.languages,
    availability: prefs.availability,
    themes: [],
    themeIds: [],
    secondary: [],
    blockedH: [],
    recentH: {},
    recentMinUntil: null,
    reliability: reliability(stats),
    noShowEvents: [],
    waitingSinceWeek: participationEffectiveWeek('auto', now),
    declinesInRow: 0,
    ignoredInRow: 0,
    activePods: 0,
    activeSensitivePods: 0,
    sensitiveProposals: [],
    sensitiveHold: null,
    weekClaim: null,
    lastDrop: null,
    attendedVerified: 0,
    founderInvited: false,
    openReportCount: 0,
    priority: false,
    openToAnyone: prefs.openToAnyone,
    participation: { mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: null },
    createdAt: at,
    updatedAt: at,
  };
  return { user, profile };
}

/** Clears the Google display name and photo URL copied into Auth, then sets the `onb` claim (§3.1 step 2, A15). */
async function finishAuthUser(deps: AppDeps, record: UserRecord): Promise<void> {
  await deps.auth.updateUser(record.uid, { displayName: null, photoURL: null });
  await deps.auth.setCustomUserClaims(record.uid, { ...(record.customClaims ?? {}), onb: true });
}
