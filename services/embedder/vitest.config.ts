import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const core = (p: string): string => fileURLToPath(new URL(`../../packages/core/src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@grouper\/core\/node$/, replacement: core('node.ts') },
      { find: /^@grouper\/core$/, replacement: core('index.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    // Emulator suites share one Firestore project and clear it between tests.
    fileParallelism: false,
    // Real console writes, so the log-scrubbing tests see every byte a library prints.
    disableConsoleIntercept: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
