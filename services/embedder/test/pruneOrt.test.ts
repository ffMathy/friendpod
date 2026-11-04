import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../scripts/prune-ort.mjs', import.meta.url));
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('gcp-build: onnxruntime-node pruning', () => {
  it('skips the CUDA download at install time (.npmrc)', () => {
    const npmrc = readFileSync(fileURLToPath(new URL('../.npmrc', import.meta.url)), 'utf8');
    expect(npmrc).toMatch(/^onnxruntime-node-install=skip$/m);
  });

  it('keeps only this platform/arch and never the GPU execution providers', () => {
    const bin = mkdtempSync(join(tmpdir(), 'ort-bin-'));
    dirs.push(bin);
    const here = join(bin, 'napi-v6', process.platform, process.arch);
    const files = ['libonnxruntime.so.1', 'onnxruntime_binding.node', 'libonnxruntime_providers_cuda.so', 'libonnxruntime_providers_tensorrt.so', 'libonnxruntime_providers_shared.so'];
    for (const dir of [here, join(bin, 'napi-v6', 'win32', 'x64'), join(bin, 'napi-v6', process.platform, process.arch === 'x64' ? 'arm64' : 'x64')]) {
      mkdirSync(dir, { recursive: true });
      for (const f of files) writeFileSync(join(dir, f), '');
    }
    execFileSync(process.execPath, [SCRIPT, bin], { stdio: 'pipe' });
    expect(readdirSync(join(bin, 'napi-v6'))).toEqual([process.platform]);
    expect(readdirSync(join(bin, 'napi-v6', process.platform))).toEqual([process.arch]);
    expect(readdirSync(here).sort()).toEqual(['libonnxruntime.so.1', 'onnxruntime_binding.node']);
  });
});
