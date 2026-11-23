/**
 * Derived grove boundary: the union of one disk per fragment (ADR 0006).
 * Azimuthal equidistant about the fragment centroid. No clipping library,
 * so the same file runs in Vitest, Deno, and React Native.
 *
 * Outer rings are counterclockwise. Holes are filled. A disk that sits
 * inside another piece is dropped (R1). Coordinates are rounded to 7 decimals.
 */

import type { GeoJsonMultiPolygon, LatLng } from "./polygon";

export const GROVE_BUFFER_M = {
  root: 76.2,
  branch: 45.72,
  leaf: 30.48,
} as const;

export const FAR_PIECE_M = 1000;

const EARTH_RADIUS_M = 6_371_000;
const SAGITTA_M = 0.05;
const TANGENT_EPS_M = 1e-4;
const INSIDE_EPS_M = 1e-4;
/** Snap intersection points so pairs that meet at one point share a key. */
const SNAP_M = 1e-4;

export type GroveShapeFragment = {
  id: string;
  tier: "root" | "branch" | "leaf";
  lat: number;
  lng: number;
};

type Disk = { id: string; x: number; y: number; r: number };

type Plane = { x: number; y: number; key: string };

type Arc = {
  disk: Disk;
  start: Plane;
  end: Plane;
  startAngle: number;
  endAngle: number;
};

type BuiltRing = { ring: Plane[]; interior: Plane };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function project(lat: number, lng: number, origin: LatLng): { x: number; y: number } {
  const φ = (lat * Math.PI) / 180;
  const λ = (lng * Math.PI) / 180;
  const φ0 = (origin.lat * Math.PI) / 180;
  const λ0 = (origin.lng * Math.PI) / 180;
  const cosc = clamp(
    Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0),
    -1,
    1,
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
    clamp(Math.cos(c) * Math.sin(φ0) + (y * Math.sin(c) * Math.cos(φ0)) / ρ, -1, 1),
  );
  const lng = λ0 + Math.atan2(
    x * Math.sin(c),
    ρ * Math.cos(φ0) * Math.cos(c) - y * Math.sin(φ0) * Math.sin(c),
  );
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

function round7(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

function snap(x: number, y: number): Plane {
  const sx = Math.round(x / SNAP_M) * SNAP_M;
  const sy = Math.round(y / SNAP_M) * SNAP_M;
  return { x: sx, y: sy, key: `${sx},${sy}` };
}

function angleAt(disk: Disk, p: Plane): number {
  const t = Math.atan2(p.y - disk.y, p.x - disk.x);
  return t < 0 ? t + Math.PI * 2 : t;
}

function intersections(a: Disk, b: Disk): Plane[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= TANGENT_EPS_M) return [];
  if (d > a.r + b.r + TANGENT_EPS_M) return [];
  if (d < Math.abs(a.r - b.r) - TANGENT_EPS_M) return [];
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h2 = a.r * a.r - along * along;
  const h = h2 <= TANGENT_EPS_M * TANGENT_EPS_M ? 0 : Math.sqrt(Math.max(0, h2));
  const xm = a.x + (along * dx) / d;
  const ym = a.y + (along * dy) / d;
  if (h === 0) return [snap(xm, ym)];
  const ox = (-dy * h) / d;
  const oy = (dx * h) / d;
  return [snap(xm + ox, ym + oy), snap(xm - ox, ym - oy)];
}

function strictlyInside(disk: Disk, others: readonly Disk[]): boolean {
  return others.some(
    (other) =>
      other !== disk &&
      Math.hypot(disk.x - other.x, disk.y - other.y) + disk.r < other.r - INSIDE_EPS_M,
  );
}

function pointInsideDisk(x: number, y: number, disk: Disk): boolean {
  return Math.hypot(x - disk.x, y - disk.y) < disk.r - INSIDE_EPS_M;
}

function dedupeAngles(disk: Disk, points: readonly Plane[]): Plane[] {
  const sorted = points
    .slice()
    .sort((a, b) => angleAt(disk, a) - angleAt(disk, b) || a.key.localeCompare(b.key));
  const out: Plane[] = [];
  for (const point of sorted) {
    const prev = out[out.length - 1];
    if (prev && (prev.key === point.key || Math.abs(angleAt(disk, prev) - angleAt(disk, point)) < 1e-8)) {
      continue;
    }
    out.push(point);
  }
  return out;
}

