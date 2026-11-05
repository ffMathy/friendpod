import type { ObjectInfo, UserObjectStore } from '../../src/lib/objects';

/** The user-content bucket in memory (the functions suites run without the Storage emulator). */
export class MemoryUserObjects implements UserObjectStore {
  readonly objects = new Map<string, { data: Uint8Array; generation: string; contentType?: string; cacheControl?: string }>();
  private gen = 1;

  put(path: string, data: Uint8Array, contentType = 'image/jpeg'): void {
    this.objects.set(path, { data, generation: String(this.gen++), contentType });
  }
  async stat(path: string): Promise<ObjectInfo | null> {
    const o = this.objects.get(path);
    return o ? { name: path, generation: o.generation } : null;
  }
  async read(path: string): Promise<Uint8Array> {
    const o = this.objects.get(path);
    if (!o) throw Object.assign(new Error('No such object'), { code: 404 });
    return o.data;
  }
  async write(path: string, data: Uint8Array, o: { contentType: string; cacheControl: string }): Promise<void> {
    this.objects.set(path, { data, generation: String(this.gen++), ...o });
  }
  async deleteGeneration(path: string, generation: string): Promise<boolean> {
    const o = this.objects.get(path);
    if (!o || o.generation !== generation) return false;
    this.objects.delete(path);
    return true;
  }
  async delete(path: string): Promise<void> {
    this.objects.delete(path);
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
  names(prefix = ''): string[] {
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}
