import { describe, expect, it } from 'vitest';
import { consentProofFor } from '../src/legal/hashes';
import {
  addInterestsInput,
  CALLABLES,
  completeOnboardingInput,
  deleteAccountInput,
  proposeOptionInput,
  reportInput,
  setParticipationInput,
  updateProfileInput,
} from '../src/schemas/callables';
import { firstNameSchema, weekIdSchema } from '../src/schemas/common';
import { matchProfileDocSchema, podCardDocSchema } from '../src/schemas/documents';
import { prefsSchema } from '../src/schemas/profile';

const ts = { toMillis: () => 0 };
const consent = { ...consentProofFor('art9-tag-en-v1'), checked: true };

describe('callable schemas (§10)', () => {
  it('accepts a valid onboarding and rejects unknown keys (strict inputs)', () => {
    const input = { firstName: ' Anne-Marie ', dob: '1995-02-28', locale: 'da', area: { gh5: 'u1zr2' }, legal: { terms: 'terms-v1', privacy: 'privacy-v1' } };
    expect(completeOnboardingInput.parse(input).firstName).toBe('Anne-Marie');
    expect(completeOnboardingInput.safeParse({ ...input, postcode: '8000' }).success).toBe(false);
    expect(completeOnboardingInput.safeParse({ ...input, dob: '1995-02-30' }).success).toBe(false);
    expect(completeOnboardingInput.safeParse({ ...input, prefs: { sameGenderOnly: true } }).success).toBe(false);
  });

  it('requires gender consent with gender', () => {
    expect(updateProfileInput.safeParse({ gender: 'woman' }).success).toBe(false);
    expect(updateProfileInput.safeParse({ gender: 'woman', genderConsent: { ...consentProofFor('gender-en-v1'), checked: true } }).success).toBe(true);
    expect(updateProfileInput.safeParse({}).success).toBe(false);
    expect(updateProfileInput.safeParse({ prefs: { ageMin: 30, ageMax: 33 } }).success).toBe(false);
  });

  it('validates addInterests items, including the warm-up and the consent payload', () => {
    expect(addInterestsInput.parse({ items: [] })).toEqual({ items: [] });
    expect(addInterestsInput.safeParse({ items: [{ text: 'gravid', consent }] }).success).toBe(true);
    expect(addInterestsInput.safeParse({ items: [{ text: 'gravid', consent: { ...consent, checked: false } }] }).success).toBe(false);
    expect(addInterestsInput.safeParse({ items: [{ text: 'x', selfFlag: true }] }).success).toBe(false);
    expect(addInterestsInput.safeParse({ items: Array.from({ length: 11 }, () => ({ text: 'ab' })) }).success).toBe(false);
  });

  it('allowlists map hosts and requires the public-place tick', () => {
    const base = { podId: 'a'.repeat(20), startsAt: 1, placeText: 'Café Europa', publicPlace: true };
    expect(proposeOptionInput.safeParse({ ...base, mapUrl: 'https://maps.app.goo.gl/abc' }).success).toBe(true);
    expect(proposeOptionInput.safeParse({ ...base, mapUrl: 'https://www.openstreetmap.org/#map=17/56.15/10.2' }).success).toBe(true);
    expect(proposeOptionInput.safeParse({ ...base, mapUrl: 'https://evil.example/maps' }).success).toBe(false);
    expect(proposeOptionInput.safeParse({ ...base, mapUrl: 'http://maps.apple.com/?q=x' }).success).toBe(false);
    expect(proposeOptionInput.safeParse({ ...base, mapUrl: 'https://user@maps.apple.com/' }).success).toBe(false);
    expect(proposeOptionInput.safeParse({ ...base, publicPlace: false }).success).toBe(false);
  });

  it('checks report targets and participation modes', () => {
    const pod = 'b'.repeat(20);
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod }, category: 'safety' }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod, uid: 'u1' }, category: 'safety', text: 'x'.repeat(501) }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'option', podId: pod, optionId: 'o1' }, category: 'content' }).success).toBe(true);
    expect(setParticipationInput.safeParse({ mode: 'auto', until: 5 }).success).toBe(false);
    expect(setParticipationInput.safeParse({ mode: 'pause', until: 5 }).success).toBe(true);
  });

  it('treats a null payload as {} and marks replay-protected callables', () => {
    expect(deleteAccountInput.parse(null)).toEqual({});
    expect(deleteAccountInput.safeParse({ uid: 'x' }).success).toBe(false);
    const protectedNames = Object.entries(CALLABLES).filter(([, s]) => s.replayProtected).map(([n]) => n);
    expect(protectedNames.sort()).toEqual(['deleteAccount', 'exportData', 'report']);
    expect(CALLABLES.addInterests.codebase).toBe('embedder');
    expect(CALLABLES.completeOnboarding.requiresOnboarding).toBe(false);
  });
});

