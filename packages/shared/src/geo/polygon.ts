/**
 * Polygon tests and distances for trigger, ambience, and music.
 * No geometry dependency (M4a plan G1).
 *
 * GeoJSON rings are [lng, lat]. The first ring is the exterior; the rest are holes.
 */

const EARTH_RADIUS_M = 6_371_000;

export type LatLng = {
  lat: number;
  lng: number;
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const dφ = toRad(b.lat - a.lat);
  const dλ = toRad(b.lng - a.lng);
  const h =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

type RingPoint = { lng: number; lat: number };

function ringPoint(ring: readonly number[][], index: number): RingPoint | null {
  const pair = ring[index];
  if (!pair) return null;
  const lng = pair[0];
  const lat = pair[1];
  if (lng === undefined || lat === undefined) return null;
  return { lng, lat };
}

/** Even-odd ray cast. Points exactly on an edge are not a supported case. */
function pointInRing(point: LatLng, ring: readonly number[][]): boolean {
  let inside = false;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ringPoint(ring, i);
    const b = ringPoint(ring, (i + 1) % ring.length);
    if (!a || !b) continue;
    if (a.lng === b.lng && a.lat === b.lat) continue;
    const crossesLat = a.lat > point.lat !== b.lat > point.lat;
    if (!crossesLat) continue;
    const lngAtLat =
      ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (point.lng < lngAtLat) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: LatLng, polygon: GeoJsonPolygon): boolean {
  const [exterior, ...holes] = polygon.coordinates;
  if (!exterior || !pointInRing(point, exterior)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

function distanceToSegmentMeters(point: LatLng, a: RingPoint, b: RingPoint): number {
  const cos = Math.cos(toRad(point.lat));
  const ax = toRad(a.lng - point.lng) * cos * EARTH_RADIUS_M;
  const ay = toRad(a.lat - point.lat) * EARTH_RADIUS_M;
  const bx = toRad(b.lng - point.lng) * cos * EARTH_RADIUS_M;
  const by = toRad(b.lat - point.lat) * EARTH_RADIUS_M;
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, (-ax * abx + -ay * aby) / ab2));
  return Math.hypot(ax + t * abx, ay + t * aby);
}

function distanceToRingMeters(point: LatLng, ring: readonly number[][]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ringPoint(ring, i);
    const b = ringPoint(ring, (i + 1) % ring.length);
    if (!a || !b) continue;
    if (a.lng === b.lng && a.lat === b.lat) continue;
    best = Math.min(best, distanceToSegmentMeters(point, a, b));
  }
  return best;
}

/**
 * Metres from an interior point to the nearest ring (exterior or hole).
 * A point outside the polygon, including inside a hole, returns 0.
 */
export function distanceInsideMeters(point: LatLng, polygon: GeoJsonPolygon): number {
  if (!pointInPolygon(point, polygon)) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const ring of polygon.coordinates) {
    best = Math.min(best, distanceToRingMeters(point, ring));
  }
  return Number.isFinite(best) ? best : 0;
}
