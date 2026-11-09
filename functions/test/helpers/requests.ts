import type { DecodedAppCheckToken } from 'firebase-admin/app-check';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { CallableRequestLike } from '../../src/lib/handler';

export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-friendpod';

export function idToken(uid: string, nowMs: number, claims: Record<string, unknown> = {}): DecodedIdToken {
  const nowS = Math.floor(nowMs / 1000);
  return {
    aud: PROJECT_ID,
    auth_time: nowS,
    exp: nowS + 3600,
    iat: nowS,
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    sub: uid,
    uid,
    firebase: { identities: {}, sign_in_provider: 'google.com' },
    ...claims,
  } as DecodedIdToken;
}

export function appCheck(nowMs: number, alreadyConsumed?: boolean): NonNullable<CallableRequestLike['app']> {
  const nowS = Math.floor(nowMs / 1000);
  const token: DecodedAppCheckToken = { iss: 'https://firebaseappcheck.googleapis.com/1', sub: '1:1:ios:1', aud: [PROJECT_ID], exp: nowS + 3600, iat: nowS, app_id: '1:1:ios:1' };
  return { appId: '1:1:ios:1', token, ...(alreadyConsumed === undefined ? {} : { alreadyConsumed }) };
}

export interface RequestOptions {
  /** null: no auth at all. */
  readonly uid?: string | null;
  readonly claims?: Record<string, unknown>;
  /** null: no App Check token. */
  readonly app?: NonNullable<CallableRequestLike['app']> | null;
  readonly nowMs: number;
}

/** A callable request as firebase-functions hands it to the handler after token verification. */
export function request(data: unknown, o: RequestOptions): CallableRequestLike {
  const uid = o.uid === undefined ? 'user_1' : o.uid;
  const app = o.app === undefined ? appCheck(o.nowMs) : o.app;
  return {
    data,
    ...(uid === null ? {} : { auth: { uid, token: idToken(uid, o.nowMs, { onb: true, ...o.claims }), rawToken: 'raw' } }),
    ...(app === null ? {} : { app }),
  };
}
