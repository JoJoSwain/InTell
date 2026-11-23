/**
 * Story web and cross-grove arrow tips (ADR 0006 §3).
 * Lines run from the prerequisite to the fragment that requires it.
 */

import {
  distanceMeters,
  pointInPolygon,
  type GeoJsonArea,
  type LatLng,
} from "./polygon.ts";

export const CROSS_LINK_TIP_M = 30.48;

const EARTH_RADIUS_M = 6_371_000;

export type StoryWebFragment = {
  id: string;
  retired: boolean;
  requires: readonly (readonly string[])[];
};

export function storyWebLinks(
  fragments: readonly StoryWebFragment[],
): { fromId: string; toId: string }[] {
  const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const seen = new Set<string>();
  const links: { fromId: string; toId: string }[] = [];
  for (const fragment of fragments) {
    if (fragment.retired) continue;
    for (const group of fragment.requires) {
      for (const memberId of group) {
        const prerequisite = byId.get(memberId);
        if (!prerequisite || prerequisite.retired) continue;
        const key = `${prerequisite.id}\0${fragment.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({ fromId: prerequisite.id, toId: fragment.id });
      }
    }
  }
  links.sort((a, b) => a.fromId.localeCompare(b.fromId) || a.toId.localeCompare(b.toId));
  return links;
}

type Plane = { x: number; y: number };

function project(lat: number, lng: number, origin: LatLng): Plane {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  const φ0 = (origin.lat * Math.PI) / 180;
  const λ0 = (origin.lng * Math.PI) / 180;
  const cosc = Math.min(
    1,
    Math.max(
      -1,
      Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0),
    ),
  );
  const c = Math.acos(cosc);
  if (c < 1e-12) return { x: 0, y: 0 };
  const k = c / Math.sin(c);
  return {
    x: EARTH_RADIUS_M * k * Math.cos(φ) * Math.sin(λ - λ0),
    y:
      EARTH_RADIUS_M *
      k *
      (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0)),
  };
}

function unproject(x: number, y: number, origin: LatLng): LatLng {
  const ρ = Math.hypot(x, y);
  const φ0 = (origin.lat * Math.PI) / 180;
  const λ0 = (origin.lng * Math.PI) / 180;
  if (ρ < 1e-9) return { lat: origin.lat, lng: origin.lng };
  const c = ρ / EARTH_RADIUS_M;
  const lat = Math.asin(
    Math.min(1, Math.max(-1, Math.cos(c) * Math.sin(φ0) + (y * Math.sin(c) * Math.cos(φ0)) / ρ)),
  );
  const lng =
    λ0 +
    Math.atan2(x * Math.sin(c), ρ * Math.cos(φ0) * Math.cos(c) - y * Math.sin(φ0) * Math.sin(c));
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

function round7(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

function ringsOf(geometry: GeoJsonArea): number[][][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  return geometry.coordinates.flat();
}

function crossings(origin: LatLng, toward: Plane, geometry: GeoJsonArea): number[] {
  const hits: number[] = [];
  for (const ring of ringsOf(geometry)) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const aPair = ring[i];
      const bPair = ring[i + 1];
      if (!aPair || !bPair) continue;
      const aLng = aPair[0];
      const aLat = aPair[1];
      const bLng = bPair[0];
      const bLat = bPair[1];
      if (aLng === undefined || aLat === undefined || bLng === undefined || bLat === undefined) continue;
      const a = project(aLat, aLng, origin);
      const b = project(bLat, bLng, origin);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const denom = toward.x * dy - toward.y * dx;
      if (Math.abs(denom) < 1e-9) continue;
      const t = (a.x * dy - a.y * dx) / denom;
      const u = (a.x * toward.y - a.y * toward.x) / denom;
      if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) hits.push(t);
    }
  }
  hits.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const hit of hits) {
    const prev = unique[unique.length - 1];
    if (prev !== undefined && Math.abs(prev - hit) < 1e-5) continue;
    unique.push(hit);
  }
  return unique;
}

function pointAt(origin: LatLng, toward: Plane, t: number): LatLng {
  const geo = unproject(toward.x * t, toward.y * t, origin);
  return { lat: round7(geo.lat), lng: round7(geo.lng) };
}

/**
 * Arrow tip on the way from `from` to `toward`.
 * `CROSS_LINK_TIP_M` past the last exit from `boundary`, stopping sooner at
 * `other`'s edge and never past `toward`. Returns `toward` when the segment
 * stays inside `boundary`. Returns null only when `from` and `toward` coincide.
 */
export function crossLinkTip(
  boundary: GeoJsonArea,
  from: LatLng,
  toward: LatLng,
  other?: GeoJsonArea | null,
): LatLng | null {
  if (distanceMeters(from, toward) < 0.05) return null;
  const end = project(toward.lat, toward.lng, from);
  const length = Math.hypot(end.x, end.y);
  if (!(length > 0)) return null;
  let inside = pointInPolygon(from, boundary);
  let lastExit: number | null = null;
  for (const t of crossings(from, end, boundary)) {
    if (inside) {
      lastExit = t;
      inside = false;
    } else {
      inside = true;
    }
  }
  if (lastExit === null) {
    return { lat: round7(toward.lat), lng: round7(toward.lng) };
  }
  const exit = { x: end.x * lastExit, y: end.y * lastExit };
  const remain = length * (1 - lastExit);
  const step = Math.min(CROSS_LINK_TIP_M, remain);
  let tipT = lastExit + (length === 0 ? 0 : step / length);
  if (other && step > 0) {
    let otherInside = pointInPolygon(pointAt(from, end, lastExit), other);
    for (const t of crossings(from, end, other)) {
      if (t <= lastExit + 1e-6) {
        otherInside = !otherInside;
        continue;
      }
      if (!otherInside && t <= tipT + 1e-8) {
        tipT = t;
        break;
      }
      otherInside = !otherInside;
    }
  }
  if (tipT >= 1 - 1e-8) return { lat: round7(toward.lat), lng: round7(toward.lng) };
  return pointAt(from, end, tipT);
}

export type CrossGroveFragment = {
  id: string;
  groveId: string;
  retired: boolean;
  lat: number;
  lng: number;
  requires: readonly (readonly string[])[];
};

export type CrossGroveLink = {
  fragmentId: string;
  otherFragmentId: string;
  otherGroveId: string;
  direction: "requires" | "unlocks";
  tip: LatLng;
};

/** Links that belong on `groveId`'s pack, sorted. A null tip is omitted. */
export function crossGroveLinks(
  groveId: string,
  fragments: readonly CrossGroveFragment[],
  boundaries: readonly { groveId: string; boundary: GeoJsonArea }[],
): CrossGroveLink[] {
  const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const boundaryOf = new Map(boundaries.map((row) => [row.groveId, row.boundary]));
  const mine = boundaryOf.get(groveId);
  if (!mine) return [];
  const seen = new Set<string>();
  const links: CrossGroveLink[] = [];
  for (const fragment of fragments) {
    if (fragment.retired) continue;
    for (const group of fragment.requires) {
      for (const memberId of group) {
        const prerequisite = byId.get(memberId);
        if (!prerequisite || prerequisite.retired) continue;
        if (prerequisite.groveId === fragment.groveId) continue;
        const requiresHere = fragment.groveId === groveId;
        const unlocksHere = prerequisite.groveId === groveId;
        if (!requiresHere && !unlocksHere) continue;
        const here = requiresHere ? fragment : prerequisite;
        const other = requiresHere ? prerequisite : fragment;
        const direction = requiresHere ? "requires" : "unlocks";
        const key = `${here.id}\0${other.id}\0${direction}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const tip = crossLinkTip(
          mine,
          { lat: here.lat, lng: here.lng },
          { lat: other.lat, lng: other.lng },
          boundaryOf.get(other.groveId) ?? null,
        );
        if (!tip) continue;
        links.push({
          fragmentId: here.id,
          otherFragmentId: other.id,
          otherGroveId: other.groveId,
          direction,
          tip,
        });
      }
    }
  }
  links.sort(
    (a, b) =>
      a.fragmentId.localeCompare(b.fragmentId) ||
      a.otherFragmentId.localeCompare(b.otherFragmentId) ||
      a.direction.localeCompare(b.direction),
  );
  return links;
}
