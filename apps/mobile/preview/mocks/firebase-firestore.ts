/**
 * Preview fake of @react-native-firebase/firestore (modular API) over the scenario's documents (runtime/store.ts):
 * doc/collection refs, query constraints (where, orderBy, limit), onSnapshot, getDoc(s), and in-memory writes.
 * Snapshots arrive asynchronously, like the SDK's, and again whenever the store changes.
 */
import { preview } from '../runtime/state';
import type { StoredDoc } from '../runtime/store';
import { Timestamp } from '../runtime/timestamp';
import type { DocData } from '../runtime/types';

export { Timestamp };

export interface Firestore {
  readonly type: 'firestore';
}

export interface DocumentReference {
  readonly type: 'document';
  readonly id: string;
  readonly path: string;
}

export interface CollectionReference {
  readonly type: 'collection';
  readonly id: string;
  readonly path: string;
}

type WhereOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'not-in' | 'array-contains-any';

export type QueryConstraint =
  | { readonly kind: 'where'; readonly field: string; readonly op: WhereOp; readonly value: unknown }
  | { readonly kind: 'orderBy'; readonly field: string; readonly dir: 'asc' | 'desc' }
  | { readonly kind: 'limit'; readonly n: number };

export interface Query {
  readonly type: 'query';
  readonly path: string;
  readonly constraints: readonly QueryConstraint[];
}

export interface DocumentSnapshot {
  readonly id: string;
  readonly ref: DocumentReference;
  exists(): boolean;
  data(): DocData | undefined;
  get(field: string): unknown;
}

export interface QuerySnapshot {
  readonly docs: DocumentSnapshot[];
  readonly size: number;
  readonly empty: boolean;
  forEach(callback: (doc: DocumentSnapshot) => void): void;
}

const FIRESTORE: Firestore = { type: 'firestore' };

function join(base: string, rest: readonly string[]): string {
  return [base, ...rest].join('/').split('/').filter(Boolean).join('/');
}

function lastSegment(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? '';
}

export const getFirestore = (_app?: unknown): Firestore => FIRESTORE;
export const connectFirestoreEmulator = (): void => undefined;
export const terminate = async (_db?: Firestore): Promise<void> => undefined;
export const clearPersistence = async (_db?: Firestore): Promise<void> => undefined;
export const clearIndexedDbPersistence = clearPersistence;
export const enableNetwork = async (): Promise<void> => undefined;
export const disableNetwork = async (): Promise<void> => undefined;
export const waitForPendingWrites = async (): Promise<void> => undefined;

export function doc(parent: Firestore | CollectionReference | DocumentReference, path?: string, ...rest: string[]): DocumentReference {
  const base = 'path' in parent ? parent.path : '';
  const full = join(base, path === undefined ? [preview().store.newId('doc')] : [path, ...rest]);
  return { type: 'document', id: lastSegment(full), path: full };
}

export function collection(parent: Firestore | DocumentReference | CollectionReference, path: string, ...rest: string[]): CollectionReference {
  const base = 'path' in parent ? parent.path : '';
  const full = join(base, [path, ...rest]);
  return { type: 'collection', id: lastSegment(full), path: full };
}

export const where = (field: string, op: WhereOp, value: unknown): QueryConstraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint => ({ kind: 'orderBy', field, dir });
export const limit = (n: number): QueryConstraint => ({ kind: 'limit', n });

export function query(base: CollectionReference | Query, ...constraints: QueryConstraint[]): Query {
  return base.type === 'query'
    ? { type: 'query', path: base.path, constraints: [...base.constraints, ...constraints] }
    : { type: 'query', path: base.path, constraints };
}

function field(data: DocData, path: string): unknown {
  let value: unknown = data;
  for (const part of path.split('.')) value = (value as Record<string, unknown> | undefined)?.[part];
  return value;
}

function comparable(v: unknown): unknown {
  return typeof v === 'object' && v !== null && typeof (v as { toMillis?: unknown }).toMillis === 'function'
    ? (v as { toMillis(): number }).toMillis()
    : v;
}

function compare(a: unknown, b: unknown): number {
  const x = comparable(a);
  const y = comparable(b);
  if (x === y) return 0;
  if (x === undefined || x === null) return -1;
  if (y === undefined || y === null) return 1;
  return (x as number) < (y as number) ? -1 : 1;
}

