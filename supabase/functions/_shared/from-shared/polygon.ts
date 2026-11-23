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

export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type GeoJsonArea = GeoJsonPolygon | GeoJsonMultiPolygon;

/** One polygon becomes a MultiPolygon with a single piece. */
export function toMultiPolygon(geometry: GeoJsonArea): GeoJsonMultiPolygon {
  if (geometry.type === "MultiPolygon") return geometry;
  return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
}

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

function pointInPiece(point: LatLng, piece: readonly number[][][]): boolean {
  const [exterior, ...holes] = piece;
  if (!exterior || !pointInRing(point, exterior)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

export function pointInPolygon(point: LatLng, geometry: GeoJsonArea): boolean {
  const multi = toMultiPolygon(geometry);
  return multi.coordinates.some((piece) => pointInPiece(point, piece));
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

function distanceInsidePieceMeters(point: LatLng, piece: readonly number[][][]): number {
  if (!pointInPiece(point, piece)) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const ring of piece) {
    best = Math.min(best, distanceToRingMeters(point, ring));
  }
  return Number.isFinite(best) ? best : 0;
}

/**
 * Metres from an interior point to the nearest ring of the piece that
 * contains it. A point outside every piece, including inside a hole, returns 0.
 */
export function distanceInsideMeters(point: LatLng, geometry: GeoJsonArea): number {
  const multi = toMultiPolygon(geometry);
  let best = 0;
  for (const piece of multi.coordinates) {
    const distance = distanceInsidePieceMeters(point, piece);
    if (distance > 0) best = best === 0 ? distance : Math.min(best, distance);
  }
  return best;
}
