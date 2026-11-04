// Bundles src + @grouper/core (resolved through tsconfig "paths") into dist/index.js (DESIGN.md §14).
// Packages with native code or their own runtime discovery stay external and are installed by Cloud Build.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  tsconfig: 'tsconfig.json',
  external: ['firebase-functions', 'firebase-admin', '@huggingface/transformers', 'onnxruntime-node'],
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'info',
});
