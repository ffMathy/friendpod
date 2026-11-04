/**
 * App error codes carried in `HttpsError.details.code` (DESIGN.md §10). The client localises them;
 * the canonical gRPC-style code is fixed here so both codebases map them identically.
 */
export const APP_ERRORS = {
  VALIDATION: 'invalid-argument',
  URL: 'invalid-argument',
  CONTACT_INFO: 'invalid-argument',
  UNDERAGE: 'failed-precondition',
  GENDER_CONSENT: 'failed-precondition',
  STAR_LIMIT: 'failed-precondition',
  DEADLINE: 'failed-precondition',
  NOT_INVITED: 'failed-precondition',
  STATE: 'failed-precondition',
  LIMIT: 'failed-precondition',
  WINDOW: 'failed-precondition',
  RECENT_LOGIN: 'failed-precondition',
  APP_CHECK_REPLAY: 'failed-precondition',
  NOT_ONBOARDED: 'failed-precondition',
  NOT_CO_MEMBER: 'permission-denied',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  RATE_LIMITED: 'resource-exhausted',
  EMBED_BUDGET: 'unavailable',
  FEATURE_DISABLED: 'unavailable',
  INTERNAL: 'internal',
} as const;

export type AppErrorCode = keyof typeof APP_ERRORS;
export type CanonicalErrorCode = (typeof APP_ERRORS)[AppErrorCode];

export function canonicalCodeFor(code: AppErrorCode): CanonicalErrorCode {
  return APP_ERRORS[code];
}
