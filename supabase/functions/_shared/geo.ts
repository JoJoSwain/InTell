import { roundCoord } from "./from-shared/canonicalJson.ts";

export type GeoPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export function asPolygon(raw: unknown): GeoPolygon {
  if (raw && typeof raw === "object") {
    const g = raw as { type?: string; coordinates?: unknown };
    if (g.type === "Polygon" && Array.isArray(g.coordinates)) {
      const coordinates = (g.coordinates as number[][][]).map((ring) =>
        ring.map(
          (pt) => [roundCoord(pt[0]!), roundCoord(pt[1]!)] as [number, number],
        ),
      );
      return { type: "Polygon", coordinates };
    }
  }
  throw new Error("expected GeoJSON Polygon");
}

export function pointLatLng(raw: unknown): { lat: number; lng: number } {
  const g = raw as { type?: string; coordinates?: number[] };
  if (g?.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const [lng, lat] = g.coordinates;
    return { lat: roundCoord(lat), lng: roundCoord(lng) };
  }
  throw new Error("expected GeoJSON Point");
}

export function bboxExpand(coords: GeoPolygon, padDeg = 0.012): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const ring of coords.coordinates) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return [minLng - padDeg, minLat - padDeg, maxLng + padDeg, maxLat + padDeg];
}

export function bboxIntersects(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}