import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getLaunchArea, LAUNCH_AREAS, resolveAreaId } from '../src/geo/areas';
import { areaDocFromConfig, cityLinkPath, isWaitlisted, waitlistDisplay, waitlistProgress } from '../src/geo/waitlist';
import { FUNNEL_NO_AREA } from '../src/metrics/funnel';
import { areaDocSchema } from '../src/schemas/documents';
import { encodeGeohash, geohashBounds, geohashCentroid, isGh5 } from '../src/geo/geohash';
import { cellDistanceKm, haversineKm } from '../src/geo/haversine';
import { lookupPostcode, postcodeToGh5 } from '../src/geo/postcode';

describe('geohash', () => {
  it('matches known encodings', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
    expect(encodeGeohash(56.1535, 10.2034, 5)).toBe('u1zr2');
    expect(encodeGeohash(55.6759, 12.5691, 5)).toBe('u3buw');
  });

  it('round-trips: a point lies inside the bounds of its own cell', () => {
    fc.assert(
      fc.property(fc.double({ min: -89.9, max: 89.9, noNaN: true }), fc.double({ min: -179.9, max: 179.9, noNaN: true }), fc.integer({ min: 1, max: 9 }), (lat, lon, precision) => {
        const b = geohashBounds(encodeGeohash(lat, lon, precision));
        expect(lat).toBeGreaterThanOrEqual(b.minLat);
        expect(lat).toBeLessThanOrEqual(b.maxLat);
        expect(lon).toBeGreaterThanOrEqual(b.minLon);
        expect(lon).toBeLessThanOrEqual(b.maxLon);
      }),
    );
  });

  it('gh5 cells are about 2.7 × 4.9 km at 56°N', () => {
    const b = geohashBounds('u1zr2');
    const ew = haversineKm({ lat: 56.15, lon: b.minLon }, { lat: 56.15, lon: b.maxLon });
    const ns = haversineKm({ lat: b.minLat, lon: 10.2 }, { lat: b.maxLat, lon: 10.2 });
    expect(ew).toBeCloseTo(2.7, 1);
    expect(ns).toBeCloseTo(4.9, 1);
  });

  it('validates gh5 strings and rejects bad input', () => {
    expect(isGh5('u1zr2')).toBe(true);
    expect(isGh5('u1zra')).toBe(false);
    expect(isGh5('u1zr')).toBe(false);
    expect(() => geohashBounds('u1zri')).toThrow();
    expect(() => encodeGeohash(91, 0)).toThrow();
  });
});

describe('haversine', () => {
  it('Aarhus–Copenhagen is about 157 km', () => {
    expect(haversineKm({ lat: 56.1535, lon: 10.2034 }, { lat: 55.6759, lon: 12.5691 })).toBeCloseTo(157, -1);
  });

  it('is symmetric, zero on the diagonal and satisfies the triangle inequality', () => {
    const pt = fc.record({ lat: fc.double({ min: 54, max: 58, noNaN: true }), lon: fc.double({ min: 8, max: 15, noNaN: true }) });
    fc.assert(
      fc.property(pt, pt, pt, (a, b, c) => {
        expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
        expect(haversineKm(a, a)).toBe(0);
        expect(haversineKm(a, c)).toBeLessThanOrEqual(haversineKm(a, b) + haversineKm(b, c) + 1e-9);
      }),
    );
  });

  it('measures H2 distance between cell centroids', () => {
    expect(cellDistanceKm('u1zr2', 'u1zr2')).toBe(0);
    const c = geohashCentroid('u1zr2');
    const d = geohashCentroid('u1zr8');
    expect(cellDistanceKm('u1zr2', 'u1zr8')).toBeCloseTo(haversineKm(c, d), 9);
  });
});

