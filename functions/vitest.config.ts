import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const core = (file: string): string => fileURLToPath(new URL(`../packages/core/src/${file}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@grouper\/core\/node$/, replacement: core('node.ts') },
      { find: /^@grouper\/core$/, replacement: core('index.ts') },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    // Captures every log line of every test file, so log-scrubbing assertions see framework output too (§13).
    setupFiles: ['test/helpers/logCapture.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
