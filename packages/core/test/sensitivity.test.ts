import { describe, expect, it } from 'vitest';
import { sha256Hex, nodeHmacSha256 } from '../src/node';
import { decideSensitivity, type SensitivitySignals } from '../src/interests/sensitivity';
import { assertV2ThresholdFloors, DEFAULT_ASSIGN_THRESHOLDS, decideAssignment, newConceptId, PartitionMismatchError, V1_ASSIGN_THRESHOLDS } from '../src/interests/assign';
import { EMBEDDING_MODEL_ID, EMBEDDING_MODEL_ID_V1, tagKeyMaterial } from '../src/interests/model';

const base: SensitivitySignals = {
  lexiconHit: false,
  detectorMargin: -0.2,
  knownOrdinary: false,
  selfFlagPrivate: false,
  notSensitiveForMe: false,
  thirdParty: false,
  hasArt9Consent: true,
};
const decide = (s: Partial<SensitivitySignals>) => decideSensitivity({ ...base, ...s });

describe('sensitivity (§5.2 (5), D2, D3): lexicon > known-ordinary > detector; holding flags on top', () => {
  it('ordinary when no signal fires', () => {
    expect(decide({})).toMatchObject({ tag: 'ordinary', tagSource: null, holdingSensitive: false, outcome: 'ordinary', overridden: false });
  });

  it('a lexicon hit makes the tag sensitive without the detector, and beats the known-ordinary list', () => {
    expect(decide({ lexiconHit: true, detectorMargin: null })).toMatchObject({ tag: 'sensitive', tagSource: 'lexicon', holdingSource: 'lexicon', outcome: 'sensitive' });
    expect(decide({ lexiconHit: true, knownOrdinary: true })).toMatchObject({ tag: 'sensitive', tagSource: 'lexicon' });
  });

  it('the detector flags at margin ≥ −0.03 and fails closed when the margin is missing or not finite', () => {
    expect(decide({ detectorMargin: -0.03 })).toMatchObject({ tag: 'sensitive', tagSource: 'model', holdingSource: 'model', outcome: 'sensitive' });
    expect(decide({ detectorMargin: -0.0301 })).toMatchObject({ tag: 'ordinary' });
    expect(decideSensitivity({ ...base, detectorMargin: 0.005 }, 0.01)).toMatchObject({ tag: 'ordinary' });
    expect(decide({ detectorMargin: null }).tag).toBe('sensitive');
    expect(decide({ detectorMargin: Number.NaN }).tag).toBe('sensitive');
  });

  it('the known-ordinary list turns a detector flag off', () => {
    expect(decide({ detectorMargin: 0.2, knownOrdinary: true })).toMatchObject({ tag: 'ordinary', tagSource: 'knownOrdinary', outcome: 'ordinary' });
    expect(decide({ detectorMargin: null, knownOrdinary: true })).toMatchObject({ tag: 'ordinary' });
  });

  it('"Keep this private" makes only the holding sensitive', () => {
    expect(decide({ selfFlagPrivate: true })).toMatchObject({ tag: 'ordinary', holdingSensitive: true, holdingSource: 'self', outcome: 'sensitive' });
    expect(decide({ selfFlagPrivate: true, knownOrdinary: true })).toMatchObject({ holdingSource: 'self' });
    expect(decide({ selfFlagPrivate: true, lexiconHit: true })).toMatchObject({ holdingSource: 'lexicon' });
    // Contradictory flags (the schema refuses them) fail safe: private wins.
    expect(decide({ selfFlagPrivate: true, notSensitiveForMe: true, lexiconHit: true })).toMatchObject({ holdingSensitive: true, overridden: false });
  });

  it('"This isn\'t sensitive for me" makes a sensitive tag ordinary for this holding only', () => {
    expect(decide({ lexiconHit: true, notSensitiveForMe: true })).toMatchObject({ tag: 'sensitive', holdingSensitive: false, overridden: true, outcome: 'ordinary' });
    expect(decide({ detectorMargin: 0.1, notSensitiveForMe: true, hasArt9Consent: false })).toMatchObject({ overridden: true, outcome: 'ordinary' });
    expect(decide({ notSensitiveForMe: true })).toMatchObject({ overridden: false, outcome: 'ordinary' });
  });

  it('refuses a sensitive holding without the blanket consent, so refusing consent costs only those tags', () => {
    expect(decide({ lexiconHit: true, hasArt9Consent: false })).toMatchObject({ holdingSensitive: true, outcome: 'refuseNoConsent' });
    expect(decide({ selfFlagPrivate: true, hasArt9Consent: false })).toMatchObject({ outcome: 'refuseNoConsent' });
    expect(decide({ hasArt9Consent: false })).toMatchObject({ outcome: 'ordinary' });
  });

  it('refuses sensitive third-party tags even with consent or an override, and only warns on ordinary ones', () => {
    expect(decide({ thirdParty: true, lexiconHit: true })).toMatchObject({ outcome: 'refuseThirdParty', holdingSensitive: false });
    expect(decide({ thirdParty: true, detectorMargin: 0 })).toMatchObject({ outcome: 'refuseThirdParty' });
    expect(decide({ thirdParty: true, lexiconHit: true, notSensitiveForMe: true })).toMatchObject({ outcome: 'refuseThirdParty' });
    expect(decide({ thirdParty: true })).toMatchObject({ outcome: 'ordinary', thirdPartyWarning: true });
    expect(decide({ thirdParty: true, detectorMargin: 0.2, knownOrdinary: true })).toMatchObject({ outcome: 'ordinary', thirdPartyWarning: true });
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
    [0.9499, { action: 'new' }],
    [0.93, { action: 'new' }],
  ] as const)('sensitive cos %d: merge or new, never a proposal (D2)', (cos, expected) => {
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
