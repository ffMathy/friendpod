// Loads the service's TypeScript (and @grouper/core through tsconfig "paths") from plain Node scripts,
// so model ids, revisions and file hashes come from src/config.ts and nowhere else.
import { tsImport } from 'tsx/esm/api';

export const SERVICE_ROOT = new URL('../', import.meta.url);

export function importTs(path) {
  return tsImport(new URL(path, SERVICE_ROOT).href, { parentURL: import.meta.url, tsconfig: new URL('tsconfig.json', SERVICE_ROOT).pathname });
}
