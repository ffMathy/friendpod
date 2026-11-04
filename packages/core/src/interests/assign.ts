/**
 * Concept assignment decision table (DESIGN.md §5.2 (6)), as a pure function of the nearest concept
 * found in the holding's own partition. Thresholds are parameters; the defaults are the v2 [CAL] values.
 */
import type { HmacSha256 } from '../ids/hmac';
import { utf8Encode } from '../util/utf8';

export interface AssignThresholds {
  readonly ordinaryMerge: number;
  readonly ordinaryMedoidGuard: number;
  readonly ordinaryLink: number;
  readonly sensitiveMerge: number;
  readonly sensitiveProposal: number;
  /** "Did you mean …?" only when the concept has at least this many holders. */
  readonly suggestMinHolders: number;
}

/** EmbeddingGemma 2 q4 / 768-d [CAL]. Sensitive values are [A]: v1's margin mapped onto v2's band. */
export const DEFAULT_ASSIGN_THRESHOLDS: AssignThresholds = {
  ordinaryMerge: 0.93,
  ordinaryMedoidGuard: 0.91,
  ordinaryLink: 0.9,
  sensitiveMerge: 0.95,
  sensitiveProposal: 0.93,
  suggestMinHolders: 10,
};

/** The calibrated v1 fallback (EmbeddingGemma-300m q4) [EXP]; only valid with V1 vectors. */
export const V1_ASSIGN_THRESHOLDS: AssignThresholds = {
  ordinaryMerge: 0.86,
  ordinaryMedoidGuard: 0.82,
  ordinaryLink: 0.78,
  sensitiveMerge: 0.9,
  sensitiveProposal: 0.86,
  suggestMinHolders: 10,
};

/**
 * v2 scores sit in a narrow band and online clustering collapses at low thresholds [CAL]: never below
 * 0.90 anywhere, never merge below 0.925. Call when loading thresholds from configuration.
 */
export function assertV2ThresholdFloors(t: AssignThresholds): void {
  const values = [t.ordinaryMerge, t.ordinaryMedoidGuard, t.ordinaryLink, t.sensitiveMerge, t.sensitiveProposal];
  if (values.some((v) => !(v >= 0.9)) || t.ordinaryMerge < 0.925 || t.sensitiveMerge < t.ordinaryMerge) {
    throw new Error('assignment thresholds below the EmbeddingGemma 2 floors (DESIGN.md §5.2 (6))');
  }
}

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
  // A centroid match at or above the merge threshold that fails the medoid guard is not covered by the
  // table; it gets the weaker link-band treatment rather than a merge.
  if (cos >= t.ordinaryLink) {
    return { action: 'newWithLink', linkTo: nearest.conceptId, suggest: nearest.holderCount >= t.suggestMinHolders };
  }
  return { action: 'new' };
}

/** `modelId` part of every cache key, so vectors of different models never mix (§5.1): EmbeddingGemma 2 q4. */
export const EMBEDDING_MODEL_ID = 'eg2-q4@daa72c5';
/** The calibrated fallback, EmbeddingGemma-300m q4 (§5.1). */
export const EMBEDDING_MODEL_ID_V1 = 'eg300m-q4@5090578';
export const EMBEDDING_DIM = 768;

/** Input to `tagKey = sha256(modelId|768|sts|norm)` (§5.2 (3)); hashing happens server-side. */
export function tagKeyMaterial(norm: string, modelId: string = EMBEDDING_MODEL_ID): string {
  return `${modelId}|${EMBEDDING_DIM}|sts|${norm}`;
}

const CONCEPT_ID_HEX = 20;

/**
 * Deterministic concept id for a new concept, so two racing creators produce the same id (§5.2 (7)):
 * `c_` + hex(HMAC(UID_HMAC_KEY, 'concept|' + tagKey (+ '|p')))[0..20], plus `_p` for the private (self-flag)
 * assignment.
 *
 * DESIGN-DEVIATION: §5.2 (7) uses `c_` + tagKey[0..20]. tagKey is an unkeyed sha256 of the public model id and
 * the text, and members read concept ids (pod themes, chips, their own holdings), so a dictionary would recover
 * the founding wording, including another user's sensitive one (§6.7, PRIVACY.md §4.2). The private flag is part
 * of the message, so a private concept's id does not reveal the ordinary concept of the same text.
 */
export async function newConceptId(hmac: HmacSha256, tagKey: string, privateAssign: boolean): Promise<string> {
  if (!/^[0-9a-f]{64}$/.test(tagKey)) throw new Error('newConceptId: tagKey must be a sha256 hex digest');
  const mac = await hmac(utf8Encode(`concept|${tagKey}${privateAssign ? '|p' : ''}`));
  const hex = Array.from(mac.subarray(0, CONCEPT_ID_HEX / 2), (b) => b.toString(16).padStart(2, '0')).join('');
  return `c_${hex}${privateAssign ? '_p' : ''}`;
}
