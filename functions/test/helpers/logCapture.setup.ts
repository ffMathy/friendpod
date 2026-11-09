import { afterEach, beforeEach, expect } from 'vitest';
import { capture, leakedValues } from './logCapture';

// No GCE metadata server in tests; without this google-auth-library probes for one and warns.
process.env.METADATA_SERVER_DETECTION ??= 'none';
// Storage triggers need a default bucket at definition time; the CLI provides FIREBASE_CONFIG at deploy.
process.env.GCLOUD_PROJECT ??= 'demo-friendpod';
process.env.FIREBASE_CONFIG ??= JSON.stringify({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.firebasestorage.app` });

const METHODS = ['debug', 'info', 'log', 'warn', 'error'] as const;
const MARK = Symbol.for('friendpod.functions.logCapture.wrapped');

for (const method of METHODS) {
  const original = console[method] as ((...args: unknown[]) => void) & { [MARK]?: true };
  if (original[MARK]) continue;
  const wrapped = Object.assign(
    (...args: unknown[]) => {
      capture().lines.push(args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? `${a.name}: ${a.message}\n${a.stack ?? ''}` : JSON.stringify(a))).join(' '));
      if (process.env.SHOW_TEST_LOGS === '1') original.apply(console, args);
    },
    { [MARK]: true as const },
  );
  console[method] = wrapped;
}

beforeEach(() => {
  capture().lines.length = 0;
  capture().forbidden = [];
});

afterEach(() => {
  expect(leakedValues(), 'values that must never be logged appeared in the logs').toEqual([]);
});
