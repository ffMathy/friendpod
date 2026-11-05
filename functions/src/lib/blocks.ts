/**
 * Block lookups inside a transaction (DESIGN.md §3.7): a block is two-way, so a pair counts as blocked when either
 * `blocks/{a}_{b}` or `blocks/{b}_{a}` exists. Every place that creates a photo grant, and the Keep loop, asks here.
 */
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { docs } from './firestore';

/** Order-independent key of a pair. */
export const pairOf = (a: string, b: string): string => (a < b ? `${a} ${b}` : `${b} ${a}`);

export interface BlockEdge {
  readonly blocker: string;
  readonly blocked: string;
  readonly createdAtMs: number;
}

/** The blocks between any of these pairs, in either direction (one getAll, inside `tx`). */
export async function blocksBetween(tx: Transaction, db: Firestore, pairs: readonly (readonly [string, string])[]): Promise<BlockEdge[]> {
  const unique = new Map<string, readonly [string, string]>();
  for (const [a, b] of pairs) if (a !== b) unique.set(pairOf(a, b), a < b ? [a, b] : [b, a]);
  if (unique.size === 0) return [];
  const refs = docs(db);
  const list = [...unique.values()];
  const snaps = await tx.getAll(...list.flatMap(([a, b]) => [refs.block(a, b), refs.block(b, a)]));
  const out: BlockEdge[] = [];
  for (const s of snaps) {
    const d = s.data();
    if (d) out.push({ blocker: d.blocker, blocked: d.blocked, createdAtMs: d.createdAt.toMillis() });
  }
  return out;
}

/** The set of `pairOf` keys that are blocked in either direction. */
export async function blockedPairs(tx: Transaction, db: Firestore, pairs: readonly (readonly [string, string])[]): Promise<Set<string>> {
  return new Set((await blocksBetween(tx, db, pairs)).map((e) => pairOf(e.blocker, e.blocked)));
}
