/**
 * Callables in the preview: the scenario's handler if it has one, else the default here. Defaults answer with a valid
 * output (the app parses every output with the core schema) and make the obvious change to the fixture documents, so
 * tapping through a screen behaves plausibly. They are not the server: no validation beyond the app's own.
 */
import { weekIdAt, type CallableName } from '@grouper/core';
import { preview, reportIssue } from './state';
import { Timestamp } from './timestamp';
import type { CallableContext, CallableHandlers, DocData } from './types';

const ok = { ok: true as const };
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function randomId(length: number, alphabet = BASE32): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function userPath(ctx: CallableContext): string {
  if (!ctx.uid) throw new Error('preview: signed out');
  return `users/${ctx.uid}`;
}

function patchUser(ctx: CallableContext, patch: (user: DocData) => DocData): void {
  const path = userPath(ctx);
  const user = ctx.store.get(path);
  if (user) ctx.store.set(path, patch(user));
}

const DEFAULTS: CallableHandlers = {
  completeOnboarding: () => {
    const state = preview();
    if (state.auth.user) state.auth.user = { ...state.auth.user, claims: { ...state.auth.user.claims, onb: true } };
    return { areaStatus: 'live' };
  },
  updateProfile: (input, ctx) => {
    patchUser(ctx, (u) => ({
      ...u,
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.aboutMe !== undefined ? { aboutMe: input.aboutMe } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.prefs !== undefined ? { prefs: { ...(u.prefs as object), ...input.prefs } } : {}),
    }));
    return ok;
  },
  setParticipation: (input, ctx) => {
    patchUser(ctx, (u) => ({ ...u, participation: { mode: input.mode === 'manual' ? 'manual' : 'auto' } }));
    return { effectiveWeekId: weekIdAt(ctx.now) };
  },
  removeInterest: ({ interestId }, ctx) => {
    ctx.store.delete(`${userPath(ctx)}/interests/${interestId}`);
    ctx.store.delete(`${userPath(ctx)}/sensitiveInterests/${interestId}`);
    return ok;
  },
  updateInterest: ({ interestId, starred }, ctx) => {
    for (const kind of ['interests', 'sensitiveInterests']) {
      const path = `${userPath(ctx)}/${kind}/${interestId}`;
      if (ctx.store.get(path)) ctx.store.update(path, { starred });
    }
    return ok;
  },
  confirmSuggestion: () => ok,
  setArt9Consent: () => ok,
  withdrawArt9Consent: (_input, ctx) => {
    const rows = ctx.store.list(`${userPath(ctx)}/sensitiveInterests`);
    for (const row of rows) ctx.store.delete(row.path);
    patchUser(ctx, (u) => {
      const { art9: _gone, ...legal } = u.legal as Record<string, unknown>;
      return { ...u, legal };
    });
    return { removed: rows.length };
  },
  respondToPod: ({ podId, accept }, ctx) => {
    const path = `${userPath(ctx)}/pods/${podId}`;
    const card = ctx.store.get(path);
    const acceptedCount = Math.min(6, Number(card?.acceptedCount ?? 0) + (accept ? 1 : 0));
    if (card) ctx.store.update(path, { myStatus: accept ? 'accepted' : 'declined', acceptedCount });
    return { state: 'proposed', acceptedCount };
  },
  setPhotoSharing: ({ podId, share }, ctx) => {
    const path = `${userPath(ctx)}/pods/${podId}`;
    if (ctx.store.get(path)) ctx.store.update(path, { photoShared: share });
    return ok;
  },
  leavePod: () => ok,
  proposeOption: ({ podId, startsAt, place }, ctx) => {
    const optionId = ctx.store.newId('option');
    ctx.store.set(`pods/${podId}/options/${optionId}`, {
      authorUid: ctx.uid,
      startsAt: Timestamp.fromMillis(startsAt),
      place,
      votes: ctx.uid ? { [ctx.uid]: 'yes' } : {},
      createdAt: Timestamp.fromMillis(ctx.now),
    });
    return { optionId };
  },
  voteOption: ({ podId, optionId, vote }, ctx) => {
    const path = `pods/${podId}/options/${optionId}`;
    const option = ctx.store.get(path);
    const votes = { ...((option?.votes as Record<string, string> | undefined) ?? {}) };
    if (ctx.uid) {
      if (vote === null) delete votes[ctx.uid];
      else votes[ctx.uid] = vote;
    }
    if (option) ctx.store.update(path, { votes });
    const values = Object.values(votes);
    return { tally: { yes: values.filter((v) => v === 'yes').length, no: values.filter((v) => v === 'no').length } };
  },
  confirmAttendance: ({ podId, coming }, ctx) => {
    const path = `pods/${podId}`;
    const pod = ctx.store.get(path);
    if (pod && ctx.uid) ctx.store.update(path, { attendance: { ...(pod.attendance as object), [ctx.uid]: coming ? 'coming' : 'notComing' } });
    return ok;
  },
  sendMessage: ({ podId, text }, ctx) => {
    const messageId = ctx.store.newId('message');
    const pod = ctx.store.get(`pods/${podId}`);
    const meetupAt = (pod?.planning as { meetupAt?: Timestamp } | undefined)?.meetupAt?.toMillis() ?? ctx.now;
    ctx.store.set(`pods/${podId}/messages/${messageId}`, {
      authorUid: ctx.uid,
      text,
      createdAt: Timestamp.fromMillis(ctx.now),
      expiresAt: Timestamp.fromMillis(meetupAt + 72 * 3_600_000),
    });
    return { messageId };
  },
  submitFeedback: () => ok,
  blockUser: () => ok,
  unblockUser: ({ uid }, ctx) => {
    ctx.store.delete(`${userPath(ctx)}/blocks/${uid}`);
    return ok;
  },
  report: () => ({ reportId: 'previewReport' }),
  registerPushToken: () => ok,
  appOpened: () => ok,
  deletePhoto: () => ok,
  exportData: () => ({ exportId: 'previewExport' }),
  deleteAccount: () => ok,
  addInterests: ({ items }, ctx) => ({
    results: items.map((item) => {
      const interestId = randomId(16);
      ctx.store.set(`${userPath(ctx)}/interests/${interestId}`, {
        display: item.text.trim(),
        norm: item.text.trim().toLowerCase().slice(0, 40),
        conceptId: `c_${randomId(20, '0123456789abcdef')}`,
        starred: false,
        createdAt: Timestamp.fromMillis(ctx.now),
      });
      return { status: 'added' as const, interestId };
    }),
  }),
};

/** Runs a callable for the functions fake; a missing handler is a `functions/unimplemented` error, as on a server. */
export async function runCallable(name: string, data: unknown): Promise<unknown> {
  const state = preview();
  const handlers = state.scenario.callables as Record<string, ((input: unknown, ctx: CallableContext) => unknown) | undefined> | undefined;
  const handler = handlers?.[name] ?? (DEFAULTS as Record<string, ((input: unknown, ctx: CallableContext) => unknown) | undefined>)[name as CallableName];
  if (!handler) {
    reportIssue({ kind: 'callable', message: `no handler for callable ${name}` });
    throw Object.assign(new Error(`preview: callable ${name} is not stubbed`), { code: 'functions/unimplemented' });
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  return handler(data, { store: state.store, uid: state.auth.user?.uid ?? null, now: Date.now() });
}

/** For scenario handlers that should fail like the server: `throw callableError('failed-precondition', 'POD_FULL')`. */
export function callableError(canonical: string, appCode?: string): Error {
  return Object.assign(new Error(appCode ?? canonical), { code: `functions/${canonical}`, details: appCode ? { code: appCode } : undefined });
}
