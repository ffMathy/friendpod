/**
 * Log-safe summaries for the server's log-scrubbing wrappers (DESIGN.md §13), shared by both Functions codebases
 * through `@friendpod/core/node`. Zod parsing keeps issue paths and codes only, never `message` or `received`.
 * Record keys come from the request (e.g. uids in `submitFeedback.meetAgain`), so a path segment is kept only
 * when it is an array index or a property name declared by the schema itself.
 */
export interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: readonly IssueLike[] } };
}

interface IssueLike {
  readonly code: string;
  readonly path: readonly PropertyKey[];
}

export interface SafeIssue {
  readonly path: string;
  readonly code: string;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: SafeIssue[] };

const MAX_LOGGED_ISSUES = 10;

export function parseSafely<T>(schema: Schema<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  const keys = declaredKeys(schema);
  const issues = result.error.issues.slice(0, MAX_LOGGED_ISSUES).map((issue) => ({
    path: issue.path.map((seg) => (typeof seg === 'number' ? String(seg) : typeof seg === 'string' && keys.has(seg) ? seg : '*')).join('.'),
    code: /^[a-z_]{1,40}$/.test(issue.code) ? issue.code : 'other',
  }));
  return { ok: false, issues };
}

interface ZodDefLike {
  readonly type?: string;
  readonly shape?: Readonly<Record<string, unknown>>;
  readonly innerType?: unknown;
  readonly in?: unknown;
  readonly out?: unknown;
  readonly element?: unknown;
  readonly valueType?: unknown;
  readonly options?: readonly unknown[];
  readonly left?: unknown;
  readonly right?: unknown;
}

const keyCache = new WeakMap<object, ReadonlySet<string>>();

/** Every object property name reachable in a zod 4 schema (walks `_zod.def`; unknown node types contribute nothing). */
export function declaredKeys(schema: object): ReadonlySet<string> {
  const cached = keyCache.get(schema);
  if (cached) return cached;
  const keys = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return;
    seen.add(node);
    const def = (node as { _zod?: { def?: ZodDefLike } })._zod?.def;
    if (!def) return;
    if (def.shape) {
      for (const [key, child] of Object.entries(def.shape)) {
        keys.add(key);
        visit(child);
      }
    }
    for (const child of [def.innerType, def.in, def.out, def.element, def.valueType, def.left, def.right, ...(def.options ?? [])]) visit(child);
  };
  visit(schema);
  keyCache.set(schema, keys);
  return keys;
}

/** Stack frames only: the first line of `stack` repeats the message, which can echo document paths or values. */
export function stackFrames(err: unknown, max = 15): string[] {
  if (!(err instanceof Error) || typeof err.stack !== 'string') return [];
  return err.stack
    .split('\n')
    .filter((line) => /^\s+at\s/.test(line))
    .map((line) => line.trim())
    .slice(0, max);
}
