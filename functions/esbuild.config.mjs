// Bundles src and @grouper/core (resolved through tsconfig `paths`) into dist/index.js (DESIGN.md §14).
// firebase-functions and firebase-admin stay external: Cloud Build installs them from this package.json.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  tsconfig: 'tsconfig.json',
  external: ['firebase-functions', 'firebase-functions/*', 'firebase-admin', 'firebase-admin/*'],
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
});
