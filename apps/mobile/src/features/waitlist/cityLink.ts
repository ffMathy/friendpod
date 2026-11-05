import { cityLinkPath } from '@grouper/core';
import { appConfig } from '@/lib/env';

/**
 * The shared city page, `https://<hosting domain>/c/<areaId>` (hosting/public/c/index.html). The Hosting domain is the
 * one that already serves the email-link handler. The link names the city only: no referral code, no user data.
 */
export function cityLink(areaId: string): string {
  return `https://${appConfig.emailLinkDomain}${cityLinkPath(areaId)}`;
}
