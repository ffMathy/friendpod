import { USER_SETTING_REASONS, type UnmatchedReason } from '@friendpod/core';

/** Unmatched reasons that name a user-set constraint, so Home and Me can name the setting (§6.7). */
export type UserSettingReason = 'RADIUS' | 'AGE' | 'GENDER_POOL' | 'LANGUAGE' | 'AVAILABILITY';

export function isUserSettingReason(reason: UnmatchedReason | undefined): reason is UserSettingReason {
  return reason !== undefined && USER_SETTING_REASONS.includes(reason);
}
