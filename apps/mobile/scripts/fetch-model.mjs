#!/usr/bin/env node
/**
 * Fetches the pinned on-device model (EmbeddingGemma 2 q4, D1) into apps/mobile/assets/model/<folder>/ so the config
 * plugin (plugins/withBundledModel.js) can bundle it into the app. Every file is checked against the size and SHA-256
 * pinned in packages/core (data/eg2-q4.model.json); a file that does not match is never moved into place.
 *
 *   npm run fetch-model                      from Hugging Face at the pinned revision
 *   MODEL_MIRROR_URL=https://…/ MODEL_MIRROR_TOKEN=… npm run fetch-model
 *                                            from a mirror laid out like the model repo (our private EU models
 *                                            bucket; the token is a short-lived OAuth access token that can read it)
 *
 * Idempotent: files that are already there and verified are skipped. Anything else in assets/model/ (an older
 * revision, a partial download) is removed, so a build never bundles a stale file. EAS runs it in the
 * `eas-build-pre-install` hook; CI never runs it (CI uses EXPO_PUBLIC_EMBEDDER=stub paths only).
 *
 * Node built-ins only (it runs before `npm install` on EAS). Behind an HTTPS proxy, the npm script passes
 * `--use-env-proxy` so fetch() honours HTTPS_PROXY.
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readPins, sourceDir, sizeOf, matchesPin, requestFor } = require('../plugins/modelPins.js');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATTEMPTS = 3;
const PART = '.part';

/** Streams the request to `dest`, hashing on the way; resolves to the byte count and SHA-256 actually written. */
async function download({ url, headers, fromMirror }, dest) {
  // The mirror's bearer token must not follow a redirect to another host; Hugging Face redirects to its CDN.
  const res = await fetch(url, { headers, redirect: fromMirror ? 'error' : 'follow' });
  if (!res.ok || !res.body) {
    if (fromMirror && (res.status === 401 || res.status === 403)) {
      const why = headers.authorization ? 'MODEL_MIRROR_TOKEN was refused (expired, or no read access to the bucket)' : 'MODEL_MIRROR_TOKEN is not set';
      throw Object.assign(new Error(`GET ${url}: HTTP ${res.status}. The models bucket is private: ${why} (apps/mobile/README.md)`), { fatal: true });
    }
    // A 4xx other than a timeout or rate limit will not change on retry.
    const fatal = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
    throw Object.assign(new Error(`GET ${url}: HTTP ${res.status}`), { fatal });
  }
  const hash = createHash('sha256');
  let bytes = 0;
  const tap = new Transform({
    transform(chunk, _enc, done) {
      hash.update(chunk);
      bytes += chunk.length;
      done(null, chunk);
    },
  });
  await mkdir(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), tap, createWriteStream(dest));
  return { bytes, sha256: hash.digest('hex') };
}

async function fetchOne(pins, file, dest) {
  const request = requestFor(pins, file);
  const part = dest + PART;
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const got = await download(request, part);
      if (got.bytes !== file.bytes || got.sha256 !== file.sha256) {
        // A wrong file is not retried into place: the pin or the source is wrong, and a human has to look.
        await rm(part, { force: true });
        throw Object.assign(new Error(`${file.path}: got ${got.bytes} bytes, sha256 ${got.sha256}; pinned ${file.bytes} bytes, sha256 ${file.sha256}`), { fatal: true });
      }
      await rename(part, dest);
      return;
    } catch (e) {
      await rm(part, { force: true });
      if (e && e.fatal) throw e;
      lastError = e;
      console.warn(`fetch-model: ${file.path} attempt ${attempt}/${ATTEMPTS} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw lastError;
}

/** Removes everything under assets/model/ that is not a pinned file of the current folder. */
async function prune(modelRoot, folder, files) {
  const keep = new Set(files.map((f) => path.join(modelRoot, folder, f.path)));
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const pinnedInside = [...keep].some((k) => k.startsWith(p + path.sep));
        if (!pinnedInside) {
          console.log(`fetch-model: removing ${path.relative(projectRoot, p)}/`);
          await rm(p, { recursive: true, force: true });
        } else await walk(p);
      } else if (!keep.has(p)) {
        console.log(`fetch-model: removing ${path.relative(projectRoot, p)}`);
        await rm(p, { force: true });
      }
    }
  };
  await walk(modelRoot);
}

async function main() {
  if (process.env.EXPO_PUBLIC_EMBEDDER === 'stub') {
    console.log('fetch-model: EXPO_PUBLIC_EMBEDDER=stub, skipping (the build runs without the model)');
    return;
  }
  const pins = readPins();
  const dir = sourceDir(projectRoot, pins);
  const modelRoot = path.dirname(dir);
  await mkdir(dir, { recursive: true });
  await prune(modelRoot, pins.folder, pins.files);

  const total = pins.files.reduce((s, f) => s + f.bytes, 0);
  for (const file of pins.files) {
    const dest = path.join(dir, file.path);
    if (sizeOf(dest) !== null && matchesPin(dest, file)) {
      console.log(`fetch-model: ${file.path} verified`);
      continue;
    }
    await rm(dest, { force: true });
    console.log(`fetch-model: fetching ${file.path} (${(file.bytes / 1e6).toFixed(1)} MB)`);
    await fetchOne(pins, file, dest);
    console.log(`fetch-model: ${file.path} verified`);
  }
  console.log(`fetch-model: ${pins.files.length} files, ${(total / 1e6).toFixed(1)} MB in ${path.relative(projectRoot, dir)}/ (${pins.hfRepo}@${pins.revision.slice(0, 7)})`);
}

main().catch((e) => {
  console.error(`fetch-model: ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
