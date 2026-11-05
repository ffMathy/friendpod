/**
 * The bundled on-device model's pins for build tooling (scripts/fetch-model.mjs, withBundledModel.js), read from the
 * same JSON as core's EMBEDDING_MODEL (packages/core/src/interests/data/eg2-q4.model.json). Plain Node, no
 * dependencies: EAS runs the fetch in `eas-build-pre-install`, before node_modules exist.
 */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PINS_FILE = path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'interests', 'data', 'eg2-q4.model.json');

/**
 * `files` are the device files only (the ones the app bundles), smallest first like core's `deviceModelFiles()`.
 * `dir` is core's `device.dir` ("models/<folder>/"): the path inside the app bundle and Android assets.
 */
function readPins(file = PINS_FILE) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dir = String(json.dir);
  if (!/^models\/[a-z0-9-]+\/$/.test(dir)) throw new Error(`${file}: dir must look like "models/<folder>/" (got "${dir}")`);
  const files = json.files.filter((f) => f.device).sort((a, b) => a.bytes - b.bytes);
  for (const f of files) {
    if (!/^[0-9a-f]{64}$/.test(f.sha256) || f.path.startsWith('/') || f.path.split('/').includes('..')) {
      throw new Error(`${file}: bad pin for ${f.path}`);
    }
  }
  return { hfRepo: json.hfRepo, revision: json.revision, dir, folder: dir.split('/')[1], files };
}

/** Where `npm run fetch-model` puts the files and the config plugin takes them from (gitignored). */
function sourceDir(projectRoot, pins) {
  return path.join(projectRoot, 'assets', 'model', pins.folder);
}

/** Lower-case hex SHA-256 of a file, read in chunks (the weights are ~174 MB). */
function sha256File(file) {
  const hash = createHash('sha256');
  const buf = Buffer.allocUnsafe(4 << 20);
  const fd = fs.openSync(file, 'r');
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function sizeOf(file) {
  try {
    const st = fs.statSync(file);
    return st.isFile() ? st.size : null;
  } catch {
    return null;
  }
}

/** True when `file` exists with the pinned size and SHA-256. */
function matchesPin(file, pin) {
  return sizeOf(file) === pin.bytes && sha256File(file) === pin.sha256;
}

/** Pinned paths under `dir` that are missing or differ from their pin (size first, then SHA-256). */
function checkFolder(dir, files) {
  const missing = [];
  const mismatched = [];
  for (const f of files) {
    const p = path.join(dir, f.path);
    if (sizeOf(p) === null) missing.push(f.path);
    else if (!matchesPin(p, f)) mismatched.push(f.path);
  }
  return { missing, mismatched };
}

/**
 * Where `npm run fetch-model` gets `file` and with which headers. With MODEL_MIRROR_URL every file comes from the
 * mirror (laid out like the model repo); without it, `hf` files come from Hugging Face at the pinned revision and a
 * `mirror`-only file (prototypes.bin) cannot be fetched.
 *
 * The models bucket is private (DESIGN.md §8, §9: no public or app access), so a mirror request carries
 * `Authorization: Bearer $MODEL_MIRROR_TOKEN`, a short-lived OAuth access token with read access to the bucket
 * (apps/mobile/README.md "Environment"). The token goes to the mirror's origin only and is never followed through a
 * redirect; HF_TOKEN goes to huggingface.co only.
 */
function requestFor(pins, file, env = process.env) {
  const mirror = env.MODEL_MIRROR_URL;
  if (mirror) {
    const url = new URL(file.path, mirror.endsWith('/') ? mirror : `${mirror}/`);
    if (url.protocol !== 'https:' && env.MODEL_MIRROR_TOKEN) throw new Error('MODEL_MIRROR_URL must be https:// when MODEL_MIRROR_TOKEN is set');
    const headers = env.MODEL_MIRROR_TOKEN ? { authorization: `Bearer ${env.MODEL_MIRROR_TOKEN}` } : {};
    return { url: url.toString(), headers, fromMirror: true };
  }
  if (file.source !== 'hf') {
    throw new Error(
      `${file.path} is not on Hugging Face (source "${file.source}"); set MODEL_MIRROR_URL to the models bucket and MODEL_MIRROR_TOKEN to an access token that can read it`,
    );
  }
  const headers = env.HF_TOKEN ? { authorization: `Bearer ${env.HF_TOKEN}` } : {};
  return { url: `https://huggingface.co/${pins.hfRepo}/resolve/${pins.revision}/${file.path}`, headers, fromMirror: false };
}

module.exports = { PINS_FILE, readPins, sourceDir, sha256File, sizeOf, matchesPin, checkFolder, requestFor };
