import { matchSnapshotSchema, type MatchResultFile, type MatchSnapshot } from '../schemas/matching';
import type { ConsentRef, NonSensitiveConceptId } from '../types/ids';
import type { ConceptProjection, MatchInput, MatchResult, MatchTheme, MatchUser } from '../types/matching';
import { base64Decode, base64Encode } from '../util/base64';
import { getMatchingProfile } from './profiles';

const C128_DIM = 128;

/** 128 float32 values, little-endian, as base64 (the snapshot's `c128`). */
export function encodeC128(v: Float32Array): string {
  if (v.length !== C128_DIM) throw new Error('c128 must have 128 dimensions');
  const bytes = new Uint8Array(C128_DIM * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < C128_DIM; i++) view.setFloat32(i * 4, v[i]!, true);
  return base64Encode(bytes);
}

export function decodeC128(text: string): Float32Array {
  const bytes = base64Decode(text);
  if (bytes.length !== C128_DIM * 4) throw new Error('c128 must be 512 bytes');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(C128_DIM);
  for (let i = 0; i < C128_DIM; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

export interface DecodedSnapshot {
  readonly input: MatchInput;
  readonly componentId: string;
  /** Sensitive themes without a consent reference, dropped at decode (S3). */
  readonly droppedNoConsent: number;
}

/** Validates a drop input snapshot and turns it into matcher input; the seed is the weekId (§6.5). */
export function decodeMatchSnapshot(json: unknown): DecodedSnapshot {
  const snap = matchSnapshotSchema.parse(json);
  let droppedNoConsent = 0;
  const users: MatchUser[] = snap.users.map((u) => {
    const themes: MatchTheme[] = [];
    for (const t of u.themes) {
      if (!t.sens) themes.push({ c: t.c, starred: t.starred, sens: false });
      else if (t.consentRef) themes.push({ c: t.c, starred: t.starred, sens: true, consentRef: t.consentRef as ConsentRef });
      else droppedNoConsent++;
    }
    return { ...u, themes, secondary: u.secondary as NonSensitiveConceptId[] };
  });
  const concepts: ConceptProjection[] = snap.concepts.map((c) => ({ ...c, c128: decodeC128(c.c128) }));
  return {
    input: { weekId: snap.weekId, dropAt: snap.dropAt, users, concepts, params: getMatchingProfile(snap.profile).params, seed: snap.weekId },
    componentId: snap.componentId,
    droppedNoConsent,
  };
}

export function encodeMatchSnapshot(
  meta: Pick<MatchSnapshot, 'weekId' | 'componentId' | 'profile' | 'dropAt'>,
  users: readonly MatchUser[],
  concepts: readonly ConceptProjection[],
): MatchSnapshot {
  return {
    v: 1,
    ...meta,
    users: users.map((u) => ({
      ...u,
      themes: u.themes.map((t) => (t.sens ? { c: t.c, starred: t.starred, sens: true, consentRef: t.consentRef } : { c: t.c, starred: t.starred, sens: false })),
      languages: [...u.languages],
      secondary: [...u.secondary],
      blockedH: [...u.blockedH],
      recentH: { ...u.recentH },
      sensitiveProposals: [...u.sensitiveProposals],
    })),
    concepts: concepts.map((c) => ({ id: c.id, c128: encodeC128(c.c128), sensitive: c.sensitive, status: c.status, mergedInto: c.mergedInto })),
  };
}

export function matchResultFile(result: MatchResult, meta: { weekId: MatchResultFile['weekId']; componentId: string; inputHash: string }): MatchResultFile {
  return {
    v: 1,
    ...meta,
    pods: result.pods.map((p) => ({
      members: [...p.members],
      theme: p.theme,
      value: p.value,
      reasons: Object.fromEntries(
        Object.entries(p.reasons).map(([uid, r]) => [uid, { alsoShare: [...r.alsoShare], nearKm: r.nearKm, ageSpan: r.ageSpan, priorityWeeks: r.priorityWeeks }]),
      ),
    })),
    unmatched: result.unmatched.map((u) => ({ uid: u.uid, reason: u.reason })),
    stats: { ...result.stats },
  };
}
