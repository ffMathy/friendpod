/**
 * Concept assignment (DESIGN.md §5.2 (6)): nearest concept within the HOLDING's sensitivity partition, then core's
 * decision table. Stage 1 (up to about 20k active concepts): Firestore `findNearest` over `concepts` prefiltered by
 * `sensitive == partition AND status == 'active'` (composite flat vector index `sensitive, status, centroid`, §8
 * Indexes). The in-memory shortlist of stage 2 replaces only `nearest()`. Vector queries cannot run inside a
 * transaction, so this runs before the persist transaction.
 */
import {
  decideAssignment,
  PartitionMismatchError,
  type AssignDecision,
  type AssignThresholds,
  type NearestConcept,
  type Partition,
} from '@friendpod/core';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import { CONCEPT_SEARCH_LIMIT } from './config';
import { dot } from './vectors';

export interface ConceptCandidate extends NearestConcept {
  /** Non-sensitive concepts only, for "Did you mean …?" (§5.2 (8) Labels). */
  readonly labels: { readonly da?: string; readonly en?: string };
}

export interface ConceptIndex {
  nearest(partition: Partition, vec: Float32Array): Promise<ConceptCandidate | null>;
}

/** A Firestore `VectorValue` (firebase-admin does not export the class). */
export function vectorFromField(value: unknown, dim: number): Float32Array {
  const toArray = (value as { toArray?: () => number[] } | null)?.toArray;
  if (typeof toArray !== 'function') throw new Error('expected a Firestore vector');
  const arr = toArray.call(value);
  if (arr.length !== dim) throw new Error('vector dimension mismatch');
  return Float32Array.from(arr);
}

export class FirestoreConceptIndex implements ConceptIndex {
  readonly #db: Firestore;
  readonly #dim: number;

  constructor(db: Firestore, dim: number) {
    this.#db = db;
    this.#dim = dim;
  }

  async nearest(partition: Partition, vec: Float32Array): Promise<ConceptCandidate | null> {
    const sensitive = partition === 'sensitive';
    const snap = await this.#db
      .collection('concepts')
      .where('sensitive', '==', sensitive)
      .where('status', '==', 'active')
      .findNearest({ vectorField: 'centroid', queryVector: Array.from(vec), limit: CONCEPT_SEARCH_LIMIT, distanceMeasure: 'DOT_PRODUCT' })
      .get();
    let best: ConceptCandidate | null = null;
    for (const doc of snap.docs) {
      const data: DocumentData = doc.data();
      // Defence in depth: the prefilter is the partition rule; a document from the other side is a bug.
      if (data.sensitive !== sensitive) throw new PartitionMismatchError();
      // Rescored locally: centroids and medoids are unit vectors, so the dot product is the cosine.
      const cosCentroid = dot(vec, vectorFromField(data.centroid, this.#dim));
      if (best && cosCentroid <= best.cosCentroid) continue;
      best = {
        conceptId: doc.id,
        sensitive,
        cosCentroid,
        cosMedoid: dot(vec, vectorFromField(data.medoid, this.#dim)),
        holderCount: typeof data.holderCount === 'number' ? data.holderCount : 0,
        labels: sensitive ? {} : { ...(data.labels as ConceptCandidate['labels'] | undefined) },
      };
    }
    return best;
  }
}

export interface AssignmentPlan {
  readonly decision: AssignDecision;
  readonly nearest: ConceptCandidate | null;
}

export async function planAssignment(index: ConceptIndex, partition: Partition, vec: Float32Array, thresholds: AssignThresholds): Promise<AssignmentPlan> {
  const nearest = await index.nearest(partition, vec);
  return { decision: decideAssignment(partition, nearest, thresholds), nearest };
}
