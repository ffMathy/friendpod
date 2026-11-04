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

module.exports = { PINS_FILE, readPins, sourceDir, sha256File, sizeOf, matchesPin, checkFolder };