describe('document schemas (§8)', () => {
  it('keeps first names free of contact details', () => {
    expect(firstNameSchema.safeParse('Zoë').success).toBe(true);
    expect(firstNameSchema.safeParse("O'Neil").success).toBe(true);
    expect(firstNameSchema.safeParse('anna@x.dk').success).toBe(false);
    expect(firstNameSchema.safeParse('Anna 12345678').success).toBe(false);
    expect(firstNameSchema.safeParse('x'.repeat(31)).success).toBe(false);
    expect(weekIdSchema.safeParse('2025-W53').success).toBe(false);
  });

  it('enforces an age range of at least 5 years', () => {
    const prefs = { ageMin: 25, ageMax: 30, maxKm: 10, languages: ['da'], availability: 3, sameGenderOnly: false, openToAnyone: false };
    expect(prefsSchema.safeParse(prefs).success).toBe(true);
    expect(prefsSchema.safeParse({ ...prefs, ageMax: 29 }).success).toBe(false);
    expect(prefsSchema.safeParse({ ...prefs, maxKm: 20 }).success).toBe(false);
    expect(prefsSchema.safeParse({ ...prefs, languages: ['da', 'da'] }).success).toBe(false);
  });

  it('rejects sensitive-themed cards that carry age span or shared interests', () => {
    const card = {
      state: 'proposed',
      myStatus: 'invited',
      themeLabel: 'gravid',
      themeSensitive: true,
      sizeTarget: 5,
      acceptedCount: 0,
      acceptBy: ts,
      reasons: [{ code: 'THEME', yourWording: 'gravid' }],
      areaLabel: 'Aarhus C',
    };
    expect(podCardDocSchema.safeParse(card).success).toBe(true);
    expect(podCardDocSchema.safeParse({ ...card, ageSpan: { min: 25, max: 31 } }).success).toBe(false);
    expect(podCardDocSchema.safeParse({ ...card, reasons: [...card.reasons, { code: 'ALSO_SHARE', yourWordings: ['løb'] }] }).success).toBe(false);
  });

  it('rejects match profiles whose secondary includes a sensitive holding (S2)', () => {
    const profile = {
      status: 'active', areaId: 'aarhus', gh5: 'u1zr2', birthYear: 1995, ageMin: 24, ageMax: 38, maxKm: 10, sameGenderOnly: false, gender: null,
      languages: ['da'], availability: 63,
      themes: [{ c: 'c_00000000000000000001', starred: false, sens: false }, { c: 'c_00000000000000000002_p', starred: false, sens: true, consentRef: 'ce1' }],
      themeIds: ['c_00000000000000000001', 'c_00000000000000000002_p'],
      secondary: ['c_00000000000000000001'],
      blockedH: [], recentH: {}, recentMinUntil: null, reliability: 0.8, noShowEvents: [], waitingSinceWeek: '2026-W46', declinesInRow: 0, ignoredInRow: 0,
      activePods: 0, activeSensitivePods: 0, sensitiveProposals: [], sensitiveHold: null, weekClaim: null, lastDrop: null,
      attendedVerified: 0, founderInvited: false, openReportCount: 0, priority: false, openToAnyone: false, createdAt: ts, updatedAt: ts,
    };
    expect(matchProfileDocSchema.safeParse(profile).success).toBe(true);
    expect(matchProfileDocSchema.safeParse({ ...profile, secondary: [...profile.secondary, 'c_00000000000000000002_p'] }).success).toBe(false);
    expect(matchProfileDocSchema.safeParse({ ...profile, themes: [{ c: 'c_00000000000000000002_p', starred: false, sens: true }], themeIds: ['c_00000000000000000002_p'], secondary: [] }).success).toBe(false);
  });
});
