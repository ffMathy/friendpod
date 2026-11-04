// Parses and validates firestore.indexes.json exactly as `firebase deploy --only firestore:indexes` does
// (loadCJSON → upgradeOldSpec → validateSpec), using the installed firebase-tools, so a malformed vector or
// TTL entry fails in CI instead of at deploy time. It makes no network calls.
//
//   node tests/rules/scripts/validate-indexes.mjs [<firebase-tools dir>]   # default: the `firebase` on PATH
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_VERSION = '15.34.2';

/** The firebase-tools package that the `firebase` command on PATH belongs to. */
function firebaseToolsOnPath() {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const bin = join(dir, 'firebase');
    if (!existsSync(bin)) continue;
    for (let d = dirname(realpathSync(bin)); d !== dirname(d); d = dirname(d)) {
      const pkg = join(d, 'package.json');
      if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).name === 'firebase-tools') return d;
    }
  }
  console.error('firebase-tools not found on PATH; pass its directory as the first argument');
  process.exit(1);
}

const toolsDir = process.argv[2] ?? firebaseToolsOnPath();
const require = createRequire(join(toolsDir, 'package.json'));

const { version } = JSON.parse(readFileSync(join(toolsDir, 'package.json'), 'utf8'));
if (version !== EXPECTED_VERSION) {
  console.error(`firebase-tools ${version} found in ${toolsDir}; expected ${EXPECTED_VERSION} (DESIGN.md §7)`);
  process.exit(1);
}

const { loadCJSON } = require('./lib/loadCJSON.js');
const { FirestoreApi } = require('./lib/firestore/api.js');

const file = fileURLToPath(new URL('../../../firestore.indexes.json', import.meta.url));
const raw = loadCJSON(file);
const api = new FirestoreApi();
const spec = api.upgradeOldSpec({ indexes: raw.indexes ?? [], fieldOverrides: raw.fieldOverrides ?? [] });
api.validateSpec(spec);

const ttl = spec.fieldOverrides.filter((f) => f.ttl).length;
console.log(
  `firestore.indexes.json is valid for firebase-tools ${version}: ${spec.indexes.length} composite indexes, ` +
    `${spec.fieldOverrides.length} field overrides (${ttl} TTL policies)`,
);
