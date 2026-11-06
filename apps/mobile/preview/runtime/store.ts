/**
 * The scenario's Firestore documents, in memory. The Firestore fake reads from here and re-runs every listener on a
 * change, so a callable handler that edits a document (e.g. respondToPod marking the card accepted) updates the screen.
 */
import type { DocData } from './types';

export interface StoredDoc {
  readonly id: string;
  readonly path: string;
  readonly data: DocData;
}

function segments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

export class PreviewStore {
  private readonly docs = new Map<string, DocData>();
  private readonly listeners = new Set<() => void>();
  private nextId = 1;

  constructor(initial: Readonly<Record<string, DocData>> = {}) {
    for (const [path, data] of Object.entries(initial)) this.docs.set(segments(path).join('/'), data);
  }

  get(path: string): DocData | undefined {
    return this.docs.get(segments(path).join('/'));
  }

  /** Documents directly in a collection (`users/u1/pods`), in insertion order. */
  list(collectionPath: string): StoredDoc[] {
    const prefix = segments(collectionPath);
    const rows: StoredDoc[] = [];
    for (const [path, data] of this.docs) {
      const s = segments(path);
      if (s.length === prefix.length + 1 && prefix.every((p, i) => s[i] === p)) rows.push({ id: s[s.length - 1]!, path, data });
    }
    return rows;
  }

  /** Documents of every collection with this id, e.g. all `roster` holders under `pods`. */
  all(): StoredDoc[] {
    return [...this.docs].map(([path, data]) => ({ id: segments(path).pop()!, path, data }));
  }

  set(path: string, data: DocData): void {
    this.docs.set(segments(path).join('/'), data);
    this.emit();
  }

  update(path: string, patch: DocData): void {
    const current = this.get(path);
    if (!current) throw new Error(`preview store: no document at ${path}`);
    this.set(path, { ...current, ...patch });
  }

  delete(path: string): void {
    this.docs.delete(segments(path).join('/'));
    this.emit();
  }

  /** A fresh document id for `add`-style writes. */
  newId(prefix = 'preview'): string {
    const id = `${prefix}${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
