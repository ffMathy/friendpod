// Downloads the pinned model files (src/config.ts MODEL.files) into ./model/<hfRepo>/ and verifies each one
// by content hash (sha256 for LFS files, git blob sha1 for small files). Already-verified files are kept.
//
//   GCS_MODEL_BUCKET=grouper-<env>-models npm run fetch-model   # CI and predeploy: our EU mirror (gcloud, WIF)
//   npm run fetch-model                                         # local dev: Hugging Face at the pinned revision
//
// Mirror layout: gs://<bucket>/<hfRepo>@<revision>/<path>. Fill it from a verified local copy:
//   gcloud storage cp --recursive model/<hfRepo>/* gs://<bucket>/<hfRepo>@<revision>/
// ./model is gitignored; model weights are never committed.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTs, SERVICE_ROOT } from './ts.mjs';

const { MODEL } = await importTs('src/config.ts');
const dest = join(fileURLToPath(SERVICE_ROOT), 'model', MODEL.hfRepo);
const bucket = process.env.GCS_MODEL_BUCKET;

async function matches(file, pin) {
  const hash = createHash('sha256' in pin ? 'sha256' : 'sha1');
  if ('gitBlobSha1' in pin) hash.update(`blob ${statSync(file).size}\0`);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex') === ('sha256' in pin ? pin.sha256 : pin.gitBlobSha1);
}

function download(path, out) {
  const [cmd, args] = bucket
    ? ['gcloud', ['storage', 'cp', `gs://${bucket}/${MODEL.hfRepo}@${MODEL.revision}/${path}`, out]]
    : ['curl', ['-sSfL', '--retry', '3', '-o', out, `https://huggingface.co/${MODEL.hfRepo}/resolve/${MODEL.revision}/${path}`]];
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`download failed: ${path} (${r.error?.message ?? `exit ${r.status}`})`);
}

console.log(`${MODEL.hfRepo}@${MODEL.revision} (${MODEL.dtype}, ${MODEL.licence}) from ${bucket ? `gs://${bucket}` : 'huggingface.co'} → ${dest}`);
for (const pin of MODEL.files) {
  const out = join(dest, pin.path);
  if (existsSync(out) && (await matches(out, pin))) {
    console.log(`ok (cached) ${pin.path}`);
    continue;
  }
  mkdirSync(dirname(out), { recursive: true });
  const part = `${out}.part`;
  download(pin.path, part);
  if (!(await matches(part, pin))) {
    rmSync(part, { force: true });
    throw new Error(`hash mismatch: ${pin.path}`);
  }
  renameSync(part, out);
  console.log(`ok ${pin.path}`);
}
