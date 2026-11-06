import { describe, expect, it } from 'vitest';
import { consentProofFor } from '../src/legal/hashes';
import { EMBEDDING_DIM, EMBEDDING_MODEL_ID } from '../src/interests/model';
import {
  addInterestsInput,
  CALLABLES,
  CHAT_MESSAGE_MAX,
  completeOnboardingInput,
  deleteAccountInput,
  proposeOptionInput,
  reportInput,
  sendMessageInput,
  sendMessageOutput,
  setArt9ConsentInput,
  setParticipationInput,
  submitFeedbackInput,
  updateProfileInput,
  withdrawArt9ConsentInput,
} from '../src/schemas/callables';
import { firstNameSchema, googleMapsPlaceUrl, weekIdSchema } from '../src/schemas/common';
import { matchProfileDocSchema, pairSignalDocSchema, podCardDocSchema, podDocSchema, podMessageDocSchema, reportDocSchema, userDocSchema } from '../src/schemas/documents';
import { ABOUT_ME_MAX, prefsSchema } from '../src/schemas/profile';

const ts = { toMillis: () => 0 };
const consent = { ...consentProofFor('art9-blanket-en-v1'), appVersion: '0.1.0', checked: true };
const unit = (i = 0): number[] => Array.from({ length: EMBEDDING_DIM }, (_, j) => (j === i ? 1 : 0));

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
    expect(updateProfileInput.safeParse({ gender: 'woman', genderConsent: { ...consentProofFor('gender-en-v1'), appVersion: '0.1.0', checked: true } }).success).toBe(true);
    expect(updateProfileInput.safeParse({}).success).toBe(false);
    expect(updateProfileInput.safeParse({ prefs: { ageMin: 30, ageMax: 33 } }).success).toBe(false);
  });

  it('takes device-embedded tags: model key, a 768-d unit vector and the detector result (D1)', () => {
    const item = { text: 'madlavning', vector: unit(), detector: { margin: -0.1 } };
    const input = { modelKey: EMBEDDING_MODEL_ID, items: [item] };
    expect(addInterestsInput.safeParse(input).success).toBe(true);
    expect(addInterestsInput.safeParse({ ...input, modelKey: 'eg300m-q4@5090578' }).success).toBe(false);
    expect(addInterestsInput.safeParse({ ...input, items: [] }).success).toBe(false);
    expect(addInterestsInput.safeParse({ ...input, items: Array.from({ length: 11 }, () => item) }).success).toBe(false);
    const withVector = (vector: number[]) => addInterestsInput.safeParse({ ...input, items: [{ ...item, vector }] }).success;
    expect(withVector(unit().slice(1))).toBe(false);
    expect(withVector(unit().map((x) => x * 1.0009))).toBe(true);
    expect(withVector(unit().map((x) => x * 1.002))).toBe(false);
    expect(withVector(unit().map((x, i) => (i === 5 ? Number.NaN : x)))).toBe(false);
    expect(withVector(unit().map((x, i) => (i === 5 ? Number.POSITIVE_INFINITY : x)))).toBe(false);
    expect(addInterestsInput.safeParse({ ...input, items: [{ ...item, detector: { margin: Number.NaN } }] }).success).toBe(false);
    // No word-list result travels with a tag any more (F38): the margin is the whole detector result.
    expect(addInterestsInput.safeParse({ ...input, items: [{ ...item, detector: { margin: -0.1, lexiconHit: false } }] }).success).toBe(false);
    expect(addInterestsInput.safeParse({ ...input, items: [{ ...item, selfFlagPrivate: true }] }).success).toBe(true);
    expect(addInterestsInput.safeParse({ ...input, items: [{ ...item, notSensitiveForMe: true }] }).success).toBe(true);
    expect(addInterestsInput.safeParse({ ...input, items: [{ ...item, selfFlagPrivate: true, notSensitiveForMe: true }] }).success).toBe(false);
    // No per-tag consent any more (D3).
    expect(addInterestsInput.safeParse({ ...input, items: [{ ...item, consent }] }).success).toBe(false);
  });

  it('takes the blanket Art. 9 consent with a checked, versioned proof (D3)', () => {
    expect(setArt9ConsentInput.safeParse({ consent }).success).toBe(true);
    expect(setArt9ConsentInput.safeParse({ consent: { ...consent, checked: false } }).success).toBe(false);
    // appVersion is recorded on the consent event (PRIVACY.md §3.4): required, and never free text.
    const { appVersion: _omitted, ...withoutVersion } = consent;
    expect(setArt9ConsentInput.safeParse({ consent: withoutVersion }).success).toBe(false);
    expect(setArt9ConsentInput.safeParse({ consent: { ...consent, appVersion: 'call me 555 1234' } }).success).toBe(false);
    expect(withdrawArt9ConsentInput.parse(null)).toEqual({});
    expect(withdrawArt9ConsentInput.safeParse({ interestId: 'a'.repeat(16) }).success).toBe(false);
  });

  it('takes an optional "about me" of up to 140 characters; empty clears it (D4)', () => {
    expect(updateProfileInput.parse({ aboutMe: '  Kaffe,\n  brætspil  og løb ' })).toEqual({ aboutMe: 'Kaffe, brætspil og løb' });
    expect(updateProfileInput.parse({ aboutMe: '' })).toEqual({ aboutMe: '' });
    expect(updateProfileInput.safeParse({ aboutMe: 'æ'.repeat(ABOUT_ME_MAX) }).success).toBe(true);
    expect(updateProfileInput.safeParse({ aboutMe: 'æ'.repeat(ABOUT_ME_MAX + 1) }).success).toBe(false);
  });

  it('takes a public Google place for an option: no free text, no tick, a built map URL (D8)', () => {
    const place = { placeId: 'ChIJ2fQhXlU_TEYRyH0tq2Y3YkU', name: 'Café Europa', address: 'Store Torv 3, Aarhus C', lat: 56.1567, lng: 10.2108, type: 'cafe' };
    const option = { podId: 'a'.repeat(20), startsAt: 1, place: { ...place, mapUrl: googleMapsPlaceUrl(place.placeId, place.name) } };
    expect(proposeOptionInput.safeParse(option).success).toBe(true);
    expect(option.place.mapUrl).toBe('https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Europa&query_place_id=ChIJ2fQhXlU_TEYRyH0tq2Y3YkU');
    const withPlace = (p: object) => proposeOptionInput.safeParse({ ...option, place: { ...option.place, ...p } }).success;
    expect(withPlace({ type: 'lodging' })).toBe(false);
    expect(withPlace({ lat: 56.15671 })).toBe(false);
    expect(withPlace({ mapUrl: 'https://maps.app.goo.gl/abc' })).toBe(false);
    expect(withPlace({ placeId: 'x' })).toBe(false);
    expect(proposeOptionInput.safeParse({ podId: option.podId, startsAt: 1, placeText: 'Café Europa', publicPlace: true }).success).toBe(false);
  });

  it('resolves "Who was there?" from the unticked members (D15)', () => {
    const feedback = { podId: 'a'.repeat(20), met: true, notThere: [], meetAgain: { u2: true }, keep: true };
    expect(submitFeedbackInput.safeParse(feedback).success).toBe(true);
    expect(submitFeedbackInput.safeParse({ ...feedback, notThere: ['u2', 'u2'] }).success).toBe(false);
    expect(submitFeedbackInput.safeParse({ ...feedback, attendance: { u2: 'came' } }).success).toBe(false);
  });

  it('checks report targets and participation modes', () => {
    const pod = 'b'.repeat(20);
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod }, category: 'safety' }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod, uid: 'u1' }, category: 'safety', text: 'x'.repeat(501) }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'option', podId: pod, optionId: 'o1' }, category: 'content' }).success).toBe(true);
    expect(setParticipationInput.safeParse({ mode: 'auto', until: 5 }).success).toBe(false);
    expect(setParticipationInput.safeParse({ mode: 'pause', until: 5 }).success).toBe(true);
  });

  it('reports chat messages by messageId; the server names the author', () => {
    const pod = 'b'.repeat(20);
    expect(reportInput.safeParse({ target: { type: 'message', podId: pod, messageId: 'm1' }, category: 'harassment' }).success).toBe(true);
    expect(reportInput.safeParse({ target: { type: 'message', podId: pod }, category: 'harassment' }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'message', podId: pod, messageId: 'a/b' }, category: 'harassment' }).success).toBe(false);
    // Each id only on its own target type; uid is given so that only the stray id can fail.
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod, uid: 'u2' }, category: 'harassment' }).success).toBe(true);
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod, uid: 'u2', messageId: 'm1' }, category: 'harassment' }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'option', podId: pod, optionId: 'o1', messageId: 'm1' }, category: 'harassment' }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'message', podId: pod, messageId: 'm1', optionId: 'o1' }, category: 'harassment' }).success).toBe(false);
    expect(reportInput.safeParse({ target: { type: 'user', podId: pod, uid: 'u2', optionId: 'o1' }, category: 'harassment' }).success).toBe(false);
  });

  it('takes text only in sendMessage, trimmed to 1–500 characters (D14)', () => {
    const podId = 'c'.repeat(20);
    expect(sendMessageInput.parse({ podId, text: '  På vej!  ' })).toEqual({ podId, text: 'På vej!' });
    expect(sendMessageInput.safeParse({ podId, quickReply: 'runningLate' }).success).toBe(false);
    expect(sendMessageInput.safeParse({ podId, text: 'hej', ackContactWarning: true }).success).toBe(true);
    expect(sendMessageInput.safeParse({ podId }).success).toBe(false);
    expect(sendMessageInput.safeParse({ podId, text: ' \n\t ' }).success).toBe(false);
    expect(sendMessageInput.safeParse({ podId, text: 'hej', authorUid: 'u1' }).success).toBe(false);
    expect(sendMessageInput.safeParse({ podId: 'short', text: 'hej' }).success).toBe(false);
    expect(sendMessageInput.safeParse({ podId, text: 'x'.repeat(CHAT_MESSAGE_MAX) }).success).toBe(true);
    expect(sendMessageInput.safeParse({ podId, text: ` ${'x'.repeat(CHAT_MESSAGE_MAX)} ` }).success).toBe(true);
    expect(sendMessageInput.safeParse({ podId, text: 'x'.repeat(CHAT_MESSAGE_MAX + 1) }).success).toBe(false);
  });

  it('returns a messageId or the contact-info warning from sendMessage', () => {
    expect(sendMessageOutput.safeParse({ messageId: 'm1' }).success).toBe(true);
    expect(sendMessageOutput.safeParse({ warnings: ['CONTACT_INFO_BEFORE_MEETUP'] }).success).toBe(true);
    expect(sendMessageOutput.safeParse({ warnings: [] }).success).toBe(false);
    expect(sendMessageOutput.safeParse({ warnings: ['HOME_ADDRESS'] }).success).toBe(false);
  });

  it('treats a null payload as {} and marks replay-protected callables', () => {
    expect(deleteAccountInput.parse(null)).toEqual({});
    expect(deleteAccountInput.safeParse({ uid: 'x' }).success).toBe(false);
    const protectedNames = Object.entries(CALLABLES).filter(([, s]) => s.replayProtected).map(([n]) => n);
    expect(protectedNames.sort()).toEqual(['deleteAccount', 'exportData', 'report']);
    expect(Object.values(CALLABLES).every((c) => c.codebase === 'default')).toBe(true);
    expect('withdrawSensitive' in CALLABLES).toBe(false);
    expect(CALLABLES.completeOnboarding.requiresOnboarding).toBe(false);
    expect(CALLABLES.sendMessage).toMatchObject({ codebase: 'default', requiresOnboarding: true, replayProtected: false, requiresRecentLogin: false });
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

  it('stores a chat message as text only (D14)', () => {
    const msg = { authorUid: 'u1', text: 'Jeg er her', createdAt: ts, expiresAt: ts };
    expect(podMessageDocSchema.safeParse(msg).success).toBe(true);
    expect(podMessageDocSchema.safeParse({ authorUid: 'u1', quickReply: 'imHere', createdAt: ts, expiresAt: ts }).success).toBe(false);
    expect(podMessageDocSchema.safeParse({ ...msg, text: '' }).success).toBe(false);
    expect(podMessageDocSchema.safeParse({ ...msg, text: 'x'.repeat(501) }).success).toBe(false);
    const { expiresAt: _ttl, ...withoutTtl } = msg;
    expect(podMessageDocSchema.safeParse(withoutTtl).success).toBe(false);
  });

  it('keeps a copy of a reported message in the report, and only there', () => {
    const report = {
      reporterUid: 'u1', targetUid: 'u2', podId: 'b'.repeat(20), category: 'harassment', status: 'open', createdAt: ts, expiresAt: ts,
      target: { type: 'message', messageId: 'm1' }, message: { text: 'rude words' },
    };
    expect(reportDocSchema.safeParse(report).success).toBe(true);
    expect(reportDocSchema.safeParse({ ...report, message: { quickReply: 'cantMakeIt' } }).success).toBe(false);
    const { message: _copy, ...withoutCopy } = report;
    expect(reportDocSchema.safeParse(withoutCopy).success).toBe(false);
    expect(reportDocSchema.safeParse({ ...report, target: { type: 'message' } }).success).toBe(false);
    expect(reportDocSchema.safeParse({ ...report, target: { type: 'user' } }).success).toBe(false);
    expect(reportDocSchema.safeParse({ ...withoutCopy, target: { type: 'user' } }).success).toBe(true);
    expect(reportDocSchema.safeParse({ ...withoutCopy, target: { type: 'user', messageId: 'm1' } }).success).toBe(false);
    expect(reportDocSchema.safeParse({ ...withoutCopy, target: { type: 'option', optionId: 'o1', messageId: 'm1' } }).success).toBe(false);
    expect(reportDocSchema.safeParse({ ...withoutCopy, target: { type: 'option', optionId: 'o1' } }).success).toBe(true);
    expect(reportDocSchema.safeParse({ ...report, target: { type: 'message', messageId: 'm1', optionId: 'o1' } }).success).toBe(false);
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
      attendedVerified: 0, founderInvited: false, openReportCount: 0, priority: false, openToAnyone: false,
      participation: { mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: null }, createdAt: ts, updatedAt: ts,
    };
    expect(matchProfileDocSchema.safeParse(profile).success).toBe(true);
    // Holds expire on their own (D2): `until` is required.
    expect(matchProfileDocSchema.safeParse({ ...profile, sensitiveHold: { reason: 'notGenuine', since: ts } }).success).toBe(false);
    expect(matchProfileDocSchema.safeParse({ ...profile, sensitiveHold: { reason: 'notGenuine', since: ts, until: ts } }).success).toBe(true);
    expect(matchProfileDocSchema.safeParse({ ...profile, secondary: [...profile.secondary, 'c_00000000000000000002_p'] }).success).toBe(false);
    expect(matchProfileDocSchema.safeParse({ ...profile, themes: [{ c: 'c_00000000000000000002_p', starred: false, sens: true }], themeIds: ['c_00000000000000000002_p'], secondary: [] }).success).toBe(false);
  });

  it('records the blanket Art. 9 consent and "about me" on the user doc', () => {
    const user = {
      firstName: 'Anne', locale: 'da', birthYear: 1995, area: { gh5: 'u1zr2', label: 'Aarhus C', areaId: 'aarhus' },
      prefs: { ageMin: 25, ageMax: 35, maxKm: 10, languages: ['da'], availability: 3, sameGenderOnly: false, openToAnyone: false },
      gender: null, participation: { mode: 'auto' }, photo: null, stats: { attended: 0, noShows: 0, lateCancels: 0 }, status: 'active',
      lastDrop: null, legal: { terms: 'terms-v1', privacy: 'privacy-v1' }, interestCount: 0, createdAt: ts, lastActiveAt: ts,
    };
    expect(userDocSchema.safeParse(user).success).toBe(true);
    const art9 = { ...consentProofFor('art9-blanket-da-v1'), at: ts };
    expect(userDocSchema.safeParse({ ...user, legal: { ...user.legal, art9 }, aboutMe: 'Kaffe og brætspil' }).success).toBe(true);
    expect(userDocSchema.safeParse({ ...user, legal: { ...user.legal, art9: { ...art9, textSha256: 'x' } } }).success).toBe(false);
    expect(userDocSchema.safeParse({ ...user, aboutMe: 'x'.repeat(ABOUT_ME_MAX + 1) }).success).toBe(false);
  });

  it('shows attendance only for current members (D5)', () => {
    const pod = {
      state: 'scheduled', weekId: '2026-W46', areaLabel: 'Aarhus C', theme: { kind: 'openToAnyone' }, memberUids: ['u1', 'u2'],
      roster: { u1: { firstName: 'Anne', photoV: null }, u2: { firstName: 'Bo', photoV: null } }, podInterests: { da: [], en: [] },
      planning: { deadline: ts }, confirmedAt: ts,
    };
    expect(podDocSchema.safeParse({ ...pod, attendance: { u1: 'coming', u2: 'unconfirmed' } }).success).toBe(true);
    expect(podDocSchema.safeParse({ ...pod, attendance: { u3: 'coming' } }).success).toBe(false);
    expect(podDocSchema.safeParse({ ...pod, attendance: { u1: 'maybe' } }).success).toBe(false);
  });

  it('keeps meet-again pair signals keyed by the sorted pair (D9)', () => {
    const doc = { uidHs: ['a'.repeat(20), 'b'.repeat(20)], answers: { ['a'.repeat(20)]: true }, meetWeek: '2026-W46', updatedAt: ts };
    expect(pairSignalDocSchema.safeParse(doc).success).toBe(true);
    expect(pairSignalDocSchema.safeParse({ ...doc, uidHs: ['b'.repeat(20), 'a'.repeat(20)] }).success).toBe(false);
    expect(pairSignalDocSchema.safeParse({ ...doc, answers: { ['c'.repeat(20)]: false } }).success).toBe(false);
  });
});
