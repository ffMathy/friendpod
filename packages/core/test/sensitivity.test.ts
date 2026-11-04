import { describe, expect, it } from 'vitest';
import { sha256Hex, nodeHmacSha256 } from '../src/node';
import { decideSensitivity, type SensitivitySignals } from '../src/interests/sensitivity';
import {
  assertV2ThresholdFloors,
  DEFAULT_ASSIGN_THRESHOLDS,
  decideAssignment,
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_ID_V1,
  newConceptId,
  PartitionMismatchError,
  tagKeyMaterial,
  V1_ASSIGN_THRESHOLDS,
} from '../src/interests/assign';

const base: SensitivitySignals = { reviewed: null, lexiconHit: false, selfFlag: false, detectorMargin: -0.2, thirdParty: false };
const decide = (s: Partial<SensitivitySignals>) => decideSensitivity({ ...base, ...s });

describe('sensitivity ordering (§5.2 (5)): reviewed > lexicon > self-flag > detector', () => {
  it('ordinary when no signal fires', () => {
    expect(decide({})).toMatchObject({ tag: 'ordinary', holdingSensitive: false, outcome: 'ordinary', queueForReview: false });
  });

  it('a review decision beats the lexicon and the detector', () => {
    expect(decide({ reviewed: 'not', lexiconHit: true, detectorMargin: 0.5 })).toMatchObject({ tag: 'ordinary', tagSource: 'review', outcome: 'ordinary' });
    expect(decide({ reviewed: 'sensitive', detectorMargin: -1 })).toMatchObject({ tag: 'sensitive', holdingSource: 'review', outcome: 'needsConsent' });
  });

  it('the lexicon decides the tag without the detector', () => {
    expect(decide({ lexiconHit: true, detectorMargin: null })).toMatchObject({ tag: 'sensitive', tagSource: 'lexicon', holdingSource: 'lexicon', queueForReview: false });
  });

  it('a self-flag makes only the holding sensitive and outranks the detector as the source', () => {
    expect(decide({ selfFlag: true })).toMatchObject({ tag: 'ordinary', holdingSensitive: true, holdingSource: 'self', outcome: 'needsConsent' });
    expect(decide({ selfFlag: true, detectorMargin: 0.1 })).toMatchObject({ tag: 'suspected', holdingSource: 'self', queueForReview: true });
    expect(decide({ selfFlag: true, reviewed: 'not' })).toMatchObject({ tag: 'ordinary', holdingSensitive: true, holdingSource: 'self' });
    expect(decide({ selfFlag: true, lexiconHit: true })).toMatchObject({ holdingSource: 'lexicon' });
  });

  it('the detector suspects at margin ≥ −0.03 and queues the tag for review', () => {
    expect(decide({ detectorMargin: -0.03 })).toMatchObject({ tag: 'suspected', tagSource: 'model', holdingSource: 'model', queueForReview: true, outcome: 'needsConsent' });
    expect(decide({ detectorMargin: -0.0301 })).toMatchObject({ tag: 'ordinary' });
    expect(decideSensitivity({ ...base, detectorMargin: 0.005 }, 0.01)).toMatchObject({ tag: 'ordinary' });
  });

  it('fails closed when the detector result is missing or not finite', () => {
    expect(decide({ detectorMargin: null }).tag).toBe('suspected');
    expect(decide({ detectorMargin: Number.NaN }).tag).toBe('suspected');
  });

  it('refuses third-party tags that are sensitive or suspected, and only warns on ordinary ones', () => {
    expect(decide({ thirdParty: true, lexiconHit: true })).toMatchObject({ outcome: 'refuseThirdParty', queueForReview: false });
    expect(decide({ thirdParty: true, detectorMargin: 0 })).toMatchObject({ outcome: 'refuseThirdParty' });
    expect(decide({ thirdParty: true })).toMatchObject({ outcome: 'ordinary', thirdPartyWarning: true });
    expect(decide({ thirdParty: true, reviewed: 'not', lexiconHit: true })).toMatchObject({ outcome: 'ordinary', thirdPartyWarning: true });
  });
});

