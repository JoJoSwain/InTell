import { describe, expect, it } from "vitest";
import { createSeededRng } from "../audio/seededRng";
import { distanceMeters, pointInPolygon, type LatLng } from "./polygon";
import {
  FAR_PIECE_M,
  GROVE_BUFFER_M,
  farPieces,
  groveShape,
  type GroveShapeFragment,
} from "./groveShape";

const BASE = { lat: 40.98, lng: -111.9 };

const EARTH_RADIUS_M = 6_371_000;

function at(
  id: string,
  tier: GroveShapeFragment["tier"],
  eastM: number,
  northM: number,
): GroveShapeFragment {
  const lat = BASE.lat + (northM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lng =
    BASE.lng +
    (eastM / (EARTH_RADIUS_M * Math.cos((BASE.lat * Math.PI) / 180))) * (180 / Math.PI);
  return { id, tier, lat, lng };
}

function shapeOf(fragments: GroveShapeFragment[], extraM = 0) {
  return groveShape(fragments, extraM === 0 ? undefined : { extraM });
}

describe("groveShape", () => {
  it("returns null for no fragments", () => {
    expect(groveShape([])).toBeNull();
  });

  it("draws one ring around one fragment", () => {
    const frag = at("root", "root", 0, 0);
    const shape = shapeOf([frag]);
    expect(shape?.coordinates).toHaveLength(1);
    expect(pointInPolygon(frag, shape!)).toBe(true);
    const ring = shape!.coordinates[0]?.[0] ?? [];
    for (const pair of ring) {
      const lng = pair[0];
      const lat = pair[1];
      if (lng === undefined || lat === undefined) continue;
      const gap = Math.abs(distanceMeters(frag, { lat, lng }) - GROVE_BUFFER_M.root);
      expect(gap).toBeLessThan(0.05);
    }
  });

  it("unions two overlapping circles through both intersection points", () => {
    const shape = shapeOf([at("a", "root", 0, 0), at("b", "root", 50, 0)]);
    expect(shape?.coordinates).toHaveLength(1);
    expect(pointInPolygon(at("a", "root", 0, 0), shape!)).toBe(true);
    expect(pointInPolygon(at("b", "root", 50, 0), shape!)).toBe(true);
    expect(pointInPolygon(at("m", "leaf", 25, 0), shape!)).toBe(true);
  });

  it("keeps a tangent contact as one vertex", () => {
    const shape = shapeOf([at("a", "root", 0, 0), at("b", "root", GROVE_BUFFER_M.root * 2, 0)]);
    expect(shape?.coordinates).toHaveLength(1);
    const ring = shape!.coordinates[0]?.[0] ?? [];
    const contact = at("c", "leaf", GROVE_BUFFER_M.root, 0);
    const hits = ring.filter((pair) => {
      const lng = pair[0];
      const lat = pair[1];
      if (lng === undefined || lat === undefined) return false;
      return distanceMeters(contact, { lat, lng }) < 0.05;
    });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("drops a circle that sits inside another", () => {
    const shape = shapeOf([at("outer", "root", 0, 0), at("inner", "leaf", 10, 0)]);
    expect(shape?.coordinates).toHaveLength(1);
    expect(pointInPolygon(at("inner", "leaf", 10, 0), shape!)).toBe(true);
    expect(pointInPolygon(at("out", "leaf", GROVE_BUFFER_M.root + 5, 0), shape!)).toBe(false);
  });

  it("keeps the larger radius when two fragments share a point", () => {
    const shape = shapeOf([at("leaf", "leaf", 0, 0), at("root", "root", 0, 0)]);
    const alone = shapeOf([at("root", "root", 0, 0)]);
    expect(JSON.stringify(shape)).toBe(JSON.stringify(alone));
  });

  it("records one vertex where three circles meet", () => {
    const radius = GROVE_BUFFER_M.leaf;
    const meeting = at("m", "leaf", 0, 0);
    // Centres sit south of the shared point so that point stays on the outline.
    const fragments = [-40, 0, 40].map((deg, index) => {
      const angle = Math.PI + (deg * Math.PI) / 180;
      return at(
        `c${index}`,
        "leaf",
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    });
    const shape = shapeOf(fragments);
    expect(shape?.coordinates).toHaveLength(1);
    const ring = shape!.coordinates[0]?.[0] ?? [];
    const hits = ring.filter((pair) => {
      const lng = pair[0];
      const lat = pair[1];
      if (lng === undefined || lat === undefined) return false;
      return distanceMeters(meeting, { lat, lng }) < 0.15;
    });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.length).toBeLessThanOrEqual(2);
  });

  it("fills a gap and drops a piece that sits inside it", () => {
    const ringRadius = 120;
    const ring = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * 2 * Math.PI) / 8;
      return at(
        `r${i}`,
        "root",
        Math.cos(angle) * ringRadius,
        Math.sin(angle) * ringRadius,
      );
    });
    const filled = shapeOf(ring);
    expect(filled?.coordinates).toHaveLength(1);
    const center = at("center", "leaf", 0, 0);
    expect(pointInPolygon(center, filled!)).toBe(true);
    const withInner = shapeOf([...ring, center]);
    expect(withInner?.coordinates).toHaveLength(1);
    expect(pointInPolygon(center, withInner!)).toBe(true);
  });

  it("returns an island as a second polygon", () => {
    const shape = shapeOf([at("a", "root", 0, 0), at("b", "root", 400, 0)]);
    expect(shape?.coordinates).toHaveLength(2);
    const starts = shape!.coordinates.map((piece) => piece[0]?.[0]?.[0] ?? 0);
    expect(starts[0]).toBeLessThanOrEqual(starts[1] ?? 0);
  });

  it("matches a shuffle and an outward offset", () => {
    const fragments = [at("b", "branch", 40, 10), at("a", "root", 0, 0), at("c", "leaf", -30, 20)];
    const first = shapeOf(fragments);
    const shuffled = shapeOf([fragments[2]!, fragments[0]!, fragments[1]!]);
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(first));
    const grown = shapeOf(fragments, 12);
    const ring = grown!.coordinates[0]?.[0] ?? [];
    for (const pair of ring) {
      const lng = pair[0];
      const lat = pair[1];
      if (lng === undefined || lat === undefined) continue;
      const point = { lat, lng };
      const near = fragments.some((frag) => {
        const radius = GROVE_BUFFER_M[frag.tier] + 12;
        return Math.abs(distanceMeters(frag, point) - radius) < 0.08;
      });
      expect(near).toBe(true);
    }
  });

  it("keeps centres inside and vertices on a circle, across random layouts", () => {
    const rng = createSeededRng(42);
    for (let layout = 0; layout < 40; layout += 1) {
      const count = 2 + Math.floor(rng() * 6);
      const tiers = ["root", "branch", "leaf"] as const;
      const fragments = Array.from({ length: count }, (_, index) =>
        at(
          `f${layout}-${index}`,
          tiers[Math.floor(rng() * tiers.length)] ?? "leaf",
          (rng() - 0.5) * 400,
          (rng() - 0.5) * 400,
        ),
      );
      const shape = shapeOf(fragments);
      expect(shape).not.toBeNull();
      for (const frag of fragments) expect(pointInPolygon(frag, shape!)).toBe(true);
      let west = Infinity;
      let east = -Infinity;
      let south = Infinity;
      let north = -Infinity;
      for (const piece of shape!.coordinates) {
        for (const pair of piece[0] ?? []) {
          const lng = pair[0];
          const lat = pair[1];
          if (lng === undefined || lat === undefined) continue;
          west = Math.min(west, lng);
          east = Math.max(east, lng);
          south = Math.min(south, lat);
          north = Math.max(north, lat);
          const point = { lat, lng };
          const onCircle = fragments.some(
            (frag) => Math.abs(distanceMeters(frag, point) - GROVE_BUFFER_M[frag.tier]) < 0.08,
          );
          const buried = fragments.some(
            (frag) => distanceMeters(frag, point) < GROVE_BUFFER_M[frag.tier] - 0.08,
          );
          expect(onCircle).toBe(true);
          expect(buried).toBe(false);
        }
      }
      const outside: LatLng = {
        lat: north + (500 / EARTH_RADIUS_M) * (180 / Math.PI),
        lng:
          east +
          (500 / (EARTH_RADIUS_M * Math.cos((BASE.lat * Math.PI) / 180))) * (180 / Math.PI),
      };
      expect(pointInPolygon(outside, shape!)).toBe(false);
      expect(south).toBeLessThan(north);
      expect(west).toBeLessThan(east);
    }
  });

  it("unions 300 spread fragments and reports the dense case", () => {
    const spread = Array.from({ length: 300 }, (_, index) =>
      at(`s${index}`, index % 5 === 0 ? "root" : "leaf", (index % 30) * 200, Math.floor(index / 30) * 200),
    );
    groveShape(spread);
    const spreadStart = performance.now();
    groveShape(spread);
    const spreadMs = performance.now() - spreadStart;
    console.log(`groveShape 300 spread ms ${spreadMs.toFixed(1)}`);
    // Report the timing; 1000 ms is only a blow-up guard, not a benchmark.
    expect(spreadMs).toBeLessThan(1000);

    const dense = Array.from({ length: 300 }, (_, index) =>
      at(`d${index}`, "leaf", (index % 20) * 5, Math.floor(index / 20) * 5),
    );
    const denseStart = performance.now();
    groveShape(dense);
    const denseMs = performance.now() - denseStart;
    console.log(`groveShape 300 dense ms ${denseMs.toFixed(1)}`);
    expect(groveShape(dense)?.type).toBe("MultiPolygon");
  });
});

describe("farPieces", () => {
  it("warns when a piece is more than 1 km from the rest", () => {
    const gap = FAR_PIECE_M + GROVE_BUFFER_M.root * 2 + 50;
    const far = shapeOf([at("a", "root", 0, 0), at("b", "root", gap, 0)]);
    expect(farPieces(far!)).toEqual([0, 1]);
    const near = shapeOf([
      at("a", "root", 0, 0),
      at("b", "root", 900 + GROVE_BUFFER_M.root * 2, 0),
    ]);
    expect(farPieces(near!)).toEqual([]);
  });
});
