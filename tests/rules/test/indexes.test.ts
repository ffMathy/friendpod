/**
 * Invariants of firestore.indexes.json (DESIGN.md §8 "Indexes"). `firebase deploy --force` deletes every index and
 * field override missing from the file, so a dropped TTL policy or exemption would change production; this guards them.
 * The shape itself is checked by scripts/validate-indexes.mjs with firebase-tools' own validator.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface IndexField {
  fieldPath: string;
  order?: string;
  arrayConfig?: string;
  vectorConfig?: { dimension: number; flat: Record<string, never> };
}
interface FieldOverride {
  collectionGroup: string;
  fieldPath: string;
  ttl?: boolean;
  indexes: { order?: string; arrayConfig?: string; queryScope: string }[];
}
interface IndexSpec {
  indexes: { collectionGroup: string; queryScope: string; fields: IndexField[] }[];
  fieldOverrides: FieldOverride[];
}

const spec = JSON.parse(readFileSync(new URL('../../../firestore.indexes.json', import.meta.url), 'utf8')) as IndexSpec;
const override = (group: string, field: string) => spec.fieldOverrides.find((f) => f.collectionGroup === group && f.fieldPath === field);
const shape = (fields: IndexField[]) => fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig ?? 'VECTOR'}`);

/** Every collection group with an `expiresAt` TTL in DESIGN.md §8 / PRIVACY.md §5. */
const TTL_GROUPS = [
  'pods', // users/{uid}/pods cards; top-level pods never carry expiresAt
  'notices',
  'exports',
  'consentEvents',
  'reports',
  'bans',
  'reviewQueue',
  'rateLimits',
  'erasureLedger',
  'underageMarkers',
];

describe('firestore.indexes.json', () => {
  it('has the two flat 768-d vector indexes on concepts, prefiltered by sensitive + status (+ gen)', () => {
    const vector = spec.indexes.filter((i) => i.fields.some((f) => f.vectorConfig));
    expect(vector.map((i) => [i.collectionGroup, i.queryScope, ...shape(i.fields)])).toEqual([
      ['concepts', 'COLLECTION', 'sensitive:ASCENDING', 'status:ASCENDING', 'centroid:VECTOR'],
      ['concepts', 'COLLECTION', 'sensitive:ASCENDING', 'status:ASCENDING', 'gen:ASCENDING', 'centroid:VECTOR'],
    ]);
    for (const index of vector) {
      expect(index.fields.at(-1)?.vectorConfig).toEqual({ dimension: 768, flat: {} });
    }
  });

  it('keeps single-field indexing of concepts.centroid at its default', () => {
    expect(override('concepts', 'centroid')).toBeUndefined();
  });

  it('has the backfill-pool composite on matchProfiles', () => {
    const backfill = spec.indexes.find((i) => i.collectionGroup === 'matchProfiles');
    expect(backfill && shape(backfill.fields)).toEqual(['themeIds:CONTAINS', 'lastDrop.weekId:ASCENDING', 'lastDrop.outcome:ASCENDING']);
  });

  it('has collection-group indexes on interests.conceptId and sensitiveInterests.conceptId', () => {
    for (const group of ['interests', 'sensitiveInterests']) {
      expect(override(group, 'conceptId')?.indexes).toContainEqual({ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' });
    }
  });

  it('indexes podState.memberList for array-contains (erasure and withdrawal queries)', () => {
    expect(override('podState', 'memberList')?.indexes).toEqual([{ arrayConfig: 'CONTAINS', queryScope: 'COLLECTION' }]);
  });

  it('leaves matchProfiles.blockedH and recentH on automatic indexing (erasure queries them)', () => {
    expect(override('matchProfiles', 'blockedH')).toBeUndefined();
    expect(spec.fieldOverrides.filter((f) => f.collectionGroup === 'matchProfiles' && f.fieldPath.startsWith('recentH'))).toEqual([]);
  });

  it('exempts the large fields from automatic indexing', () => {
    for (const [group, field] of [
      ['tags', 'vec'],
      ['concepts', 'medoid'],
      ['concepts', 'sum'],
      ['concepts', 'c128'],
      ['podState', 'members'],
      ['pods', 'roster'],
    ] as const) {
      expect(override(group, field), `${group}.${field}`).toEqual({ collectionGroup: group, fieldPath: field, indexes: [] });
    }
  });

  it('declares an unindexed expiresAt TTL policy for exactly the TTL collection groups', () => {
    const ttl = spec.fieldOverrides.filter((f) => f.ttl === true);
    expect(ttl.map((f) => f.collectionGroup).sort()).toEqual([...TTL_GROUPS].sort());
    for (const f of ttl) expect(f, f.collectionGroup).toEqual({ collectionGroup: f.collectionGroup, fieldPath: 'expiresAt', ttl: true, indexes: [] });
  });

  it('has at most one override per collection group and field', () => {
    const keys = spec.fieldOverrides.map((f) => `${f.collectionGroup}.${f.fieldPath}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
