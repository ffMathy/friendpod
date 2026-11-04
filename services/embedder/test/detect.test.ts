import { ART9_CATEGORIES } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { MODEL, MODELS } from '../src/config';
import {
  abuseShadowLevel,
  computePrototypes,
  decodePrototypes,
  detectorMargin,
  encodePrototypes,
  PROTOTYPE_LISTS,
  prototypeFingerprint,
  StalePrototypesError,
} from '../src/detect';
import { StubEmbedder } from '../src/model';

describe('prototype lists', () => {
  it('carry the calibrated phrases with core categories', () => {
    expect(PROTOTYPE_LISTS.art9).toHaveLength(110);
    expect(new Set(PROTOTYPE_LISTS.art9.map((p) => p.category))).toEqual(new Set(ART9_CATEGORIES));
    expect(PROTOTYPE_LISTS.anchors).toHaveLength(31);
    expect(new Set(PROTOTYPE_LISTS.anchors).size).toBe(31);
    expect(PROTOTYPE_LISTS.abuse.length).toBeGreaterThan(0);
  });
});

describe('detector', () => {
  const stub = new StubEmbedder(MODEL.modelId, MODEL.dim, {
    'venter tvillinger': { to: 'pregnancy and expecting a baby', cos: 0.9 },
    brætspil: { to: 'games', cos: 0.9 },
    nudes: { to: 'sending nude photos', cos: 0.9 },
  });

  it('flags tags near an Art. 9 prototype and clears tags near a hobby anchor', async () => {
    const p = await computePrototypes(stub, MODEL, PROTOTYPE_LISTS);
    const sensitive = detectorMargin(stub.vector('venter tvillinger'), p);
    expect(sensitive.margin).toBeGreaterThan(MODEL.detectorMargin);
    expect(sensitive.categoryGuess).toBe('health');
    expect(detectorMargin(stub.vector('brætspil'), p).margin).toBeLessThan(MODEL.detectorMargin);
    expect(abuseShadowLevel(stub.vector('nudes'), p)).toBe('reject');
    expect(abuseShadowLevel(stub.vector('brætspil'), p)).toBe('ok');
  });

  it('embeds detector prototypes with the detector prompt and abuse prototypes with the tag prompt', async () => {
    const v1Stub = new StubEmbedder(MODELS.v1.modelId, MODELS.v1.dim);
    await computePrototypes(v1Stub, MODELS.v1, PROTOTYPE_LISTS);
    expect(v1Stub.calls.map((c) => c.prompt)).toEqual([MODELS.v1.detectorPrompt, MODELS.v1.detectorPrompt, MODELS.v1.tagPrompt]);
    await expect(computePrototypes(stub, MODELS.v1, PROTOTYPE_LISTS)).rejects.toThrow(/disagree/);
  });
});

describe('prototypes.bin', () => {
  it('round-trips and refuses a file built for other phrases or another model', async () => {
    const stub = new StubEmbedder(MODEL.modelId, MODEL.dim);
    const p = await computePrototypes(stub, MODEL, PROTOTYPE_LISTS);
    const bin = encodePrototypes(p, MODEL);
    const back = decodePrototypes(bin, MODEL, PROTOTYPE_LISTS);
    expect(back.fingerprint).toBe(p.fingerprint);
    expect(back.art9Categories).toEqual(p.art9Categories);
    expect(Array.from(back.anchors[3]!)).toEqual(Array.from(p.anchors[3]!));
    expect(Array.from(back.abuse.at(-1)!)).toEqual(Array.from(p.abuse.at(-1)!));

    const edited = { ...PROTOTYPE_LISTS, anchors: [...PROTOTYPE_LISTS.anchors, 'knitting'] };
    expect(prototypeFingerprint(MODEL, edited)).not.toBe(p.fingerprint);
    expect(() => decodePrototypes(bin, MODEL, edited)).toThrow(StalePrototypesError);
    expect(() => decodePrototypes(bin, MODELS.v1, PROTOTYPE_LISTS)).toThrow(StalePrototypesError);
    expect(() => decodePrototypes(bin.subarray(0, bin.length - 4), MODEL, PROTOTYPE_LISTS)).toThrow(StalePrototypesError);
    expect(() => decodePrototypes(Buffer.from('not a prototype file'), MODEL, PROTOTYPE_LISTS)).toThrow(StalePrototypesError);
  });
});
