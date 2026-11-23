import {
  pointInPolygon,
  toMultiPolygon,
  type GeoJsonArea,
  type GeoJsonMultiPolygon,
  type LatLng,
} from "@intell/shared";

export type MapPoint = { latitude: number; longitude: number };

export type GrovePiece = {
  outer: MapPoint[];
  holes: MapPoint[][];
};

type GeoRing = number[][];

export function piecesFromBoundary(boundary: GeoJsonArea): GrovePiece[] {
  return toMultiPolygon(boundary).coordinates.map(ringsToPiece);
}

function ringsToPiece(rings: GeoRing[]): GrovePiece {
  const [outer, ...holes] = rings;
  return {
    outer: ringToPoints(outer ?? []),
    holes: holes.map(ringToPoints),
  };
}

function ringToPoints(ring: GeoRing): MapPoint[] {
  const points: MapPoint[] = [];
  for (const pair of ring) {
    const lng = pair[0];
    const lat = pair[1];
    if (lng === undefined || lat === undefined) continue;
    points.push({ latitude: lat, longitude: lng });
  }
  return points;
}

/** Repeat the first vertex so the last outline edge is drawn (N3). */
export function closeRing(points: readonly MapPoint[]): MapPoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return [...points];
  if (first.latitude === last.latitude && first.longitude === last.longitude) return [...points];
  return [...points, first];
}

export function pointInGrove(point: LatLng, boundary: GeoJsonArea): boolean {
  return pointInPolygon(point, boundary);
}

export function ringCentroid(points: readonly MapPoint[]): MapPoint | null {
  if (points.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const point of points) {
    lat += point.latitude;
    lng += point.longitude;
  }
  return { latitude: lat / points.length, longitude: lng / points.length };
}

/**
 * Band between a grown outer MultiPolygon and the grove: outer ring with the
 * grove as holes. Used for the four halo widths at a settled zoom.
 */
export function haloBandPieces(
  base: GeoJsonMultiPolygon,
  grown: GeoJsonMultiPolygon,
): GrovePiece[] {
  const baseHoles = base.coordinates.map((piece) => ringToPoints(piece[0] ?? []));
  return grown.coordinates.map((piece, index) => {
    const outer = ringToPoints(piece[0] ?? []);
    const matched = base.coordinates[index];
    const holes = matched
      ? [ringToPoints(matched[0] ?? []), ...matched.slice(1).map((ring) => ringToPoints(ring))]
      : baseHoles;
    return { outer, holes };
  });
}
