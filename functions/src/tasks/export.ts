/**
 * buildExport and deleteExport (DESIGN.md §3.9, §10.3; PRIVACY.md §6 "Export contents"). The JSON holds the user's own
 * data and what Grouper derived from it, never other people's: co-members appear only as per-pod labels ("member-1"),
 * never with names, interests, messages or their private answers, and reports about the user never name the reporter
 * or carry the report text. The file is owner-readable under the Storage rules (authenticated download, no public URL),
 * available for 24 h, then deleted by deleteExport (the lifecycle rule and TTL are backstops).
 */
import { EMBEDDING_MODEL, NOTICE_CODES } from '@grouper/core';
import { COLLECTIONS, DAY_MS, PATHS, consentEvents, docs, podStates, ts } from '../lib/firestore';
import { writeNotice } from '../lib/notices';
import { OBJECT_PATHS } from '../lib/objects';
import type { AppDeps } from '../lib/runtime';
import { taskId } from '../lib/tasks';
import { pushTo } from '../pods/effects';
import { tagKeyFor } from '../interests/tags';

/** The file is available for 24 h (§3.9). */
export const EXPORT_AVAILABLE_MS = DAY_MS;
export const EXPORT_FORMAT_VERSION = 1;

/** JSON-safe copy: Timestamps as ISO strings; vectors and bytes never leave (they are not the user's own input). */
export function plain(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value !== 'object') return value;
  const v = value as { toMillis?: () => number; toUint8Array?: unknown; toArray?: unknown };
  if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
  if (value instanceof Uint8Array || typeof v.toUint8Array === 'function' || typeof v.toArray === 'function') return undefined;
  if (Array.isArray(value)) return value.map(plain);
  return Object.fromEntries(Object.entries(value).flatMap(([k, x]) => {
    const p = plain(x);
    return p === undefined ? [] : [[k, p]];
  }));
}

