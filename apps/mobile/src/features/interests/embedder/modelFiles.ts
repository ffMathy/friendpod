import type { PinnedModelFile } from '@grouper/core';
import { EmbedderUnavailableError } from './types';

/**
 * The few file operations the bundled model needs; expo-file-system in the app, an in-memory fake in tests.
 * Every location is a URI: `file:///…` for files, `asset:///…` for Android APK assets (read-only).
 */
export interface ModelFs {
  /** Size in bytes, or null when the file does not exist. */
  size(uri: string): number | null;
  /** Lower-case hex SHA-256, computed natively (no 175 MB buffer in JS). */
  sha256(uri: string): Promise<string>;
  /** Copies `from` to `to`, replacing anything there and creating parent directories. */
  copy(from: string, to: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  /** Deletes a file or a directory tree; nothing happens if it does not exist. */
  remove(uri: string): void;
  /** Names of a directory's entries; empty if it does not exist. */
  list(dirUri: string): string[];
  readText(uri: string): Promise<string | null>;
  writeText(uri: string, text: string): Promise<void>;
  /** Free bytes on the volume holding the document directory. */
  freeBytes(): number;
}

export type ModelPlatform = 'ios' | 'android';

export interface PrepareOptions {
  readonly platform: ModelPlatform;
  readonly fs: ModelFs;
  /** The app bundle: `Paths.bundle` (iOS `file:///…/X.app/`, Android `asset:///`). */
  readonly bundleRoot: string;
  /** The document directory, ends with '/'. */
  readonly documentRoot: string;
  /** core's `EMBEDDING_MODEL.device.dir`, e.g. `models/eg2-q4-daa72c5/`: the same path in the bundle and on disk. */
  readonly dir: string;
  readonly files: readonly PinnedModelFile[];
}

/** Written last by Android's first-launch copy; it names exactly the pins the copied files were verified against. */
export const MARKER = '.verified.json';
const PART = '.part';
/** Headroom kept free beyond the copied bytes, so the copy does not leave the phone with nothing. */
const FREE_SPACE_MARGIN = 50 * 1024 * 1024;

const withSlash = (s: string) => (s.endsWith('/') ? s : `${s}/`);

/** `file:///…` for a plain path (iOS reports the bundle as one); URIs are kept as they are. */
export function toUri(pathOrUri: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathOrUri)) return pathOrUri;
  return `file://${encodeURI(pathOrUri)}`;
}

/**
 * The plain path onnxruntime-react-native opens: it strips `file://` but does not percent-decode, and an iOS bundle
 * path has a space in it ("Grouper Dev.app").
 */
export function toNativePath(uri: string): string {
  if (!uri.startsWith('file://')) throw new Error(`not a file URI: ${uri}`);
  return decodeURIComponent(uri.slice('file://'.length));
}

/** Where the bundled files are read from: inside the app on iOS, the APK's assets on Android. */
export function bundledModelDir(platform: ModelPlatform, bundleRoot: string, dir: string): string {
  return platform === 'android' ? `asset:///${dir}` : withSlash(toUri(bundleRoot)) + dir;
}

/** Android's copy of the bundled files in the document directory; the session opens these. */
export function installedModelDir(documentRoot: string, dir: string): string {
  return withSlash(documentRoot) + dir;
}

export function markerText(files: readonly PinnedModelFile[]): string {
  return JSON.stringify(files.map((f) => [f.path, f.bytes, f.sha256]));
}

/** Removes every model folder under the document directory except `keep` (iOS keeps none). Best effort. */
function cleanup(o: PrepareOptions, keep: string | null): void {
  const parent = withSlash(o.documentRoot) + o.dir.split('/')[0] + '/';
  for (const name of o.fs.list(parent)) {
    if (name === keep) continue;
    try {
      o.fs.remove(parent + name);
    } catch {
      // Left for the next launch; it never affects which files are loaded.
    }
  }
}

async function verified(fs: ModelFs, uri: string, file: PinnedModelFile): Promise<boolean> {
  return fs.size(uri) === file.bytes && (await fs.sha256(uri)).toLowerCase() === file.sha256;
}

/**
 * iOS: the files are code-signed resources inside the app; they are opened in place, after a size check that
 * catches a build without the model. Any `Documents/models/` left by the old download-on-first-use is removed.
 */
function prepareIos(o: PrepareOptions): Record<string, string> {
  const dir = bundledModelDir('ios', o.bundleRoot, o.dir);
  const paths: Record<string, string> = {};
  for (const file of o.files) {
    const uri = dir + file.path;
    if (o.fs.size(uri) !== file.bytes) throw new EmbedderUnavailableError('notBundled', file.path);
    paths[file.path] = uri;
  }
  cleanup(o, null);
  return paths;
}

/**
 * Android: APK assets are not file paths and the runtime needs one, with model_q4.onnx_data next to the graph. On
 * first launch every file is copied to `<documents>/<dir>` (app-internal storage; `allowBackup` is off), verified
 * with a native SHA-256 once, and the marker is written last. Later launches trust the marker plus the file sizes.
 * An interrupted copy resumes: files already in place are hashed and kept if they match.
 */
async function prepareAndroid(o: PrepareOptions): Promise<Record<string, string>> {
  const from = bundledModelDir('android', o.bundleRoot, o.dir);
  const to = installedModelDir(o.documentRoot, o.dir);
  const paths = Object.fromEntries(o.files.map((f) => [f.path, to + f.path]));
  const expected = markerText(o.files);

  if ((await o.fs.readText(to + MARKER)) === expected && o.files.every((f) => o.fs.size(to + f.path) === f.bytes)) {
    return paths;
  }
  o.fs.remove(to + MARKER);
  // Older revisions go first: they free the space this copy needs.
  cleanup(o, o.dir.split('/')[1] ?? null);

  const todo: PinnedModelFile[] = [];
  for (const file of o.files) {
    if (await verified(o.fs, to + file.path, file)) continue;
    o.fs.remove(to + file.path);
    todo.push(file);
  }
  const needed = todo.reduce((s, f) => s + f.bytes, 0);
  if (needed > 0 && o.fs.freeBytes() < needed + FREE_SPACE_MARGIN) throw new EmbedderUnavailableError('storage', `${needed} bytes needed`);

  for (const file of todo) {
    const dest = to + file.path;
    const part = dest + PART;
    try {
      await o.fs.copy(from + file.path, part);
    } catch (e) {
      o.fs.remove(part);
      if (o.fs.size(from + file.path) === null) throw new EmbedderUnavailableError('notBundled', file.path);
      throw new EmbedderUnavailableError('storage', e instanceof Error ? e.message : String(e));
    }
    if (!(await verified(o.fs, part, file))) {
      o.fs.remove(part);
      throw new EmbedderUnavailableError('integrity', file.path);
    }
    await o.fs.move(part, dest);
  }
  await o.fs.writeText(to + MARKER, expected);
  return paths;
}

/** The URI of every pinned device file, ready to open: bundled in place on iOS, copied out once on Android. */
export async function prepareModelFiles(o: PrepareOptions): Promise<Record<string, string>> {
  return o.platform === 'ios' ? prepareIos(o) : prepareAndroid(o);
}
