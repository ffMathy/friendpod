import type { PinnedModelFile } from '@grouper/core';
import { EmbedderUnavailableError } from './types';

/** The few file operations the model cache needs; expo-file-system in the app, an in-memory fake in tests. */
export interface ModelFs {
  /** Size in bytes, or null when the file does not exist. */
  size(path: string): number | null;
  /** Lower-case hex SHA-256, computed natively (no 175 MB buffer in JS). */
  sha256(path: string): Promise<string>;
  /** Downloads `url` to `path`, replacing anything there, creating parent directories. */
  download(url: string, path: string, onBytes: (written: number) => void): Promise<void>;
  move(from: string, to: string): Promise<void>;
  remove(path: string): void;
}

export type Connectivity = 'unmetered' | 'metered' | 'offline';

export interface EnsureOptions {
  readonly fs: ModelFs;
  /** Ends with '/'; each file is fetched from `baseUrl + file.path`. */
  readonly baseUrl: string;
  /** Local directory, ends with '/'. */
  readonly dir: string;
  readonly files: readonly PinnedModelFile[];
  readonly connectivity: () => Promise<Connectivity>;
  readonly allowCellular: boolean;
  readonly onProgress?: (fraction: number) => void;
  /**
   * Paths this process has already hashed. A file there with the pinned size is trusted without hashing again, so a
   * screen that releases the model on blur and loads it on focus does not re-read ~200 MB each time.
   */
  readonly verified?: Set<string>;
}

const PART = '.part';

async function matches(fs: ModelFs, path: string, file: PinnedModelFile, verified?: Set<string>): Promise<boolean> {
  if (fs.size(path) !== file.bytes) {
    verified?.delete(path);
    return false;
  }
  if (verified?.has(path)) return true;
  const ok = (await fs.sha256(path)).toLowerCase() === file.sha256;
  if (ok) verified?.add(path);
  return ok;
}

/**
 * Makes every pinned file present and verified under `dir` and returns their local paths. A file is used only if
 * its size and SHA-256 match the pin; a mismatch is deleted, downloaded once more to a `.part` file, verified, and
 * only then moved into place. Nothing is downloaded on mobile data without `allowCellular`.
 */
export async function ensureModelFiles(o: EnsureOptions): Promise<Record<string, string>> {
  const paths: Record<string, string> = {};
  const missing: PinnedModelFile[] = [];
  for (const file of o.files) {
    const path = o.dir + file.path;
    paths[file.path] = path;
    if (await matches(o.fs, path, file, o.verified)) continue;
    if (o.fs.size(path) !== null) o.fs.remove(path);
    missing.push(file);
  }
  if (missing.length === 0) return paths;

  const net = await o.connectivity();
  if (net === 'offline') throw new EmbedderUnavailableError('offline');
  if (net === 'metered' && !o.allowCellular) throw new EmbedderUnavailableError('cellular');

  const total = missing.reduce((s, f) => s + f.bytes, 0);
  let done = 0;
  for (const file of missing) {
    const path = paths[file.path]!;
    const part = path + PART;
    try {
      await o.fs.download(o.baseUrl + file.path, part, (written) => o.onProgress?.(Math.min(1, (done + written) / total)));
    } catch (e) {
      if (o.fs.size(part) !== null) o.fs.remove(part);
      throw new EmbedderUnavailableError('download', e instanceof Error ? e.message : String(e));
    }
    if (!(await matches(o.fs, part, file))) {
      o.fs.remove(part);
      throw new EmbedderUnavailableError('integrity', file.path);
    }
    await o.fs.move(part, path);
    o.verified?.add(path);
    done += file.bytes;
    o.onProgress?.(done / total);
  }
  return paths;
}
