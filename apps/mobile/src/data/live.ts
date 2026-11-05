/**
 * Bridges Firestore `onSnapshot` into the TanStack Query cache (DESIGN.md §11 Data). Clients only read;
 * every document is parsed with its core schema, and a document that fails to parse is reported as an
 * error rather than rendered half-valid.
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  type QueryConstraint,
} from '@react-native-firebase/firestore';
import { skipToken, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { db } from '@/firebase';
import { useFirestoreGeneration } from './firestoreGeneration';

export interface LiveResult<T> {
  readonly data: T | undefined;
  readonly error: Error | null;
  readonly isLoading: boolean;
}

export interface WithId<T> {
  readonly id: string;
  readonly data: T;
}

function parseOrThrow<S extends z.ZodType>(schema: S, raw: unknown, path: string): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new Error(`document at ${path} does not match its schema`);
  return result.data;
}

function useLive<T>(key: QueryKey, subscribe: ((next: (value: T) => void, fail: (e: Error) => void) => () => void) | null): LiveResult<T> {
  const qc = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const keyHash = JSON.stringify(key);
  const generation = useFirestoreGeneration();
  useEffect(() => {
    if (!subscribe) return undefined;
    setError(null);
    return subscribe(
      (value) => qc.setQueryData(key, value),
      (e) => setError(e),
    );
    // `subscribe` is recreated on every render; keyHash identifies the subscription target, and a new
    // generation means a new Firestore instance after its cache was cleared.
  }, [keyHash, subscribe === null, generation]);
  const result = useQuery<T>({ queryKey: key, queryFn: skipToken, staleTime: Infinity });
  return { data: result.data, error, isLoading: subscribe !== null && result.data === undefined && error === null };
}

/** One document; `null` while signed out or when the path is not known yet. `data` is null if absent. */
export function useLiveDoc<S extends z.ZodType>(path: string | null, schema: S): LiveResult<z.output<S> | null> {
  return useLive<z.output<S> | null>(
    ['doc', path],
    path === null
      ? null
      : (next, fail) =>
          onSnapshot(
            doc(db(), path),
            (snap) => {
              try {
                next(snap.exists() ? parseOrThrow(schema, snap.data(), path) : null);
              } catch (e) {
                fail(e as Error);
              }
            },
            (e) => fail(e),
          ),
  );
}

/** A collection (optionally constrained); invalid documents are skipped and reported once. */
export function useLiveCollection<S extends z.ZodType>(
  path: string | null,
  schema: S,
  constraints: readonly QueryConstraint[] = [],
  keyExtra: readonly unknown[] = [],
): LiveResult<WithId<z.output<S>>[]> {
  return useLive<WithId<z.output<S>>[]>(
    ['collection', path, ...keyExtra],
    path === null
      ? null
      : (next, fail) =>
          onSnapshot(
            query(collection(db(), path), ...constraints),
            (snap) => {
              const rows: WithId<z.output<S>>[] = [];
              let invalid = 0;
              for (const d of snap.docs) {
                const parsed = schema.safeParse(d.data());
                if (parsed.success) rows.push({ id: d.id, data: parsed.data });
                else invalid += 1;
              }
              next(rows);
              if (invalid > 0) fail(new Error(`${invalid} document(s) in ${path} do not match their schema`));
            },
            (e) => fail(e),
          ),
  );
}