function matches(data: DocData, c: Extract<QueryConstraint, { kind: 'where' }>): boolean {
  const v = comparable(field(data, c.field));
  const w = comparable(c.value);
  switch (c.op) {
    case '==':
      return v === w;
    case '!=':
      return v !== w;
    case '<':
      return compare(v, w) < 0;
    case '<=':
      return compare(v, w) <= 0;
    case '>':
      return compare(v, w) > 0;
    case '>=':
      return compare(v, w) >= 0;
    case 'array-contains':
      return Array.isArray(v) && v.includes(w);
    case 'array-contains-any':
      return Array.isArray(v) && Array.isArray(w) && w.some((x) => v.includes(x));
    case 'in':
      return Array.isArray(w) && w.includes(v);
    case 'not-in':
      return Array.isArray(w) && !w.includes(v);
  }
}

function docSnapshot(ref: DocumentReference, data: DocData | undefined): DocumentSnapshot {
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => data,
    get: (path: string) => (data ? field(data, path) : undefined),
  };
}

function run(target: CollectionReference | Query): QuerySnapshot {
  const constraints = target.type === 'query' ? target.constraints : [];
  let rows: StoredDoc[] = preview().store.list(target.path);
  for (const c of constraints) if (c.kind === 'where') rows = rows.filter((r) => matches(r.data, c));
  const orders = constraints.filter((c): c is Extract<QueryConstraint, { kind: 'orderBy' }> => c.kind === 'orderBy');
  if (orders.length > 0) {
    rows = [...rows].sort((a, b) => {
      for (const o of orders) {
        const d = compare(field(a.data, o.field), field(b.data, o.field));
        if (d !== 0) return o.dir === 'desc' ? -d : d;
      }
      return 0;
    });
  }
  for (const c of constraints) if (c.kind === 'limit') rows = rows.slice(0, c.n);
  const docs = rows.map((r) => docSnapshot({ type: 'document', id: r.id, path: r.path }, r.data));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
}

function read(target: DocumentReference | CollectionReference | Query): DocumentSnapshot | QuerySnapshot {
  return target.type === 'document' ? docSnapshot(target, preview().store.get(target.path)) : run(target);
}

type Observer<T> = ((snapshot: T) => void) | { next?: (snapshot: T) => void; error?: (e: Error) => void };

export function onSnapshot(target: DocumentReference, next: Observer<DocumentSnapshot>, error?: (e: Error) => void): () => void;
export function onSnapshot(target: CollectionReference | Query, next: Observer<QuerySnapshot>, error?: (e: Error) => void): () => void;
export function onSnapshot(
  target: DocumentReference | CollectionReference | Query,
  observer: Observer<DocumentSnapshot> | Observer<QuerySnapshot>,
  error?: (e: Error) => void,
): () => void {
  const onNext = (typeof observer === 'function' ? observer : observer.next) as ((s: DocumentSnapshot | QuerySnapshot) => void) | undefined;
  const onError = typeof observer === 'function' ? error : (observer.error ?? error);
  let active = true;
  const emit = () => {
    if (!active) return;
    try {
      onNext?.(read(target));
    } catch (e) {
      onError?.(e as Error);
    }
  };
  const timer = setTimeout(emit, 0);
  const stop = preview().store.subscribe(() => setTimeout(emit, 0));
  return () => {
    active = false;
    clearTimeout(timer);
    stop();
  };
}

export const getDoc = async (ref: DocumentReference): Promise<DocumentSnapshot> => docSnapshot(ref, preview().store.get(ref.path));
export const getDocFromCache = getDoc;
export const getDocFromServer = getDoc;
export const getDocs = async (target: CollectionReference | Query): Promise<QuerySnapshot> => run(target);
export const getDocsFromCache = getDocs;
export const getDocsFromServer = getDocs;

export const setDoc = async (ref: DocumentReference, data: DocData, options?: { merge?: boolean }): Promise<void> => {
  const store = preview().store;
  store.set(ref.path, options?.merge ? { ...store.get(ref.path), ...data } : data);
};
export const updateDoc = async (ref: DocumentReference, data: DocData): Promise<void> => preview().store.update(ref.path, data);
export const deleteDoc = async (ref: DocumentReference): Promise<void> => preview().store.delete(ref.path);
export const addDoc = async (ref: CollectionReference, data: DocData): Promise<DocumentReference> => {
  const created = doc(ref);
  preview().store.set(created.path, data);
  return created;
};
export const serverTimestamp = (): Timestamp => Timestamp.now();

export default () => FIRESTORE;
