import { distanceMeters, type LatLng } from "@intell/shared";

export const TRIM_PT = { root: 14, branch: 11, leaf: 9 } as const;
export type WebTier = keyof typeof TRIM_PT;

export function metersPerPoint(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

export function zoomFromLatitudeDelta(latitudeDelta: number): number {
  if (latitudeDelta <= 0) return 0;
  return Math.log2(360 / latitudeDelta);
}

export function webWeight(a: WebTier, b: WebTier): number {
  return a === "root" || b === "root" ? 1.5 : 1;
}

export function webStrength(targetLocked: boolean): number {
  return targetLocked ? 0.45 : 0.85;
}

/** Google on iOS treats a polyline dash as metres. Android uses points. */
export function dashPattern(
  points: readonly [number, number],
  metersPerPt: number,
  platform: "ios" | "android",
): [number, number] {
  if (platform === "ios") return [points[0] * metersPerPt, points[1] * metersPerPt];
  return [points[0], points[1]];
}

export function trimSegment(
  a: LatLng,
  b: LatLng,
  trimAMeters: number,
  trimBMeters: number,
): [LatLng, LatLng] | null {
  const dist = distanceMeters(a, b);
  if (dist <= trimAMeters + trimBMeters) return null;
  const t1 = trimAMeters / dist;
  const t2 = 1 - trimBMeters / dist;
  return [lerp(a, b, t1), lerp(a, b, t2)];
}

export function linkCoordinates(
  a: LatLng,
  b: LatLng,
  tierA: WebTier,
  tierB: WebTier,
  metersPerPt: number,
): [LatLng, LatLng] | null {
  return trimSegment(a, b, TRIM_PT[tierA] * metersPerPt, TRIM_PT[tierB] * metersPerPt);
}

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}