function arcSteps(radius: number, span: number): number {
  const cos = clamp(1 - SAGITTA_M / radius, -1, 1);
  const theta = 2 * Math.acos(cos);
  if (!(theta > 0)) return 1;
  return Math.max(1, Math.ceil(span / theta));
}

function tessellate(arc: Arc): Plane[] {
  const span = arc.endAngle - arc.startAngle;
  const steps = arcSteps(arc.disk.r, span);
  const points: Plane[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = arc.startAngle + (span * i) / steps;
    if (i === 0) {
      points.push(arc.start);
      continue;
    }
    points.push(
      snap(arc.disk.x + arc.disk.r * Math.cos(t), arc.disk.y + arc.disk.r * Math.sin(t)),
    );
  }
  return points;
}

function signedArea(ring: readonly Plane[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointInPlaneRing(point: Plane, ring: readonly Plane[]): boolean {
  let inside = false;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (!a || !b) continue;
    if (a.x === b.x && a.y === b.y) continue;
    const crosses = a.y > point.y !== b.y > point.y;
    if (!crosses) continue;
    const xAt = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < xAt) inside = !inside;
  }
  return inside;
}

function tangent(angle: number): { x: number; y: number } {
  return { x: -Math.sin(angle), y: Math.cos(angle) };
}

function turn(incoming: { x: number; y: number }, outgoing: { x: number; y: number }): number {
  return Math.atan2(
    incoming.x * outgoing.y - incoming.y * outgoing.x,
    incoming.x * outgoing.x + incoming.y * outgoing.y,
  );
}

function buildRings(disks: readonly Disk[]): BuiltRing[] {
  const pointsById = new Map<string, Plane[]>();
  for (const disk of disks) pointsById.set(disk.id, []);
  for (let i = 0; i < disks.length; i += 1) {
    const left = disks[i];
    if (!left) continue;
    for (let j = i + 1; j < disks.length; j += 1) {
      const right = disks[j];
      if (!right) continue;
      const hits = intersections(left, right);
      const leftPoints = pointsById.get(left.id);
      const rightPoints = pointsById.get(right.id);
      for (const hit of hits) {
        leftPoints?.push(hit);
        rightPoints?.push(hit);
      }
    }
  }

  const arcs: Arc[] = [];
  for (const disk of disks) {
    const unique = dedupeAngles(disk, pointsById.get(disk.id) ?? []);
    if (unique.length === 0) {
      if (strictlyInside(disk, disks)) continue;
      const start = snap(disk.x + disk.r, disk.y);
      arcs.push({
        disk,
        start,
        end: start,
        startAngle: 0,
        endAngle: Math.PI * 2,
      });
      continue;
    }
    for (let i = 0; i < unique.length; i += 1) {
      const start = unique[i];
      const end = unique[(i + 1) % unique.length];
      if (!start || !end) continue;
      let startAngle = angleAt(disk, start);
      let endAngle = angleAt(disk, end);
      if (endAngle <= startAngle) endAngle += Math.PI * 2;
      const span = endAngle - startAngle;
      if (span < 1e-8) continue;
      const mid = startAngle + span / 2;
      const mx = disk.x + disk.r * Math.cos(mid);
      const my = disk.y + disk.r * Math.sin(mid);
      if (disks.some((other) => other !== disk && pointInsideDisk(mx, my, other))) continue;
      arcs.push({ disk, start, end, startAngle, endAngle });
    }
  }

  const byStart = new Map<string, Arc[]>();
  for (const arc of arcs) {
    const list = byStart.get(arc.start.key);
    if (list) list.push(arc);
    else byStart.set(arc.start.key, [arc]);
  }
  for (const list of byStart.values()) {
    list.sort((a, b) => a.disk.id.localeCompare(b.disk.id) || a.startAngle - b.startAngle);
  }

  const used = new Set<Arc>();
  const rings: BuiltRing[] = [];
  const ordered = arcs
    .slice()
    .sort((a, b) => a.disk.id.localeCompare(b.disk.id) || a.startAngle - b.startAngle);

  function nextArc(current: Arc): Arc | null {
    const candidates = (byStart.get(current.end.key) ?? []).filter((arc) => !used.has(arc));
    const first = candidates[0];
    if (!first) return null;
    if (candidates.length === 1) return first;
    const incoming = tangent(current.endAngle);
    let best = first;
    let bestTurn = -Infinity;
    for (const candidate of candidates) {
      const score = turn(incoming, tangent(candidate.startAngle));
      if (score > bestTurn + 1e-9 || (Math.abs(score - bestTurn) <= 1e-9 && candidate.disk.id < best.disk.id)) {
        best = candidate;
        bestTurn = score;
      }
    }
    return best;
  }

  for (const start of ordered) {
    if (used.has(start)) continue;
    const chain: Arc[] = [];
    let current: Arc | null = start;
    let guard = arcs.length + 1;
    while (current && guard > 0) {
      guard -= 1;
      chain.push(current);
      used.add(current);
      const nxt = nextArc(current);
      if (!nxt || nxt === start) break;
      current = nxt;
    }
    if (chain.length === 0) continue;
    const ring: Plane[] = [];
    for (const arc of chain) {
      for (const point of tessellate(arc)) {
        const prev = ring[ring.length - 1];
        if (!prev || prev.key !== point.key) ring.push(point);
      }
    }
    const first = chain[0];
    if (!first || ring.length < 3) continue;
    if (signedArea(ring) <= 0) continue;
    rings.push({ ring, interior: snap(first.disk.x, first.disk.y) });
  }

  const boxed = rings.map((ring) => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of ring.ring) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return { ring, minX, minY, maxX, maxY };
  });
  return boxed
    .filter((ring, index) => {
      const point = ring.ring.interior;
      return !boxed.some((other, otherIndex) => {
        if (otherIndex === index) return false;
        if (point.x < other.minX || point.x > other.maxX || point.y < other.minY || point.y > other.maxY) {
          return false;
        }
        return pointInPlaneRing(point, other.ring.ring);
      });
    })
    .map((ring) => ring.ring);
}