export async function assembleExport(deps: Pick<AppDeps, 'db'>, uid: string): Promise<Record<string, unknown>> {
  const db = deps.db;
  const refs = docs(db);
  const [user, profile, ordinary, sensitive, blocks, notices, events, sanction, filed, about, states] = await Promise.all([
    refs.user(uid).get(),
    refs.matchProfile(uid).get(),
    db.collection(`${PATHS.user(uid)}/interests`).get(),
    db.collection(`${PATHS.user(uid)}/sensitiveInterests`).get(),
    db.collection(`${PATHS.user(uid)}/blocks`).get(),
    db.collection(`${PATHS.user(uid)}/notices`).get(),
    consentEvents(db).where('uid', '==', uid).get(),
    refs.sanction(uid).get(),
    db.collection(COLLECTIONS.reports).where('reporterUid', '==', uid).get(),
    db.collection(COLLECTIONS.reports).where('targetUid', '==', uid).get(),
    podStates(db).where('memberList', 'array-contains', uid).get(),
  ]);
  const u = user.data();
  const p = profile.data();

  // How each interest was classified (lexicon, detector margin, known-ordinary list, the user's own choices).
  const holdings = [
    ...ordinary.docs.map((d) => ({ id: d.id, partition: 'ordinary' as const, doc: d.data() as Record<string, unknown> })),
    ...sensitive.docs.map((d) => ({ id: d.id, partition: 'sensitive' as const, doc: d.data() as Record<string, unknown> })),
  ];
  const tagSnaps = holdings.length > 0 ? await db.getAll(...holdings.map((h) => db.doc(`tags/${tagKeyFor(String(h.doc.norm), EMBEDDING_MODEL.modelKey)}`)), { fieldMask: ['sens'] }) : [];
  const interests = holdings.map((h, i) => {
    const sens = tagSnaps[i]?.get('sens') as Record<string, unknown> | undefined;
    return {
      interestId: h.id,
      wording: h.doc.display,
      stored: h.partition === 'sensitive' ? 'sensitive' : h.doc.state === 'pendingConsent' ? 'pendingConsent' : 'ordinary',
      starred: h.doc.starred === true,
      createdAt: plain(h.doc.createdAt ?? h.doc.consentedAt),
      classification: {
        lexiconHit: sens?.lexiconHit ?? null,
        detectorMargin: sens?.margin ?? null,
        knownOrdinary: sens?.knownOrdinary ?? null,
        keepThisPrivate: h.doc.selfFlagged === true,
        notSensitiveForMe: h.doc.notSensitiveForMe === true,
        source: h.doc.source ?? null,
      },
    };
  });

  const pods = [];
  const messages = [];
  for (const s of states.docs) {
    const ps = s.data();
    const me = ps.members[uid];
    if (!me) continue;
    const [pod, card, feedback, options, mine] = await Promise.all([
      refs.pod(s.id).get(),
      refs.podCard(uid, s.id).get(),
      refs.podFeedback(s.id, uid).get(),
      db.collection(`${PATHS.pod(s.id)}/options`).get(),
      db.collection(`${PATHS.pod(s.id)}/messages`).where('authorUid', '==', uid).get(),
    ]);
    const others = ps.memberList.filter((x) => x !== uid);
    const label = (x: string) => `member-${others.indexOf(x) + 1}`;
    const relabel = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [others.includes(k) ? label(k) : k, v]));
    const podDoc = pod.data();
    const fb = feedback.data();
    pods.push({
      podId: s.id,
      weekId: ps.weekId,
      state: ps.state,
      theme: card.data()?.themeLabel ?? null,
      myStatus: me.status,
      reasons: plain(me.reasons),
      invitedAt: plain(me.invitedAt),
      respondedAt: plain(me.respondedAt),
      members: podDoc ? podDoc.memberUids.length : Object.values(ps.members).filter((m) => m.status === 'accepted').length,
      confirmedAt: plain(podDoc?.confirmedAt),
      meetupAt: plain(podDoc?.planning.meetupAt ?? ps.timers.meetupAt),
      myAttendance: me.attendance ?? null,
      optionsIWrote: options.docs.filter((o) => o.get('authorUid') === uid).map((o) => plain({ optionId: o.id, startsAt: o.get('startsAt'), place: o.get('place'), createdAt: o.get('createdAt') })),
      myVotes: options.docs.filter((o) => (o.get('votes') as Record<string, string> | undefined)?.[uid] !== undefined).map((o) => ({ optionId: o.id, vote: (o.get('votes') as Record<string, string>)[uid] })),
      myFeedback: fb ? { met: fb.met, whoWasThere: relabel(fb.attendance), meetAgain: relabel(fb.meetAgain), rating: fb.rating ?? null, keep: fb.keep } : null,
    });
    for (const m of mine.docs) messages.push({ podId: s.id, text: m.get('text'), createdAt: plain(m.get('createdAt')) });
  }

  return {
    format: EXPORT_FORMAT_VERSION,
    profile: u
      ? plain({
          firstName: u.firstName,
          locale: u.locale,
          birthYear: u.birthYear,
          area: u.area,
          prefs: u.prefs,
          gender: u.gender,
          aboutMe: u.aboutMe ?? null,
          participation: u.participation,
          photo: u.photo,
          status: u.status,
          stats: u.stats,
          lastDrop: u.lastDrop,
          legal: u.legal,
          createdAt: u.createdAt,
          lastActiveAt: u.lastActiveAt,
        })
      : null,
    interests,
    blanketConsent: plain(u?.legal.art9 ?? null),
    consentLog: events.docs.map((e) => plain({ scope: e.get('scope'), action: e.get('action'), textVersion: e.get('textVersion'), locale: e.get('locale'), appVersion: e.get('appVersion'), createdAt: e.get('createdAt') })),
    pods,
    meetupChatMessages: messages,
    matching: p
      ? plain({
          reliability: p.reliability,
          noShowEvents: p.noShowEvents,
          declinesInRow: p.declinesInRow,
          ignoredInRow: p.ignoredInRow,
          waitingSinceWeek: p.waitingSinceWeek,
          activePods: p.activePods,
          activeSensitivePods: p.activeSensitivePods,
          sensitiveProposalWeeks: p.sensitiveProposals,
          sensitiveHold: p.sensitiveHold,
          openReportsAboutMe: p.openReportCount,
          lastDrop: p.lastDrop,
          pairHistoryEntries: Object.keys(p.recentH).length,
          milestones: p.milestones,
        })
      : null,
    blocks: blocks.docs.map((b) => plain({ firstName: b.get('firstName'), podId: b.get('podId'), since: b.get('since') })),
    reportsIFiled: filed.docs.map((r) => plain({ category: r.get('category'), text: r.get('text') ?? null, targetType: r.get('target.type'), podId: r.get('podId'), status: r.get('status'), decision: r.get('decision') ?? null, createdAt: r.get('createdAt') })),
    // The reporter and the report text are withheld (Art. 15(4)); a reported message of the user's is their own text.
    reportsAboutMe: about.docs.map((r) => plain({ category: r.get('category'), status: r.get('status'), decision: r.get('decision') ?? null, createdAt: r.get('createdAt'), ...(r.get('message.text') ? { myMessage: r.get('message.text') } : {}) })),
    sanctions: sanction.exists ? [plain({ type: sanction.get('type'), until: sanction.get('until'), reasonCode: sanction.get('reasonCode') })] : [],
    notices: notices.docs.map((n) => plain({ type: n.get('type'), code: n.get('code'), params: n.get('params'), createdAt: n.get('createdAt') })),
  };
}

export async function buildExport(deps: AppDeps, uid: string, exportId: string): Promise<'built' | 'gone' | 'alreadyBuilt'> {
  const refs = docs(deps.db);
  const ref = refs.export(uid, exportId);
  const doc = (await ref.get()).data();
  const user = (await refs.user(uid).get()).data();
  if (!doc || !user || user.status === 'deleting') return 'gone';
  const now = deps.now();
  if (doc.status !== 'ready') {
    const body = JSON.stringify({ exportedAt: new Date(now).toISOString(), ...(await assembleExport(deps, uid)) }, null, 2);
    const path = OBJECT_PATHS.export(uid, exportId);
    await deps.objects.write(path, new TextEncoder().encode(body), { contentType: 'application/json', cacheControl: 'private, no-store' });
    await deps.db.runTransaction(async (tx) => {
      tx.set(ref, { status: 'ready', path, expiresAt: ts(now + EXPORT_AVAILABLE_MS) });
      writeNotice(deps.db, tx, uid, 'system', NOTICE_CODES.EXPORT_READY, { exportId }, now);
    });
    await pushTo(deps, 'notice', [uid]);
  }
  await deps.tasks.enqueue('deleteExport', { uid, exportId }, { id: taskId('export-delete', exportId), scheduleTime: now + EXPORT_AVAILABLE_MS });
  return doc.status === 'ready' ? 'alreadyBuilt' : 'built';
}

export async function deleteExport(deps: AppDeps, uid: string, exportId: string): Promise<void> {
  await deps.objects.delete(OBJECT_PATHS.export(uid, exportId));
  await docs(deps.db).export(uid, exportId).delete();
}