describe('postcodes and launch areas', () => {
  it('converts a postcode to the gh5 of its centroid', () => {
    expect(lookupPostcode('8000')).toMatchObject({ name: 'Aarhus C' });
    expect(postcodeToGh5('8000')).toBe('u1zr2');
    expect(postcodeToGh5(' 2100 ')).toMatch(/^u3b/);
    expect(postcodeToGh5('0999')).toBeNull();
    expect(postcodeToGh5('80000')).toBeNull();
    expect(postcodeToGh5('abcd')).toBeNull();
  });

  it('resolves the five launch cities\' postcodes to their launch areas', () => {
    for (const pc of ['8000', '8200', '8210', '8220', '8230', '8240', '8260', '8270']) expect(resolveAreaId(postcodeToGh5(pc)!)).toBe('aarhus');
    for (const pc of ['1050', '2100', '2200', '2300', '2400', '2500', '1900']) expect(resolveAreaId(postcodeToGh5(pc)!)).toBe('copenhagen');
    for (const pc of ['9000', '9200', '9400']) expect(resolveAreaId(postcodeToGh5(pc)!)).toBe('aalborg');
    for (const pc of ['5000', '5200', '5230']) expect(resolveAreaId(postcodeToGh5(pc)!)).toBe('odense');
    for (const pc of ['7100', '7120']) expect(resolveAreaId(postcodeToGh5(pc)!)).toBe('vejle');
    // Esbjerg, Herning, Rønne: not launch areas.
    for (const pc of ['6700', '7400', '3700']) expect(resolveAreaId(postcodeToGh5(pc)!)).toBeNull();
  });

  it('ships five cities on the waitlist and the alpha profile, with disjoint cells, a 250 goal and a documented approximation', () => {
    expect(LAUNCH_AREAS.map((a) => a.id)).toEqual(['aarhus', 'copenhagen', 'aalborg', 'odense', 'vejle']);
    expect(LAUNCH_AREAS.map((a) => a.label)).toEqual([
      { da: 'Aarhus', en: 'Aarhus' },
      { da: 'København', en: 'Copenhagen' },
      { da: 'Aalborg', en: 'Aalborg' },
      { da: 'Odense', en: 'Odense' },
      { da: 'Vejle', en: 'Vejle' },
    ]);
    const seen = new Set<string>();
    for (const a of LAUNCH_AREAS) {
      expect(a.status).toBe('waitlist');
      expect(a.profile).toBe('alpha');
      expect(a.goal.waitlist).toBe(250);
      expect(a.approximation?.radiusKm).toBe(20);
      expect(a.cells.length).toBeGreaterThan(80);
      for (const cell of a.cells) {
        expect(seen.has(cell)).toBe(false);
        seen.add(cell);
        expect(haversineKm(a.approximation!.center, geohashCentroid(cell))).toBeLessThanOrEqual(20);
      }
      expect(a.id).not.toBe(FUNNEL_NO_AREA);
    }
    expect(getLaunchArea('esbjerg')).toBeNull();
  });
});

describe('in-app waitlist (§3.1 step 12)', () => {
  it('shows "<10" below 10 and the exact city total from 10', () => {
    expect([0, 1, 9, 10, 11, 250, 1234].map(waitlistDisplay)).toEqual(['<10', '<10', '<10', 10, 11, 250, 1234]);
  });

  it('clamps progress to 0..1 and treats waitlist and beta as not live', () => {
    expect(waitlistProgress(0, 250)).toBe(0);
    expect(waitlistProgress(125, 250)).toBe(0.5);
    expect(waitlistProgress(400, 250)).toBe(1);
    expect(['waitlist', 'beta', 'live', null].map((s) => isWaitlisted(s as never))).toEqual([true, true, false, false]);
  });

  it('builds the city link from the area id only, and the area doc from areas.json', () => {
    expect(cityLinkPath('aalborg')).toBe('/c/aalborg');
    expect(() => cityLinkPath('../x')).toThrow();
    const doc = areaDocFromConfig(getLaunchArea('vejle')!, 3);
    expect(areaDocSchema.parse(doc)).toEqual(doc);
    expect(doc).toMatchObject({ label: { da: 'Vejle', en: 'Vejle' }, status: 'waitlist', profile: 'alpha', waitlistCount: 3, goal: { waitlist: 250 }, chips: [] });
    expect(areaDocFromConfig(getLaunchArea('vejle')!, -2, 'live')).toMatchObject({ waitlistCount: 0, status: 'live' });
  });

  it('lists every launch area on the hosted city page (hosting/public/c/city.js)', () => {
    const page = readFileSync(new URL('../../../hosting/public/c/city.js', import.meta.url), 'utf8');
    for (const a of LAUNCH_AREAS) {
      expect(page).toContain(`${a.id}: { da: '${a.label.da}', en: '${a.label.en}' }`);
    }
  });
});
});