function toGeographic(ring: readonly Plane[], origin: LatLng): number[][] {
  const coords: number[][] = [];
  for (const point of ring) {
    const geo = unproject(point.x, point.y, origin);
    const pair: [number, number] = [round7(geo.lng), round7(geo.lat)];
    const prev = coords[coords.length - 1];
    if (prev && prev[0] === pair[0] && prev[1] === pair[1]) continue;
    coords.push(pair);
  }
  if (coords.length < 3) return [];
  const closed = coords[0];
  const last = coords[coords.length - 1];
  const closedLng = closed?.[0];
  const closedLat = closed?.[1];
  const lastLng = last?.[0];
  const lastLat = last?.[1];
  if (
    closedLng === undefined ||
    closedLat === undefined ||
    lastLng === undefined ||
    lastLat === undefined
  ) {
    return [];
  }
  if (closedLng !== lastLng || closedLat !== lastLat) coords.push([closedLng, closedLat]);
  return coords.length >= 4 ? coords : [];
}

function ringAreaLngLat(ring: readonly number[][]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    if (!a || !b || a[0] === undefined || a[1] === undefined || b[0] === undefined || b[1] === undefined) {
      continue;
    }
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function rotateToStart(ring: number[][]): number[][] {
  const unique = ring.slice(0, -1);
  let best = 0;
  for (let i = 1; i < unique.length; i += 1) {
    const point = unique[i];
    const winner = unique[best];
    if (!point || !winner || point[0] === undefined || point[1] === undefined) continue;
    if (winner[0] === undefined || winner[1] === undefined) continue;
    if (point[0] < winner[0] || (point[0] === winner[0] && point[1] < winner[1])) best = i;
  }
  const rotated = unique.slice(best).concat(unique.slice(0, best));
  const first = rotated[0];
  if (!first || first[0] === undefined || first[1] === undefined) return ring;
  return [...rotated, [first[0], first[1]]];
}

function orient(ring: number[][]): number[][] {
  if (ringAreaLngLat(ring) >= 0) return ring;
  const unique = ring.slice(0, -1).reverse();
  const first = unique[0];
  if (!first || first[0] === undefined || first[1] === undefined) return ring;
  return [...unique, [first[0], first[1]]];
}

export function groveShape(
  fragments: readonly GroveShapeFragment[],
  opts?: { extraM?: number },
): GeoJsonMultiPolygon | null {
  if (fragments.length === 0) return null;
  const extra = opts?.extraM ?? 0;
  const sorted = fragments.slice().sort((a, b) => a.id.localeCompare(b.id));
  const origin = {
    lat: sorted.reduce((sum, frag) => sum + frag.lat, 0) / sorted.length,
    lng: sorted.reduce((sum, frag) => sum + frag.lng, 0) / sorted.length,
  };

  const disks: Disk[] = [];
  for (const frag of sorted) {
    const radius = GROVE_BUFFER_M[frag.tier] + extra;
    if (!(radius > 0)) continue;
    const plane = project(frag.lat, frag.lng, origin);
    const disk = { id: frag.id, x: plane.x, y: plane.y, r: radius };
    const same = disks.findIndex(
      (kept) => Math.hypot(kept.x - disk.x, kept.y - disk.y) <= TANGENT_EPS_M,
    );
    if (same >= 0) {
      const kept = disks[same];
      if (kept && disk.r > kept.r) disks[same] = disk;
      continue;
    }
    disks.push(disk);
  }
  if (disks.length === 0) return null;

  const polygons: number[][][][] = [];
  for (const built of buildRings(disks)) {
    const geo = toGeographic(built.ring, origin);
    if (geo.length < 4) continue;
    const ring = orient(rotateToStart(geo));
    if (ringAreaLngLat(ring) <= 0) continue;
    polygons.push([ring]);
  }
  polygons.sort((a, b) => {
    const pa = a[0]?.[0];
    const pb = b[0]?.[0];
    if (!pa || !pb || pa[0] === undefined || pb[0] === undefined) return 0;
    if (pa[0] !== pb[0]) return pa[0] - pb[0];
    return (pa[1] ?? 0) - (pb[1] ?? 0);
  });
  if (polygons.length === 0) return null;
  return { type: "MultiPolygon", coordinates: polygons };
}

function planeOf(lng: number, lat: number, origin: LatLng): { x: number; y: number } {
  return project(lat, lng, origin);
}

function pointSegmentMeters(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = clamp(((point.x - a.x) * abx + (point.y - a.y) * aby) / ab2, 0, 1);
  return Math.hypot(point.x - (a.x + t * abx), point.y - (a.y + t * aby));
}

function ringsApartMeters(a: readonly number[][], b: readonly number[][]): number {
  const originPair = a[0];
  if (!originPair || originPair[0] === undefined || originPair[1] === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const origin = { lng: originPair[0], lat: originPair[1] };
  const toPlane = (ring: readonly number[][]) => {
    const out: { x: number; y: number }[] = [];
    for (const pair of ring) {
      const lng = pair[0];
      const lat = pair[1];
      if (lng === undefined || lat === undefined) continue;
      out.push(planeOf(lng, lat, origin));
    }
    return out;
  };
  const pa = toPlane(a);
  const pb = toPlane(b);
  let best = Number.POSITIVE_INFINITY;
  const measure = (
    from: readonly { x: number; y: number }[],
    to: readonly { x: number; y: number }[],
  ) => {
    for (const point of from) {
      for (let i = 0; i < to.length - 1; i += 1) {
        const start = to[i];
        const end = to[i + 1];
        if (!start || !end) continue;
        best = Math.min(best, pointSegmentMeters(point, start, end));
      }
    }
  };
  measure(pa, pb);
  measure(pb, pa);
  return best;
}

/** Indexes of pieces more than {@link FAR_PIECE_M} from every other piece. */
export function farPieces(shape: GeoJsonMultiPolygon): number[] {
  const pieces = shape.coordinates;
  if (pieces.length < 2) return [];
  const far: number[] = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const ring = pieces[i]?.[0];
    if (!ring) continue;
    let nearest = Number.POSITIVE_INFINITY;
    for (let j = 0; j < pieces.length; j += 1) {
      if (i === j) continue;
      const other = pieces[j]?.[0];
      if (!other) continue;
      nearest = Math.min(nearest, ringsApartMeters(ring, other));
    }
    if (nearest > FAR_PIECE_M) far.push(i);
  }
  return far;
}
