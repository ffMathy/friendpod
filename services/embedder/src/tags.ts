/**
 * The shared, uid-free tag cache (`tags/{tagKey}`, DESIGN.md §5.2 (3), §8.2) as the pipeline sees it.
 *
 * Every tag has two assignment slots:
 * - own: `conceptId` + `refCount`, in the tag's own partition (sensitive if the tag is sensitive or
 *   suspected, else ordinary);
 * - private: `privateAssign {conceptId, refCount}`, the sensitive-partition assignment of an ordinary tag
 *   for holdings that are sensitive only through a self-flag (or a newer lexicon), so they never touch
 *   the ordinary concept's counts or labels (§5.2 (5)).
 * A tag's vector is in a slot concept's `sum` only while that slot's count is above 0 (§5.2 (8)).
 */
import { sha256Hex } from '@grouper/core/node';
import { tagKeyMaterial, type Art9Category, type Partition } from '@grouper/core';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { vectorFromField } from './assign';

export interface TagSens {
  readonly suspected: boolean;
  readonly margin: number | null;
  readonly lexiconHit: boolean;
  readonly categoryGuess: Art9Category | null;
  readonly rulesVersion: string;
  readonly reviewed?: 'sensitive' | 'not';
}

export interface TagState {
  /** False for a text first embedded in this request (not in `tags` yet). */
  readonly exists: boolean;
  /** Tag-prompt vector. */
  readonly vec: Float32Array;
  readonly sens: TagSens;
  /** Own-slot concept while `refCount > 0`, else null. */
  readonly conceptId: string | null;
  /** Private-slot concept while `privateAssign.refCount > 0`, else null. */
  readonly privateConceptId: string | null;
}

/** `tagKey = sha256(modelId|768|sts|norm)` (§5.2 (3)): a different model never reads another model's vector. */
export function tagKeyFor(norm: string, modelId: string): string {
  return sha256Hex(tagKeyMaterial(norm, modelId));
}

/** The partition the tag's own slot lives in, from the flags stored when it was classified. */
export function ownPartition(sens: TagSens): Partition {
  if (sens.reviewed) return sens.reviewed === 'sensitive' ? 'sensitive' : 'ordinary';
  return sens.lexiconHit || sens.suspected ? 'sensitive' : 'ordinary';
}

export function tagStateFromDoc(snap: DocumentSnapshot, dim: number): TagState {
  const d = snap.data();
  if (!d) throw new Error('tagStateFromDoc: missing document');
  const s = d.sens as Record<string, unknown>;
  const sens: TagSens = {
    suspected: s.suspected === true,
    margin: typeof s.margin === 'number' ? s.margin : null,
    lexiconHit: s.lexiconHit === true,
    categoryGuess: (s.categoryGuess as Art9Category | null | undefined) ?? null,
    rulesVersion: String(s.rulesVersion),
    ...(s.reviewed === 'sensitive' || s.reviewed === 'not' ? { reviewed: s.reviewed } : {}),
  };
  const refCount = typeof d.refCount === 'number' ? d.refCount : 0;
  const priv = d.privateAssign as { conceptId?: string; refCount?: number } | undefined;
  return {
    exists: true,
    vec: vectorFromField(d.vec, dim),
    sens,
    conceptId: refCount > 0 && typeof d.conceptId === 'string' ? d.conceptId : null,
    privateConceptId: priv && (priv.refCount ?? 0) > 0 && typeof priv.conceptId === 'string' ? priv.conceptId : null,
  };
}

/** True when a fresh read still matches what a plan was built on (else the plan is stale). */
export function sameTagState(a: TagState, b: TagState): boolean {
  return (
    a.exists === b.exists &&
    a.conceptId === b.conceptId &&
    a.privateConceptId === b.privateConceptId &&
    (!a.exists || ownPartition(a.sens) === ownPartition(b.sens))
  );
}
