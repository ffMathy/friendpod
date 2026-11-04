/**
 * Email sign-in links arrive as App Links / Universal Links on the Hosting domain
 * (`https://<projectId>.firebaseapp.com/__/auth/links?link=…`, §11) and are rewritten to
 * `/auth/complete`, which hands the whole incoming URL to `signInWithEmailLink`.
 */
const EMAIL_LINK_PATH = '/__/auth/links';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.includes(EMAIL_LINK_PATH) || /[?&]mode=signIn(?:&|$)/.test(path)) {
    return `/auth/complete?link=${encodeURIComponent(path)}`;
  }
  return path;
}
