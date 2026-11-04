/** Least-recently-used map. `peek` never changes recency, so a read-only request leaves the cache as it was. */
export class LruCache<K, V> {
  readonly #map = new Map<K, V>();
  readonly capacity: number;

  constructor(capacity: number) {
    if (!(capacity > 0)) throw new Error('LruCache: capacity must be positive');
    this.capacity = capacity;
  }

  get size(): number {
    return this.#map.size;
  }

  peek(key: K): V | undefined {
    return this.#map.get(key);
  }

  /** Inserts or refreshes `key` as the most recently used entry, evicting the oldest beyond capacity. */
  set(key: K, value: V): void {
    this.#map.delete(key);
    this.#map.set(key, value);
    while (this.#map.size > this.capacity) {
      const oldest = this.#map.keys().next();
      if (oldest.done) break;
      this.#map.delete(oldest.value);
    }
  }

  delete(key: K): void {
    this.#map.delete(key);
  }

  keys(): K[] {
    return [...this.#map.keys()];
  }
}
