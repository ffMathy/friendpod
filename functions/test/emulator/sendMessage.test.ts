import { randomBytes } from 'node:crypto';
import { CHAT_DELETE_AFTER_MS, CHAT_PUSH_THROTTLE_MS, CHAT_RATE_LIMIT_PER_HOUR, getLaunchArea, googleMapsPlaceUrl, type PodDoc } from '@friendpod/core';
import { expect, it } from 'vitest';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { CHAT_BUCKET, CHAT_PUSH_BUCKET, sendMessage } from '../../src/callables/sendMessage';
import { PATHS, docs, podMessages, ts } from '../../src/lib/firestore';
import { rateLimitKey } from '../../src/lib/rateLimits';
import { capturedEntries, forbidInLogs } from '../helpers/logCapture';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid, type TestDeps } from '../helpers/emulator';

const NOW = Date.UTC(2026, 10, 6, 10, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** The chat opened 2 h before NOW. */
const MEETUP = NOW + 22 * HOUR;
const OPENS = MEETUP - DAY;
const CLOSES = MEETUP + DAY;

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
const newPodId = (): string => [...randomBytes(20)].map((b) => BASE32[b % 32]).join('');

describeEmulator('sendMessage (emulator)', () => {
  const deps = emulatorDeps(NOW);
  const refs = () => docs(deps.db);
  const placeId = 'ChIJdokk1aarhus0001';
  const place = { placeId, name: 'Dokk1', address: 'Hack Kampmanns Plads 2, Aarhus', lat: 56.1532, lng: 10.214, type: 'library' as const, mapUrl: googleMapsPlaceUrl(placeId, 'Dokk1') };

  async function onboarded(firstName: string, locale: 'da' | 'en'): Promise<string> {
    const uid = newUid();
    await deps.auth.createUser({ uid });
    const data = { firstName, dob: '1991-03-03', locale, area: { gh5: getLaunchArea('aarhus')!.cells[0] }, legal: { terms: 't1', privacy: 'p1' } };
    await invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined } });
    await refs().pushTokens(uid).set({ tokens: [{ token: `tok-${uid}`, platform: 'ios', updatedAt: ts(NOW) }] });
    return uid;
  }

  interface Pod {
    readonly podId: string;
    readonly members: readonly [string, string, string];
  }

  async function pod(o: { state?: PodDoc['state']; meetupAt?: number | null; members?: readonly [string, string, string] } = {}): Promise<Pod> {
    const members = o.members ?? ([await onboarded('Ada', 'en'), await onboarded('Bo', 'da'), await onboarded('Cai', 'en')] as const);
    const podId = newPodId();
    const meetupAt = o.meetupAt === undefined ? MEETUP : o.meetupAt;
    await refs()
      .pod(podId)
      .set({
        state: o.state ?? 'scheduled',
        weekId: '2026-W45',
        areaLabel: 'Aarhus C',
        theme: { kind: 'concept', conceptId: `c_${'a'.repeat(20)}`, sensitive: false },
        memberUids: [...members],
        roster: Object.fromEntries(members.map((m, i) => [m, { firstName: ['Ada', 'Bo', 'Cai'][i]!, photoV: null }])),
        podInterests: { da: [], en: [] },
        planning: {
          deadline: ts(NOW - 2 * DAY),
          ...(meetupAt === null ? {} : { meetupAt: ts(meetupAt), winningOptionId: 'opt1', place }),
        },
        confirmedAt: ts(NOW - 5 * DAY),
      });
    return { podId, members };
  }

  const send = (uid: string, data: unknown, at = NOW) => {
    deps.clock.now = at;
    return invoke('sendMessage', sendMessage, deps, data, { uid }).finally(() => {
      deps.clock.now = NOW;
    });
  };
  const messages = async (podId: string) => (await podMessages(deps.db, podId).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const bucket = async (uid: string, podId: string) => (await deps.db.doc(PATHS.rateLimit(rateLimitKey(uid, CHAT_BUCKET, podId))).get()).data();
  const pushedTokens = (from: number) => deps.pushes.slice(from).flatMap((p) => p.recipients.flatMap((r) => r.tokens)).sort();

  it('stores member text messages, with expiresAt = meetupAt + 72 h', async () => {
    const { podId, members } = await pod();
    const [ada] = members;
    const text = 'Running 5 minutes late, sorry!';
    forbidInLogs(text, ...members);

    const first = await send(ada, { podId, text: `  ${text}\n` });
    expect(first).toEqual({ messageId: expect.any(String) });
    const second = await send(ada, { podId, text: 'On my way' }, NOW + 1000);
    const idOf = (out: object): string => (out as { messageId: string }).messageId;

    const stored = await messages(podId);
    expect(stored).toHaveLength(2);
    const byId = new Map(stored.map((m) => [m.id, m]));
    expect(byId.get(idOf(first))).toEqual({
      id: idOf(first),
      authorUid: ada,
      text,
      createdAt: ts(NOW),
      expiresAt: ts(MEETUP + CHAT_DELETE_AFTER_MS),
    });
    expect(byId.get(idOf(second))).toEqual({ id: idOf(second), authorUid: ada, text: 'On my way', createdAt: ts(NOW + 1000), expiresAt: ts(MEETUP + CHAT_DELETE_AFTER_MS) });
    for (const m of stored) expect(m.expiresAt.toMillis()).toBe(MEETUP + 72 * HOUR);
    expect(await bucket(ada, podId)).toEqual({ count: 2, windowStart: ts(NOW), expiresAt: ts(NOW + DAY) });
  });

  it('accepts text only: a quick reply is not a message any more (D14)', async () => {
    const { podId, members } = await pod();
    expect(await errorCode(send(members[0], { podId, quickReply: 'onMyWay' }))).toBe('VALIDATION');
    expect(await errorCode(send(members[0], { podId, text: 'Hi', quickReply: 'onMyWay' }))).toBe('VALIDATION');
    expect(await errorCode(send(members[0], { podId }))).toBe('VALIDATION');
    expect(await messages(podId)).toEqual([]);
  });

  it('refuses non-members and unknown pods with NOT_MEMBER, storing nothing', async () => {
    const { podId } = await pod();
    const outsider = await onboarded('Eve', 'en');
    expect(await errorCode(send(outsider, { podId, text: "I'm here" }))).toBe('NOT_MEMBER');
    expect(await errorCode(send(outsider, { podId: newPodId(), text: "I'm here" }))).toBe('NOT_MEMBER');
    expect(await messages(podId)).toEqual([]);
    expect(await bucket(outsider, podId)).toBeUndefined();
  });

  it('is open from meetupAt − 24 h until meetupAt + 24 h (exclusive), and closed outside', async () => {
    const { podId, members } = await pod();
    const [ada] = members;
    expect(await errorCode(send(ada, { podId, text: 'On my way' }, OPENS - 1))).toBe('CHAT_CLOSED');
    await expect(send(ada, { podId, text: 'On my way' }, OPENS)).resolves.toHaveProperty('messageId');
    await expect(send(ada, { podId, text: "I'm here" }, CLOSES - 1)).resolves.toHaveProperty('messageId');
    expect(await errorCode(send(ada, { podId, text: "I'm here" }, CLOSES))).toBe('CHAT_CLOSED');
    expect(await errorCode(send(ada, { podId, text: "I'm here" }, CLOSES + DAY))).toBe('CHAT_CLOSED');
    expect(await messages(podId)).toHaveLength(2);
  });

  it('is closed without a meetupAt and outside scheduled/happened', async () => {
    const planning = await pod({ state: 'planning', meetupAt: null });
    expect(await errorCode(send(planning.members[0], { podId: planning.podId, text: 'On my way' }))).toBe('CHAT_CLOSED');
    const noMeetup = await pod({ state: 'scheduled', meetupAt: null, members: planning.members });
    expect(await errorCode(send(noMeetup.members[0], { podId: noMeetup.podId, text: 'On my way' }))).toBe('CHAT_CLOSED');
    // A stale meetupAt after a return to planning or an archive must not keep the chat open.
    for (const state of ['planning', 'archived', 'dissolved'] as const) {
      const p = await pod({ state, members: planning.members });
      expect(await errorCode(send(p.members[1], { podId: p.podId, text: 'On my way' })), state).toBe('CHAT_CLOSED');
    }
    const happened = await pod({ state: 'happened', members: planning.members });
    await expect(send(happened.members[1], { podId: happened.podId, text: "I'm here" }, MEETUP + 3 * HOUR)).resolves.toHaveProperty('messageId');
  });

  it('holds contact details back before the meetup until the sender acknowledges the warning', async () => {
    const { podId, members } = await pod();
    const [ada] = members;
    const text = 'Ring til mig på 20 30 40 50 hvis I ikke kan finde mig';
    forbidInLogs(text, '20 30 40 50', ...members);

    await expect(send(ada, { podId, text })).resolves.toEqual({ warnings: ['CONTACT_INFO_BEFORE_MEETUP'] });
    await expect(send(ada, { podId, text, ackContactWarning: false })).resolves.toEqual({ warnings: ['CONTACT_INFO_BEFORE_MEETUP'] });
    expect(await messages(podId)).toEqual([]);
    expect(await bucket(ada, podId)).toBeUndefined();
    expect(deps.pushes.flatMap((p) => p.recipients.flatMap((r) => r.tokens))).not.toContain(`tok-${members[1]}`);

    const sent = await send(ada, { podId, text, ackContactWarning: true });
    expect(sent).toEqual({ messageId: expect.any(String) });
    expect(await messages(podId)).toEqual([expect.objectContaining({ text })]);

    const mapLink = 'Vi mødes her: https://maps.app.goo.gl/Xy12AbCd';
    await expect(send(ada, { podId, text: mapLink })).resolves.toHaveProperty('messageId');
    await expect(send(ada, { podId, text: 'Bordet er booket 18.30-21.00' })).resolves.toHaveProperty('messageId');
  });

  it('stores contact details after the meetup without a warning', async () => {
    const { podId, members } = await pod({ state: 'happened' });
    const text = 'Det var hyggeligt! Skriv til anna@example.dk eller @anna_k';
    forbidInLogs(text, 'anna@example.dk', ...members);
    await expect(send(members[0], { podId, text }, MEETUP + 2 * HOUR)).resolves.toEqual({ messageId: expect.any(String) });
    await expect(send(members[0], { podId, text: 'Til lykke 🎉', ackContactWarning: true }, MEETUP + 2 * HOUR)).resolves.toHaveProperty('messageId');
    expect(await messages(podId)).toHaveLength(2);
  });

  it('always refuses CPR-like numbers and blocklisted text, storing and charging nothing', async () => {
    const { podId, members } = await pod();
    const [ada] = members;
    const cpr = 'mit cpr er 010190-1234';
    // A phone number first: the CPR number must still be found, not taken for an acknowledgeable contact detail.
    const cprAfterPhone = 'Min tlf er +4520304050. Til lejekontrakten: 010190-1234';
    const blocked = 'Sugar Daddy søges';
    forbidInLogs(cpr, '010190', '4520304050', blocked, 'sugar', ...members);
    for (const at of [NOW, MEETUP + HOUR]) {
      for (const ack of [undefined, true]) {
        expect(await errorCode(send(ada, { podId, text: cpr, ackContactWarning: ack }, at))).toBe('PII_CPR');
        expect(await errorCode(send(ada, { podId, text: cprAfterPhone, ackContactWarning: ack }, at))).toBe('PII_CPR');
        expect(await errorCode(send(ada, { podId, text: blocked, ackContactWarning: ack }, at))).toBe('BLOCKLIST');
      }
    }
    await expect(send(ada, { podId, text: 'x'.repeat(501) }).catch((e: { code: string }) => e.code)).resolves.toBe('invalid-argument');
    expect(await messages(podId)).toEqual([]);
    expect(await bucket(ada, podId)).toBeUndefined();
  });

  it(`refuses message ${CHAT_RATE_LIMIT_PER_HOUR + 1} within an hour, per user and pod`, async () => {
    const first = await pod();
    const [ada, bo] = first.members;
    for (let i = 0; i < CHAT_RATE_LIMIT_PER_HOUR; i++) {
      await expect(send(ada, { podId: first.podId, text: 'Running a bit late' }, NOW + i * 60_000)).resolves.toHaveProperty('messageId');
    }
    const last = NOW + 59 * 60_000;
    expect(await errorCode(send(ada, { podId: first.podId, text: 'Running a bit late' }, last))).toBe('RATE_LIMITED');
    expect(await errorCode(send(ada, { podId: first.podId, text: 'still here' }, last))).toBe('RATE_LIMITED');
    expect(await messages(first.podId)).toHaveLength(CHAT_RATE_LIMIT_PER_HOUR);
    expect((await bucket(ada, first.podId))?.count).toBe(CHAT_RATE_LIMIT_PER_HOUR);

    // Other members and other pods have their own buckets; the window resets after an hour.
    await expect(send(bo, { podId: first.podId, text: "I'm here" }, last)).resolves.toHaveProperty('messageId');
    const second = await pod({ members: first.members });
    await expect(send(ada, { podId: second.podId, text: "I'm here" }, last)).resolves.toHaveProperty('messageId');
    await expect(send(ada, { podId: first.podId, text: "I'm here" }, NOW + HOUR)).resolves.toHaveProperty('messageId');
    expect(await bucket(ada, first.podId)).toEqual({ count: 1, windowStart: ts(NOW + HOUR), expiresAt: ts(NOW + HOUR + DAY) });
  });

  it('pushes generic copy to the other members, at most once per member and pod per 10 minutes', async () => {
    const { podId, members } = await pod();
    const [ada, bo, cai] = members;
    const tok = (uid: string) => `tok-${uid}`;
    const text = 'Jeg står ved indgangen';
    forbidInLogs(text, ...members);
    const slot = async (uid: string) => (await deps.db.doc(PATHS.rateLimit(rateLimitKey(uid, CHAT_PUSH_BUCKET, podId))).get()).data();

    let mark = deps.pushes.length;
    await send(ada, { podId, text });
    expect(deps.pushes.slice(mark).map((p) => p.kind)).toEqual(['chatMessage']);
    expect(deps.pushes.slice(mark)[0]!.recipients).toEqual(expect.arrayContaining([{ locale: 'da', tokens: [tok(bo)] }, { locale: 'en', tokens: [tok(cai)] }]));
    expect(pushedTokens(mark)).toEqual([tok(bo), tok(cai)].sort());
    expect(JSON.stringify(deps.pushes.slice(mark))).not.toContain(text);
    expect(await slot(bo)).toEqual({ count: 1, windowStart: ts(NOW), expiresAt: ts(NOW + DAY) });
    expect(await slot(ada)).toBeUndefined();

    mark = deps.pushes.length;
    await send(ada, { podId, text: 'On my way' }, NOW + 60_000);
    expect(pushedTokens(mark)).toEqual([]);

    await send(bo, { podId, text: "I'm here" }, NOW + 2 * 60_000);
    expect(pushedTokens(mark)).toEqual([tok(ada)]);

    mark = deps.pushes.length;
    await send(ada, { podId, text: "I'm here" }, NOW + CHAT_PUSH_THROTTLE_MS - 1);
    expect(pushedTokens(mark)).toEqual([]);
    await send(ada, { podId, text: "I'm here" }, NOW + CHAT_PUSH_THROTTLE_MS);
    expect(pushedTokens(mark)).toEqual([tok(bo), tok(cai)].sort());
    expect(await slot(cai)).toEqual({ count: 1, windowStart: ts(NOW + CHAT_PUSH_THROTTLE_MS), expiresAt: ts(NOW + CHAT_PUSH_THROTTLE_MS + DAY) });
  });

  it('keeps the message when the push fails, and logs neither text nor uid', async () => {
    const { podId, members } = await pod();
    const text = 'Vi sidder ved vinduet';
    forbidInLogs(text, ...members);
    const failing = Object.assign(Object.create(deps) as TestDeps, {
      push: async () => {
        throw new Error(`FCM rejected ${members[1]}: ${text}`);
      },
    });
    deps.clock.now = NOW;
    await expect(invoke('sendMessage', sendMessage, failing, { podId, text }, { uid: members[0] })).resolves.toHaveProperty('messageId');
    expect(await messages(podId)).toHaveLength(1);
    expect(capturedEntries().find((e) => e.event === 'sendMessage.pushFailed')).toMatchObject({ severity: 'WARNING', errorName: 'Error' });
  });

  it('refuses an account that is being deleted', async () => {
    const { podId, members } = await pod();
    await deps.db.doc(PATHS.user(members[2])).update({ status: 'deleting' });
    expect(await errorCode(send(members[2], { podId, text: "Can't make it" }))).toBe('STATE');
    expect(await messages(podId)).toEqual([]);
  });
});
