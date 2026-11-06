/**
 * Every scenario in this folder, found by file name: `<id>.ts` with a default export. Files starting with `_` are
 * shared helpers, not scenarios. Adding a scenario is adding a file (preview/README.md).
 */
import type { Scenario } from '../runtime/types';

const context = require.context('./', false, /^\.\/(?!index\.ts$)[a-z0-9][a-z0-9-]*\.ts$/);

export const SCENARIOS: ReadonlyMap<string, Scenario> = new Map(
  context
    .keys()
    .map((key) => {
      const scenario = (context(key) as { default: Scenario }).default;
      const id = key.replace(/^\.\//, '').replace(/\.ts$/, '');
      if (scenario.id !== id) throw new Error(`preview: scenarios/${id}.ts exports id "${scenario.id}"`);
      return [id, scenario] as const;
    }),
);

export const DEFAULT_SCENARIO = 'signed-out';
