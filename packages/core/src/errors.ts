/**
 * App error codes carried in `HttpsError.details.code` (DESIGN.md §10). The client localises them;
 * the canonical gRPC-style code is fixed here so both codebases map them identically.
 */
export const APP_ERRORS = {
  // Raised by the callable wrapper before any handler runs: no signed-in user, or no App Check token.
  UNAUTHENTICATED: 'unauthenticated',
  APP_CHECK: 'unauthenticated',
  VALIDATION: 'invalid-argument',
  URL: 'invalid-argument',
  CONTACT_INFO: 'invalid-argument',
  BLOCKLIST: 'invalid-argument',
  PII_CPR: 'invalid-argument',
  // sendMessage returns this in `warnings` rather than throwing it; it is listed so the client has one message table.
  CONTACT_INFO_BEFORE_MEETUP: 'failed-precondition',
  UNDERAGE: 'failed-precondition',
  GENDER_CONSENT: 'failed-precondition',
  STAR_LIMIT: 'failed-precondition',
  DEADLINE: 'failed-precondition',
  NOT_INVITED: 'failed-precondition',
  STATE: 'failed-precondition',
  LIMIT: 'failed-precondition',
  WINDOW: 'failed-precondition',
  CHAT_CLOSED: 'failed-precondition',
  RECENT_LOGIN: 'failed-precondition',
  APP_CHECK_REPLAY: 'failed-precondition',
  NOT_ONBOARDED: 'failed-precondition',
  /** The caller is not a current confirmed member of the pod (not in `pods/{podId}.memberUids`). */
  NOT_MEMBER: 'permission-denied',
  NOT_CO_MEMBER: 'permission-denied',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  RATE_LIMITED: 'resource-exhausted',
  EMBED_BUDGET: 'unavailable',
  FEATURE_DISABLED: 'unavailable',
  INTERNAL: 'internal',
  /** A typed stub for later work; `details.design` names the DESIGN.md section. */
  NOT_IMPLEMENTED: 'unimplemented',
} as const;

export type AppErrorCode = keyof typeof APP_ERRORS;
export type CanonicalErrorCode = (typeof APP_ERRORS)[AppErrorCode];

export function canonicalCodeFor(code: AppErrorCode): CanonicalErrorCode {
  return APP_ERRORS[code];
}
