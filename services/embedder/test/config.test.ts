import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ASSIGN_THRESHOLDS,
  DETECTOR_MARGIN_THRESHOLD,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_ID_V1,
  V1_ASSIGN_THRESHOLDS,
  tagKeyMaterial,
} from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { ART9_HOLDINGS_ENABLED, MODEL, MODELS, PROMPTS } from '../src/config';
import { tagKeyFor } from '../src/tags';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('config', () => {
  it('accepts no sensitive holdings while withdrawSensitive and removeInterest are stubs (Art. 7(3))', () => {
    const callables = readFileSync(fileURLToPath(new URL('../../../functions/src/callables/index.ts', import.meta.url)), 'utf8');
    const withdrawalIsStub = /export const (withdrawSensitive|removeInterest) = stub\(/.test(callables);
    expect(ART9_HOLDINGS_ENABLED && withdrawalIsStub).toBe(false);
  });

  it('runs EmbeddingGemma 2 q4 with the [CAL] thresholds from core, and keeps v1 as the fallback', () => {
    expect(MODEL).toBe(MODELS.v2);
    expect(MODEL.modelId).toBe(EMBEDDING_MODEL_ID);
    expect(MODEL.revision.startsWith(EMBEDDING_MODEL_ID.split('@')[1]!)).toBe(true);
    expect(MODEL.assign).toEqual(DEFAULT_ASSIGN_THRESHOLDS);
    expect(MODEL.detectorMargin).toBe(DETECTOR_MARGIN_THRESHOLD);
    expect(MODEL.tagPrompt).toBe(PROMPTS.sts);
    expect(MODEL.detectorPrompt).toBe(PROMPTS.sts);
    expect(MODEL.dim).toBe(768);
    expect(MODELS.v1.modelId).toBe(EMBEDDING_MODEL_ID_V1);
    expect(MODELS.v1.revision.startsWith(EMBEDDING_MODEL_ID_V1.split('@')[1]!)).toBe(true);
    expect(MODELS.v1.assign).toEqual(V1_ASSIGN_THRESHOLDS);
    expect(MODELS.v1.detectorPrompt).toBe(PROMPTS.classification);
  });

  it('pins every model file by content hash', () => {
    for (const m of Object.values(MODELS)) {
      expect(m.files.some((f) => f.path === `onnx/model_${m.dtype}.onnx`)).toBe(true);
      for (const f of m.files) {
        if ('sha256' in f) expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
        else expect(f.gitBlobSha1).toMatch(/^[0-9a-f]{40}$/);
      }
    }
  });

  it('puts the modelId into every cache key', () => {
    expect(tagKeyMaterial('madlavning', MODEL.modelId)).toBe(`${MODEL.modelId}|768|sts|madlavning`);
    expect(tagKeyFor('madlavning', MODELS.v2.modelId)).not.toBe(tagKeyFor('madlavning', MODELS.v1.modelId));
    expect(tagKeyFor('madlavning', MODEL.modelId)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is the only source file that names a model, prompt or threshold', () => {
    const forbidden = [
      /\b0\.(?:78|8[26]|9[0135]|925)\b/, // assignment thresholds of either model
      /-0\.03\b/, // detector margin
      /embeddinggemma/i,
      /eg2-q4|eg300m-q4/,
      /task: (?:sentence similarity|classification)/,
      /\b768\b/,
    ];
    const offenders = sourceFiles(SRC)
      .filter((f) => !f.endsWith('config.ts'))
      .flatMap((f) => {
        const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        return forbidden.filter((re) => re.test(text)).map((re) => `${f}: ${re}`);
      });
    expect(offenders).toEqual([]);
  });
});
