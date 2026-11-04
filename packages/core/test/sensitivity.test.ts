import { describe, expect, it } from 'vitest';
import { decideSensitivity, type SensitivitySignals } from '../src/interests/sensitivity';
import { DEFAULT_ASSIGN_THRESHOLDS, decideAssignment, newConceptId, PartitionMismatchError, tagKeyMaterial } from '../src/interests/assign';

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

describe('concept assignment decision table (§5.2 (6))', () => {
  const near = (cos: number, medoid = 0.9, sensitive = false, holderCount = 12) => ({ conceptId: 'c_x', sensitive, cosCentroid: cos, cosMedoid: medoid, holderCount });

  it.each([
    [0.95, 0.9, { action: 'merge', conceptId: 'c_x' }],
    [0.86, 0.82, { action: 'merge', conceptId: 'c_x' }],
    [0.86, 0.81, { action: 'newWithLink', linkTo: 'c_x', suggest: true }],
    [0.85, 0.9, { action: 'newWithLink', linkTo: 'c_x', suggest: true }],
    [0.78, 0.9, { action: 'newWithLink', linkTo: 'c_x', suggest: true }],
    [0.7799, 0.9, { action: 'new' }],
  ] as const)('ordinary cos %d / medoid %d', (cos, medoid, expected) => {
    expect(decideAssignment('ordinary', near(cos, medoid))).toEqual(expected);
  });

  it('suggests "Did you mean" only for concepts with ≥ 10 holders', () => {
    expect(decideAssignment('ordinary', near(0.8, 0.9, false, 9))).toEqual({ action: 'newWithLink', linkTo: 'c_x', suggest: false });
  });

  it.each([
    [0.9, { action: 'merge', conceptId: 'c_x' }],
    [0.8999, { action: 'newWithMergeProposal', proposeMergeInto: 'c_x' }],
    [0.86, { action: 'newWithMergeProposal', proposeMergeInto: 'c_x' }],
    [0.8599, { action: 'new' }],
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

  it('takes thresholds as parameters', () => {
    expect(decideAssignment('ordinary', near(0.9, 0.9), { ...DEFAULT_ASSIGN_THRESHOLDS, ordinaryMerge: 0.95 }).action).toBe('newWithLink');
  });

  it('derives cache keys and concept ids deterministically', () => {
    expect(tagKeyMaterial('madlavning')).toBe('eg300m-q4@5090578|768|sts|madlavning');
    const key = 'ab'.repeat(32);
    expect(newConceptId(key, false)).toBe('c_abababababababababab');
    expect(newConceptId(key, true)).toBe('c_abababababababababab_p');
    expect(() => newConceptId('nothex', false)).toThrow();
  });
});
