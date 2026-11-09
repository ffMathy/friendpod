import { cityLinkPath } from '@friendpod/core';

/**
 * The public host for links people share: the brand domain, connected as a custom domain to the production Hosting
 * site, which serves the city page (hosting/public/c/). The `<project>.firebaseapp.com` Hosting domain
 * (`appConfig.emailLinkDomain`) is for email sign-in links only: in a share message it looks untrustworthy and
 * off-brand, and it is too long to sit on one line beside "Copy". The city page is static and the same in every
 * project (no requests, nothing environment-specific), so staging and development builds share the public link too.
 * [A] friendpod.dk until the company domain is fixed; it must be added to the production Hosting site before launch.
 */
export const PUBLIC_LINK_HOST = 'friendpod.dk';

/**
 * The shared city page, `https://friendpod.dk/c/<areaId>` (hosting/public/c/index.html). The link names the city only:
 * no referral code, no user data.
 */
export function cityLink(areaId: string): string {
  return `https://${PUBLIC_LINK_HOST}${cityLinkPath(areaId)}`;
}
