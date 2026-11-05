/**
 * Regenerates src/geo/areas.json: the static launch areas (DESIGN.md §6.4, A24).
 *
 *   npm -w packages/core run gen:areas
 *
 * [A] Approximation for the scaffold: an area is every geohash-5 cell whose centroid lies within
 * RADIUS_KM of the city centre. §6.4 asks for cells drawn from municipality boundaries plus a margin;
 * replace these lists before any area goes live. The circles include some sea cells, which is harmless
 * (nobody's home cell is there). Statuses start as 'waitlist'; go-live is an admin CLI change.
 *
 * Founder decision 2026-11-05: five launch cities (Aarhus, Copenhagen, Aalborg, Odense, Vejle), every one on the
 * alpha profile and on the waitlist, each with an in-app waitlist goal of WAITLIST_GOAL sign-ups [A].
 */
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGeohash, geohashBounds, geohashCentroid } from '../src/geo/geohash';
import { haversineKm } from '../src/geo/haversine';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/geo/areas.json');
const RADIUS_KM = 20;
/** [A] The in-app waitlist counter's goal ("N of 250"), per city; go-live itself still follows Q11 (`goal.optedIn`). */
const WAITLIST_GOAL = 250;

const AREAS = [
  { id: 'aarhus', label: { da: 'Aarhus', en: 'Aarhus' }, center: { lat: 56.1535, lon: 10.2034 }, profile: 'alpha' },
  { id: 'copenhagen', label: { da: 'København', en: 'Copenhagen' }, center: { lat: 55.6759, lon: 12.5691 }, profile: 'alpha' },
  { id: 'aalborg', label: { da: 'Aalborg', en: 'Aalborg' }, center: { lat: 57.0488, lon: 9.9217 }, profile: 'alpha' },
  { id: 'odense', label: { da: 'Odense', en: 'Odense' }, center: { lat: 55.3959, lon: 10.3883 }, profile: 'alpha' },
  { id: 'vejle', label: { da: 'Vejle', en: 'Vejle' }, center: { lat: 55.7093, lon: 9.5357 }, profile: 'alpha' },
] as const;

function cellsWithin(center: { lat: number; lon: number }, radiusKm: number): string[] {
  const seed = geohashBounds(encodeGeohash(center.lat, center.lon, 5));
  const dLat = seed.maxLat - seed.minLat;
  const dLon = seed.maxLon - seed.minLon;
  const latSteps = Math.ceil(radiusKm / 110 / dLat) + 1;
  const lonSteps = Math.ceil(radiusKm / (111.3 * Math.cos((center.lat * Math.PI) / 180)) / dLon) + 1;
  const cells = new Set<string>();
  for (let i = -latSteps; i <= latSteps; i++) {
    for (let j = -lonSteps; j <= lonSteps; j++) {
      const cell = encodeGeohash(center.lat + i * dLat, center.lon + j * dLon, 5);
      if (haversineKm(center, geohashCentroid(cell)) <= radiusKm) cells.add(cell);
    }
  }
  return [...cells].sort();
}

async function main(): Promise<void> {
  const doc = {
    version: 2,
    note: `[A] Approximation: geohash-5 cells whose centroid is within ${RADIUS_KM} km of the city centre (packages/core/scripts/gen-areas.ts). DESIGN.md §6.4 asks for municipality boundaries plus a margin before go-live.`,
    areas: AREAS.map((a) => ({
      id: a.id,
      label: a.label,
      status: 'waitlist',
      profile: a.profile,
      goal: { waitlist: WAITLIST_GOAL, optedIn: 200, predictedMatchRate: 0.5, consecutiveWeeks: 2 },
      approximation: { method: 'centroid-within-radius', center: a.center, radiusKm: RADIUS_KM },
      cells: cellsWithin(a.center, RADIUS_KM),
    })),
  };
  await writeFile(OUT, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(doc.areas.map((a) => `${a.id}: ${a.cells.length} cells`).join('\n'));
}

await main();
