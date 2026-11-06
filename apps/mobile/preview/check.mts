/**
 * Validates the preview fixtures without a browser (`npm -w apps/mobile run preview:check`):
 * - every scenario file default-exports a scenario whose id is its file name;
 * - every fixture document parses with the @grouper/core schema the app reads it with (a document that fails would
 *   render as an error or a spinner in the preview, not as the intended state);
 * - every screens.json entry names an existing scenario and, if it has one, an existing storyboard file.
 * Exits non-zero with a list of problems.
 */
import {
  areaDocSchema,
  exportDocSchema,
  interestDocSchema,
  interestIdSchema,
  noticeDocSchema,
  optionDocSchema,
  podCardDocSchema,
  podDocSchema,
  podIdSchema,
  podMessageDocSchema,
  sensitiveInterestDocSchema,
  userBlockDocSchema,
  userDocSchema,
} from '@grouper/core';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { z } from 'zod';
import type { Scenario } from './runtime/types';

const here = path.dirname(fileURLToPath(import.meta.url));
const problems: string[] = [];

const RULES: readonly [RegExp, z.ZodType, z.ZodType | null][] = [
  [/^users\/[^/]+$/, userDocSchema, null],
  [/^users\/[^/]+\/interests\/([^/]+)$/, interestDocSchema, interestIdSchema],
  [/^users\/[^/]+\/sensitiveInterests\/([^/]+)$/, sensitiveInterestDocSchema, interestIdSchema],
  [/^users\/[^/]+\/pods\/([^/]+)$/, podCardDocSchema, podIdSchema],
  [/^users\/[^/]+\/blocks\/[^/]+$/, userBlockDocSchema, null],
  [/^users\/[^/]+\/notices\/[^/]+$/, noticeDocSchema, null],
  [/^users\/[^/]+\/exports\/[^/]+$/, exportDocSchema, null],
  [/^pods\/([^/]+)$/, podDocSchema, podIdSchema],
  [/^pods\/[^/]+\/options\/[^/]+$/, optionDocSchema, null],
  [/^pods\/[^/]+\/messages\/[^/]+$/, podMessageDocSchema, null],
  [/^areas\/[^/]+$/, areaDocSchema, null],
];

function checkDoc(scenarioId: string, docPath: string, data: unknown): void {
  const rule = RULES.find(([re]) => re.test(docPath));
  if (!rule) {
    problems.push(`${scenarioId}: ${docPath} is not a path the app reads (add a rule in preview/check.ts if it is new)`);
    return;
  }
  const [re, schema, idSchema] = rule;
  const id = re.exec(docPath)?.[1];
  if (idSchema && id !== undefined && !idSchema.safeParse(id).success) problems.push(`${scenarioId}: ${docPath}: invalid document id "${id}"`);
  const result = schema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) problems.push(`${scenarioId}: ${docPath}: ${issue.path.join('.') || '(doc)'}: ${issue.message}`);
  }
}

const scenarioDir = path.join(here, 'scenarios');
const ids = new Set<string>();
for (const file of readdirSync(scenarioDir).sort()) {
  if (!/^[a-z0-9][a-z0-9-]*\.ts$/.test(file) || file === 'index.ts') continue;
  const id = file.replace(/\.ts$/, '');
  const mod = (await import(pathToFileURL(path.join(scenarioDir, file)).href)) as { default?: Scenario };
  const scenario = mod.default;
  if (!scenario) {
    problems.push(`scenarios/${file}: no default export`);
    continue;
  }
  if (scenario.id !== id) problems.push(`scenarios/${file}: id "${scenario.id}" must be "${id}"`);
  ids.add(id);
  const nowMs = typeof scenario.now === 'number' ? scenario.now : Date.parse(scenario.now);
  if (!Number.isFinite(nowMs)) problems.push(`${id}: invalid now`);
  for (const locale of ['en', 'da'] as const) {
    const docs = typeof scenario.docs === 'function' ? scenario.docs({ locale }) : (scenario.docs ?? {});
    for (const [docPath, data] of Object.entries(docs)) checkDoc(`${id} (${locale})`, docPath, data);
    const uid = scenario.user?.uid;
    if (scenario.user?.claims?.onb === true && uid && !docs[`users/${uid}`]) {
      problems.push(`${id}: an onboarded user needs users/${uid} (screens wait for the profile)`);
    }
    if (typeof scenario.docs !== 'function') break;
  }
}

interface ScreenEntry {
  readonly id: string;
  readonly route: string;
  readonly scenario: string;
  readonly storyboard: string | null;
}
const screensFile = path.join(here, 'screens.json');
const screens = (JSON.parse(readFileSync(screensFile, 'utf8')) as { screens: ScreenEntry[] }).screens;
const storyboardDir = process.env.PREVIEW_STORYBOARDS;
const seen = new Set<string>();
for (const s of screens) {
  if (seen.has(s.id)) problems.push(`screens.json: duplicate id ${s.id}`);
  seen.add(s.id);
  if (!ids.has(s.scenario)) problems.push(`screens.json: ${s.id}: unknown scenario "${s.scenario}"`);
  if (!s.route.startsWith('/')) problems.push(`screens.json: ${s.id}: route must start with /`);
  if (s.storyboard && storyboardDir && !existsSync(path.join(storyboardDir, s.storyboard))) {
    problems.push(`screens.json: ${s.id}: storyboard ${s.storyboard} not found in ${storyboardDir}`);
  }
}

if (problems.length > 0) {
  console.error(`preview:check found ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`preview:check ok: ${ids.size} scenarios, ${screens.length} screens`);
