/**
 * Typed paths and converters for the documents of DESIGN.md §8. Converters validate with the core schemas in
 * both directions, so a malformed document fails the read (fail closed) and a malformed write never lands.
 * `set()`/`create()` through a converter write the whole parsed document, and parsing drops fields the core
 * schema does not declare: the schema is the complete contract. Partial writes use `update()`, which
 * converters do not see.
 */
import {
  areaDocSchema,
  banDocSchema,
  blockDocSchema,
  conceptDocSchema,
  conceptLinkDocSchema,
  configAppDocSchema,
  consentEventDocSchema,
  dropComponentDocSchema,
  erasureLedgerDocSchema,
  exportDocSchema,
  interestDocSchema,
  matchProfileDocSchema,
  noticeDocSchema,
  optionDocSchema,
  pairSignalDocSchema,
  photoGrantDocSchema,
  podCardDocSchema,
  podDocSchema,
  podFeedbackDocSchema,
  podMessageDocSchema,
  podStateDocSchema,
  pushTokensDocSchema,
  rateLimitDocSchema,
  reportDocSchema,
  sanctionDocSchema,
  sensitiveInterestDocSchema,
  tagDocSchema,
  underageMarkerDocSchema,
  userBlockDocSchema,
  userDocSchema,
  type WeekId,
} from '@grouper/core';
import {
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

interface Parser<T> {
  parse(data: unknown): T;
}

export function converter<T extends DocumentData>(schema: Parser<T>): FirestoreDataConverter<T, DocumentData> {
  return {
    toFirestore: (model) => schema.parse(model),
    fromFirestore: (snapshot: QueryDocumentSnapshot) => schema.parse(snapshot.data()),
  };
}

/** A single path segment: no slashes, not `.`/`..`, not a reserved `__name__` id. */
export function seg(id: string): string {
  if (id.length === 0 || id.length > 1500 || id.includes('/') || id === '.' || id === '..' || /^__.*__$/.test(id)) {
    throw new Error('invalid document id');
  }
  return id;
}

export const PATHS = {
  user: (uid: string) => `users/${seg(uid)}`,
  interest: (uid: string, interestId: string) => `users/${seg(uid)}/interests/${seg(interestId)}`,
  sensitiveInterest: (uid: string, interestId: string) => `users/${seg(uid)}/sensitiveInterests/${seg(interestId)}`,
  podCard: (uid: string, podId: string) => `users/${seg(uid)}/pods/${seg(podId)}`,
  userBlock: (uid: string, blockedUid: string) => `users/${seg(uid)}/blocks/${seg(blockedUid)}`,
  notice: (uid: string, noticeId: string) => `users/${seg(uid)}/notices/${seg(noticeId)}`,
  export: (uid: string, exportId: string) => `users/${seg(uid)}/exports/${seg(exportId)}`,
  pod: (podId: string) => `pods/${seg(podId)}`,
  option: (podId: string, optionId: string) => `pods/${seg(podId)}/options/${seg(optionId)}`,
  podMessage: (podId: string, messageId: string) => `pods/${seg(podId)}/messages/${seg(messageId)}`,
  area: (areaId: string) => `areas/${seg(areaId)}`,
  configApp: () => 'config/app',
  matchProfile: (uid: string) => `matchProfiles/${seg(uid)}`,
  tag: (tagKey: string) => `tags/${seg(tagKey)}`,
  concept: (conceptId: string) => `concepts/${seg(conceptId)}`,
  conceptLink: (a: string, b: string) => `conceptLinks/${seg(a)}__${seg(b)}`,
  podState: (podId: string) => `podState/${seg(podId)}`,
  podFeedback: (podId: string, uid: string) => `podFeedback/${seg(podId)}_${seg(uid)}`,
  dropComponent: (weekId: WeekId, componentId: string) => `drops/${seg(weekId)}/components/${seg(componentId)}`,
  block: (a: string, b: string) => `blocks/${seg(a)}_${seg(b)}`,
  report: (reportId: string) => `reports/${seg(reportId)}`,
  sanction: (uid: string) => `sanctions/${seg(uid)}`,
  ban: (emailH: string) => `bans/${seg(emailH)}`,
  /** `pairKey(hmac, a, b)` (D9): server-only meet-again answers of two members about each other. */
  pairSignal: (pairKey: string) => `pairSignals/${seg(pairKey)}`,
  photoGrant: (owner: string, viewer: string) => `photoGrants/${seg(owner)}_${seg(viewer)}`,
  pushTokens: (uid: string) => `pushTokens/${seg(uid)}`,
  rateLimit: (key: string) => `rateLimits/${seg(key)}`,
  underageMarker: (emailH: string) => `underageMarkers/${seg(emailH)}`,
} as const;

export const COLLECTIONS = {
  consentEvents: 'consentEvents',
  erasureLedger: 'erasureLedger',
  reports: 'reports',
  pairSignals: 'pairSignals',
} as const;

const CONVERTERS = {
  user: converter(userDocSchema),
  interest: converter(interestDocSchema),
  sensitiveInterest: converter(sensitiveInterestDocSchema),
  podCard: converter(podCardDocSchema),
  userBlock: converter(userBlockDocSchema),
  notice: converter(noticeDocSchema),
  export: converter(exportDocSchema),
  pod: converter(podDocSchema),
  option: converter(optionDocSchema),
  podMessage: converter(podMessageDocSchema),
  area: converter(areaDocSchema),
  configApp: converter(configAppDocSchema),
  matchProfile: converter(matchProfileDocSchema),
  tag: converter(tagDocSchema),
  concept: converter(conceptDocSchema),
  conceptLink: converter(conceptLinkDocSchema),
  podState: converter(podStateDocSchema),
  podFeedback: converter(podFeedbackDocSchema),
  dropComponent: converter(dropComponentDocSchema),
  block: converter(blockDocSchema),
  report: converter(reportDocSchema),
  sanction: converter(sanctionDocSchema),
  ban: converter(banDocSchema),
  pairSignal: converter(pairSignalDocSchema),
  photoGrant: converter(photoGrantDocSchema),
  pushTokens: converter(pushTokensDocSchema),
  rateLimit: converter(rateLimitDocSchema),
  underageMarker: converter(underageMarkerDocSchema),
  consentEvent: converter(consentEventDocSchema),
  erasureLedger: converter(erasureLedgerDocSchema),
} as const;

type Converted<K extends keyof typeof CONVERTERS> = (typeof CONVERTERS)[K] extends FirestoreDataConverter<infer T, DocumentData> ? T : never;
/** The validated model of a document kind, e.g. `DocOf<'consentEvent'>`. */
export type DocOf<K extends keyof typeof CONVERTERS> = Converted<K>;
type DocRefs = {
  readonly [K in keyof typeof PATHS]: (...ids: Parameters<(typeof PATHS)[K]>) => DocumentReference<Converted<K>, DocumentData>;
};

const refsByDb = new WeakMap<Firestore, DocRefs>();

/** Typed document references: `docs(db).user(uid)` is a `DocumentReference<UserDoc>`. */
export function docs(db: Firestore): DocRefs {
  let refs = refsByDb.get(db);
  if (!refs) {
    const out: Record<string, (...ids: string[]) => DocumentReference> = {};
    for (const [key, path] of Object.entries(PATHS)) {
      const conv = CONVERTERS[key as keyof typeof PATHS] as FirestoreDataConverter<DocumentData, DocumentData>;
      out[key] = (...ids: string[]) => db.doc((path as (...a: string[]) => string)(...ids)).withConverter(conv);
    }
    refs = out as unknown as DocRefs;
    refsByDb.set(db, refs);
  }
  return refs;
}

export function consentEvents(db: Firestore): CollectionReference<Converted<'consentEvent'>, DocumentData> {
  return db.collection(COLLECTIONS.consentEvents).withConverter(CONVERTERS.consentEvent);
}

/** `pods/{podId}/messages` (meetup chat), for auto ids. */
export function podMessages(db: Firestore, podId: string): CollectionReference<Converted<'podMessage'>, DocumentData> {
  return db.collection(`${PATHS.pod(podId)}/messages`).withConverter(CONVERTERS.podMessage);
}

export function erasureLedger(db: Firestore): CollectionReference<Converted<'erasureLedger'>, DocumentData> {
  return db.collection(COLLECTIONS.erasureLedger).withConverter(CONVERTERS.erasureLedger);
}

export const DAY_MS = 86_400_000;
/** erasureLedger retention: longer than the 7-day PITR and backup windows (§8.2). */
export const ERASURE_LEDGER_TTL_MS = 35 * DAY_MS;
/** consentEvents retention after a withdrawal or deletion: 3 years (§8.2, PRIVACY.md §3.4). */
export const CONSENT_EVENT_RETENTION_MS = 3 * 365 * DAY_MS;
export const UNDERAGE_MARKER_TTL_MS = 30 * DAY_MS;

export const ts = (ms: number): Timestamp => Timestamp.fromMillis(ms);
