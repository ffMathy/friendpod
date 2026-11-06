/**
 * UI copy, one file per product area so each area can be edited on its own. Every key path is the same as
 * before the split (`t('pod.next.voteBody')`); the files are deep-merged here. A leaf key lives in exactly one
 * file, and Danish and English have the same keys per file (test/i18n.test.ts).
 *
 *   common      shared words and the design system's built-in strings (back, close, "(optional)", "Step n of N")
 *   auth        welcome, auth, languages
 *   onboarding  onboarding, prefs, gender, availability, aboutMe, waitlist
 *   drop        home, unmatched, pods, podState
 *   pod         pod, plan, chat, attendance
 *   after       feedback, member, report
 *   privacy     interests, moderation, privacy, sensitiveConsent, deleteAccount
 *   shell       tabs, me, settings, info, notices, blockingSetting, errors
 */
import daAfter from './da/after.json';
import daAuth from './da/auth.json';
import daCommon from './da/common.json';
import daDrop from './da/drop.json';
import daOnboarding from './da/onboarding.json';
import daPod from './da/pod.json';
import daPrivacy from './da/privacy.json';
import daShell from './da/shell.json';
import enAfter from './en/after.json';
import enAuth from './en/auth.json';
import enCommon from './en/common.json';
import enDrop from './en/drop.json';
import enOnboarding from './en/onboarding.json';
import enPod from './en/pod.json';
import enPrivacy from './en/privacy.json';
import enShell from './en/shell.json';

export type TranslationTree = { readonly [key: string]: string | TranslationTree };

export const AREAS = ['common', 'auth', 'onboarding', 'drop', 'pod', 'after', 'privacy', 'shell'] as const;
export type Area = (typeof AREAS)[number];

export const areaFiles = {
  en: { common: enCommon, auth: enAuth, onboarding: enOnboarding, drop: enDrop, pod: enPod, after: enAfter, privacy: enPrivacy, shell: enShell },
  da: { common: daCommon, auth: daAuth, onboarding: daOnboarding, drop: daDrop, pod: daPod, after: daAfter, privacy: daPrivacy, shell: daShell },
} as const satisfies Record<'en' | 'da', Record<Area, TranslationTree>>;

/** All English keys: the type i18next checks translation keys against. */
export type Translation = typeof enCommon &
  typeof enAuth &
  typeof enOnboarding &
  typeof enDrop &
  typeof enPod &
  typeof enAfter &
  typeof enPrivacy &
  typeof enShell;

function deepMerge(target: Record<string, unknown>, source: TranslationTree): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (typeof value === 'string') target[key] = value;
    else target[key] = deepMerge(existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {}, value);
  }
  return target;
}

export function mergeAreas(files: Readonly<Record<Area, TranslationTree>>): Translation {
  return AREAS.reduce<Record<string, unknown>>((acc, area) => deepMerge(acc, files[area]), {}) as Translation;
}

export const en: Translation = mergeAreas(areaFiles.en);
export const da: Translation = mergeAreas(areaFiles.da);
