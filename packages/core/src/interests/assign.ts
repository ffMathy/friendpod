/**
 * Concept assignment decision table (DESIGN.md §5.2 (6)), as a pure function of the nearest concept
 * found in the holding's own partition. Thresholds are parameters; the defaults are the [EXP] values.
 */
export interface AssignThresholds {
  readonly ordinaryMerge: number;
  readonly ordinaryMedoidGuard: number;
  readonly ordinaryLink: number;
  readonly sensitiveMerge: number;
  readonly sensitiveProposal: number;
  /** "Did you mean …?" only when the concept has at least this many holders. */
  readonly suggestMinHolders: number;
}

export const DEFAULT_ASSIGN_THRESHOLDS: AssignThresholds = {
  ordinaryMerge: 0.86,
  ordinaryMedoidGuard: 0.82,
  ordinaryLink: 0.78,
  sensitiveMerge: 0.9,
  sensitiveProposal: 0.86,
  suggestMinHolders: 10,
};

export type Partition = 'ordinary' | 'sensitive';

export interface NearestConcept {
  readonly conceptId: string;
  readonly sensitive: boolean;
  /** cos(tag, centroid) at 768-d. */
  readonly cosCentroid: number;
  /** cos(tag, frozen medoid) at 768-d. */
  readonly cosMedoid: number;
  /** Ordinary holders (non-sensitive concepts only). */
  readonly holderCount: number;
}

export type AssignDecision =
  | { readonly action: 'merge'; readonly conceptId: string }
  | { readonly action: 'newWithLink'; readonly linkTo: string; readonly suggest: boolean }
  | { readonly action: 'newWithMergeProposal'; readonly proposeMergeInto: string }
  | { readonly action: 'new' };

export class PartitionMismatchError extends Error {
  constructor() {
    super('concept assignment compared across sensitivity partitions');
    this.name = 'PartitionMismatchError';
  }
}

export function decideAssignment(
  partition: Partition,
  nearest: NearestConcept | null,
  t: AssignThresholds = DEFAULT_ASSIGN_THRESHOLDS,
): AssignDecision {
  if (!nearest) return { action: 'new' };
  // The prefilter keeps partitions apart; reaching here across partitions is a bug, so fail closed.
  if (nearest.sensitive !== (partition === 'sensitive')) throw new PartitionMismatchError();
  const cos = nearest.cosCentroid;
  if (partition === 'sensitive') {
    if (cos >= t.sensitiveMerge) return { action: 'merge', conceptId: nearest.conceptId };
    if (cos >= t.sensitiveProposal) return { action: 'newWithMergeProposal', proposeMergeInto: nearest.conceptId };
    return { action: 'new' };
  }
  if (cos >= t.ordinaryMerge && nearest.cosMedoid >= t.ordinaryMedoidGuard) {
    return { action: 'merge', conceptId: nearest.conceptId };
  }
  // A centroid match ≥ 0.86 that fails the medoid guard is not covered by the table; it gets the
  // weaker link-band treatment rather than a merge.
  if (cos >= t.ordinaryLink) {
    return { action: 'newWithLink', linkTo: nearest.conceptId, suggest: nearest.holderCount >= t.suggestMinHolders };
  }
  return { action: 'new' };
}

/** `modelId` part of every cache key, so vectors of different models never mix (§5.1). */
export const EMBEDDING_MODEL_ID = 'eg300m-q4@5090578';
export const EMBEDDING_DIM = 768;

/** Input to `tagKey = sha256(modelId|768|sts|norm)` (§5.2 (3)); hashing happens server-side. */
export function tagKeyMaterial(norm: string, modelId: string = EMBEDDING_MODEL_ID): string {
  return `${modelId}|${EMBEDDING_DIM}|sts|${norm}`;
}

/**
 * Deterministic concept id for a new concept: `c_` + tagKey[0..20], plus `_p` for the private
 * (self-flag) assignment, so two racing creators produce the same id (§5.2 (7)).
 */
export function newConceptId(tagKey: string, privateAssign: boolean): string {
  if (!/^[0-9a-f]{64}$/.test(tagKey)) throw new Error('newConceptId: tagKey must be a sha256 hex digest');
  return `c_${tagKey.slice(0, 20)}${privateAssign ? '_p' : ''}`;
}
