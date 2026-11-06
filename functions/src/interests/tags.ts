/**
 * The shared, uid-free tag cache (`tags/{tagKey}`, DESIGN.md §5.2 (3), §8.2) as the pipeline sees it.
 *
 * `vec` is the first client vector stored for the text (D1: the server trusts it). Every tag has three assignment
 * slots, each a concept in one partition plus a holder count:
 * - own: `conceptId` + `refCount`, in the tag's own partition (`sens.sensitive`);
 * - private: `privateAssign`, the sensitive-partition concept of an ordinary tag, for "Keep this private" holdings;
 * - ordinary: `ordinaryAssign`, the ordinary-partition concept of a sensitive tag, for "This isn't sensitive for me"
 *   holdings.
 * So a holding's partition decides its slot, and partitions never mix in a concept (§5.2 (5)). A tag's vector is in
 * a slot concept's `sum` only while that slot's count is above 0 (§5.2 (8)).
 */
import { tagKeyMaterial, type Partition } from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { vectorFromField } from './assign';

export type Slot = 'own' | 'private' | 'ordinary';
export const SLOTS: readonly Slot[] = ['own', 'private', 'ordinary'];

/** The tag-level decision, made once from the first writer's phone margin (F35) and never re-run on the server. */
export interface TagSens {
  readonly sensitive: boolean;
  readonly margin: number | null;
}

export interface TagState {
  /** False for a text first seen in this request (not in `tags` yet). */
  readonly exists: boolean;
  readonly vec: Float32Array;
  readonly sens: TagSens;
  /** Concept per slot while that slot's count is above 0, else null. */
  readonly slots: Readonly<Record<Slot, string | null>>;
}

/** `tagKey = sha256(modelId|768|sts|norm)` (§5.2 (3)): a different model never reads another model's vector. */
export function tagKeyFor(norm: string, modelId: string): string {
  return sha256Hex(tagKeyMaterial(norm, modelId));
}

export function ownPartition(sens: TagSens): Partition {
  return sens.sensitive ? 'sensitive' : 'ordinary';
}

/** The slot a holding of `partition` uses on a tag of `tagPartition`. */
export function slotFor(partition: Partition, tagPartition: Partition): Slot {
  if (partition === tagPartition) return 'own';
  return partition === 'sensitive' ? 'private' : 'ordinary';
}

export function slotPartition(slot: Slot, tagPartition: Partition): Partition {
  if (slot === 'own') return tagPartition;
  return slot === 'private' ? 'sensitive' : 'ordinary';
}

/** Firestore field holding a side slot (`privateAssign` / `ordinaryAssign`). */
export function sideSlotField(slot: Exclude<Slot, 'own'>): 'privateAssign' | 'ordinaryAssign' {
  return slot === 'private' ? 'privateAssign' : 'ordinaryAssign';
}

function sideSlot(d: Record<string, unknown>, field: 'privateAssign' | 'ordinaryAssign'): string | null {
  const s = d[field] as { conceptId?: unknown; refCount?: unknown } | undefined;
  return s && typeof s.refCount === 'number' && s.refCount > 0 && typeof s.conceptId === 'string' ? s.conceptId : null;
}

/** Holder count of a slot in a raw tag doc. */
export function slotCount(d: Record<string, unknown>, slot: Slot): number {
  if (slot === 'own') return typeof d.refCount === 'number' ? d.refCount : 0;
  const s = d[sideSlotField(slot)] as { refCount?: unknown } | undefined;
  return typeof s?.refCount === 'number' ? s.refCount : 0;
}

export function tagStateFromDoc(snap: DocumentSnapshot, dim: number): TagState {
  const d = snap.data();
  if (!d) throw new Error('tagStateFromDoc: missing document');
  const s = d.sens as Record<string, unknown>;
  const refCount = typeof d.refCount === 'number' ? d.refCount : 0;
  return {
    exists: true,
    vec: vectorFromField(d.vec, dim),
    sens: {
      sensitive: s.sensitive === true,
      margin: typeof s.margin === 'number' ? s.margin : null,
    },
    slots: {
      own: refCount > 0 && typeof d.conceptId === 'string' ? d.conceptId : null,
      private: sideSlot(d, 'privateAssign'),
      ordinary: sideSlot(d, 'ordinaryAssign'),
    },
  };
}

/** True when a fresh read still matches what a plan was built on (else the plan is stale). */
export function sameTagState(a: TagState, b: TagState): boolean {
  return a.exists === b.exists && SLOTS.every((s) => a.slots[s] === b.slots[s]) && (!a.exists || a.sens.sensitive === b.sens.sensitive);
}

/** The slot whose concept a holding points at, or null if none does (a stale or inconsistent holding). */
export function slotOfConcept(state: TagState, conceptId: string | null): Slot | null {
  if (conceptId === null) return null;
  return SLOTS.find((s) => state.slots[s] === conceptId) ?? null;
}
