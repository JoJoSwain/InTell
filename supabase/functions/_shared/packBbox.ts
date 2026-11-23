import type { GeoJsonMultiPolygon } from "./from-shared/polygon.ts";

/** [west, south, east, north] from a derived MultiPolygon. */
export function bboxFromMultiPolygon(
  shape: GeoJsonMultiPolygon,
): [number, number, number, number] {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const piece of shape.coordinates) {
    for (const ring of piece) {
      for (const pair of ring) {
        const lng = pair[0];
        const lat = pair[1];
        if (lng === undefined || lat === undefined) continue;
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }
  }
  if (!Number.isFinite(west)) {
    throw new Error("empty MultiPolygon has no bbox");
  }
  return [west, south, east, north];
}
