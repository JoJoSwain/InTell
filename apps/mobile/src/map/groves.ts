import { pointInPolygon, type LatLng } from "@intell/shared";

export type MapPoint = { latitude: number; longitude: number };

export type GrovePiece = {
  outer: MapPoint[];
  holes: MapPoint[][];
};

type GeoRing = number[][];

/**
 * Schema 3 stores one Polygon. Treat it as a one-piece MultiPolygon.
 * Step 8 deletes this wrap when packs publish a real MultiPolygon.
 */
export function piecesFromBoundary(boundary: {
  type: string;
  coordinates: unknown;
}): GrovePiece[] {
  if (boundary.type === "Polygon") {
    return [ringsToPiece(boundary.coordinates as GeoRing[])];
  }
  if (boundary.type === "MultiPolygon") {
    return (boundary.coordinates as GeoRing[][]).map(ringsToPiece);
  }
  return [];
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

export function pointInGrove(point: LatLng, pieces: readonly GrovePiece[]): boolean {
  return pieces.some((piece) =>
    pointInPolygon(point, {
      type: "Polygon",
      coordinates: [toGeo(piece.outer), ...piece.holes.map(toGeo)],
    }),
  );
}

function toGeo(points: readonly MapPoint[]): number[][] {
  return points.map((point) => [point.longitude, point.latitude]);
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
