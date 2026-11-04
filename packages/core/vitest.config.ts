import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Property tests over the matcher are CPU-bound; keep them deterministic and bounded.
    testTimeout: 60_000,
  },
});
