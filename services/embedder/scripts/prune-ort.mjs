// `gcp-build` (run by Cloud Build after `npm ci`): onnxruntime-node ships prebuilt binaries for every
// platform (about 550 MB). Keep only this machine's platform/arch so the function image stays small.
// Usage: node scripts/prune-ort.mjs [bin directory]   (defaults to node_modules/onnxruntime-node/bin)
import { readdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The service runs on CPU. .npmrc skips the postinstall that fetches these from NuGet on linux/x64 (about 273 MB);
// this removes them should a future npm stop passing that setting to install scripts.
const GPU_PROVIDER_LIBS = ['libonnxruntime_providers_cuda.so', 'libonnxruntime_providers_tensorrt.so', 'libonnxruntime_providers_shared.so'];

const bin = process.argv[2] ? pathToFileURL(`${process.argv[2].replace(/\/?$/, '/')}`) : new URL('../node_modules/onnxruntime-node/bin/', import.meta.url);
for (const napi of readdirSync(bin)) {
  const napiDir = new URL(`${napi}/`, bin);
  for (const platform of readdirSync(napiDir)) {
    const platformDir = new URL(`${platform}/`, napiDir);
    if (platform !== process.platform) {
      rmSync(platformDir, { recursive: true, force: true });
      continue;
    }
    for (const arch of readdirSync(platformDir)) {
      const archDir = new URL(`${arch}/`, platformDir);
      if (arch !== process.arch) rmSync(archDir, { recursive: true, force: true });
      else for (const lib of GPU_PROVIDER_LIBS) rmSync(new URL(lib, archDir), { force: true });
    }
  }
}
console.log(`onnxruntime-node: kept ${process.platform}/${process.arch} CPU binaries only`);