describe('concept assignment decision table (§5.2 (6), EmbeddingGemma 2)', () => {
  const near = (cos: number, medoid = 0.95, sensitive = false, holderCount = 12) => ({ conceptId: 'c_x', sensitive, cosCentroid: cos, cosMedoid: medoid, holderCount });

  it.each([
    [0.97, 0.95, { action: 'merge', conceptId: 'c_x' }],
    [0.93, 0.91, { action: 'merge', conceptId: 'c_x' }],
    [0.93, 0.9099, { action: 'newWithLink', linkTo: 'c_x', suggest: true }],
    [0.9299, 0.95, { action: 'newWithLink', linkTo: 'c_x', suggest: true }],
    [0.9, 0.95, { action: 'newWithLink', linkTo: 'c_x', suggest: true }],
    [0.8999, 0.95, { action: 'new' }],
  ] as const)('ordinary cos %d / medoid %d', (cos, medoid, expected) => {
    expect(decideAssignment('ordinary', near(cos, medoid))).toEqual(expected);
  });

  it('suggests "Did you mean" only for concepts with ≥ 10 holders', () => {
    expect(decideAssignment('ordinary', near(0.91, 0.95, false, 9))).toEqual({ action: 'newWithLink', linkTo: 'c_x', suggest: false });
  });

  it.each([
    [0.95, { action: 'merge', conceptId: 'c_x' }],
    [0.9499, { action: 'newWithMergeProposal', proposeMergeInto: 'c_x' }],
    [0.93, { action: 'newWithMergeProposal', proposeMergeInto: 'c_x' }],
    [0.9299, { action: 'new' }],
  ] as const)('sensitive cos %d', (cos, expected) => {
    expect(decideAssignment('sensitive', near(cos, 0, true, 0))).toEqual(expected);
  });

  it('starts a new concept when nothing is near', () => {
    expect(decideAssignment('ordinary', null)).toEqual({ action: 'new' });
  });

  it('never compares across partitions: a mismatch fails closed', () => {
    expect(() => decideAssignment('ordinary', near(0.99, 0.99, true))).toThrow(PartitionMismatchError);
    expect(() => decideAssignment('sensitive', near(0.99, 0.99, false))).toThrow(PartitionMismatchError);
  });

  it('takes thresholds as parameters, including the calibrated v1 fallback', () => {
    expect(decideAssignment('ordinary', near(0.94, 0.95), { ...DEFAULT_ASSIGN_THRESHOLDS, ordinaryMerge: 0.95 }).action).toBe('newWithLink');
    expect(decideAssignment('ordinary', near(0.86, 0.82), V1_ASSIGN_THRESHOLDS)).toEqual({ action: 'merge', conceptId: 'c_x' });
    expect(decideAssignment('ordinary', near(0.8, 0.9), V1_ASSIGN_THRESHOLDS).action).toBe('newWithLink');
  });

  it('enforces the v2 floors: never below 0.90, never merge below 0.925', () => {
    expect(() => assertV2ThresholdFloors(DEFAULT_ASSIGN_THRESHOLDS)).not.toThrow();
    expect(() => assertV2ThresholdFloors(V1_ASSIGN_THRESHOLDS)).toThrow();
    expect(() => assertV2ThresholdFloors({ ...DEFAULT_ASSIGN_THRESHOLDS, ordinaryMerge: 0.92 })).toThrow();
    expect(() => assertV2ThresholdFloors({ ...DEFAULT_ASSIGN_THRESHOLDS, ordinaryLink: 0.89 })).toThrow();
  });

  it('derives cache keys and concept ids deterministically', async () => {
    expect(EMBEDDING_MODEL_ID).toBe('eg2-q4@daa72c5');
    expect(tagKeyMaterial('madlavning')).toBe('eg2-q4@daa72c5|768|sts|madlavning');
    expect(tagKeyMaterial('madlavning', EMBEDDING_MODEL_ID_V1)).toBe('eg300m-q4@5090578|768|sts|madlavning');
    const hmac = nodeHmacSha256(new Uint8Array(32).fill(3));
    const key = 'ab'.repeat(32);
    const own = await newConceptId(hmac, key, false);
    expect(own).toMatch(/^c_[0-9a-f]{20}$/);
    expect(await newConceptId(hmac, key, false)).toBe(own);
    const priv = await newConceptId(hmac, key, true);
    expect(priv).toMatch(/^c_[0-9a-f]{20}_p$/);
    // The private id is not the ordinary id plus a suffix.
    expect(priv.slice(0, -2)).not.toBe(own);
    await expect(newConceptId(hmac, 'nothex', false)).rejects.toThrow();
  });

  it('concept ids cannot be recovered from the text with a dictionary (keyed, not a prefix of tagKey)', async () => {
    const hmac = nodeHmacSha256(new Uint8Array(32).fill(3));
    const tagKey = sha256Hex(tagKeyMaterial('hiv-positiv'));
    const id = await newConceptId(hmac, tagKey, false);
    expect(id).not.toBe(`c_${tagKey.slice(0, 20)}`);
    expect(id).not.toContain(tagKey.slice(0, 8));
    expect(await newConceptId(nodeHmacSha256(new Uint8Array(32).fill(4)), tagKey, false)).not.toBe(id);
  });
});
