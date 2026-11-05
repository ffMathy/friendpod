import { geohashCentroid, type LatLon } from './geohash';

/** IUGG mean Earth radius. */
export const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** H2 distance: haversine between the two cells' centroids (§6.1). */
export function cellDistanceKm(gh5a: string, gh5b: string): number {
  return gh5a === gh5b ? 0 : haversineKm(geohashCentroid(gh5a), geohashCentroid(gh5b));
}
