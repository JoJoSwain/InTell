import { describe, expect, it } from "vitest";
import {
  distanceInsideMeters,
  distanceMeters,
  pointInPolygon,
  type GeoJsonPolygon,
} from "./polygon";

/** ~111 m north-south, ~84 m east-west, around the Wasatch seed latitude. */
function square(): GeoJsonPolygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [-111.9, 40.98],
        [-111.899, 40.98],
        [-111.899, 40.981],
        [-111.9, 40.981],
        [-111.9, 40.98],
      ],
    ],
  };
}

const center = { lat: 40.9805, lng: -111.8995 };
const justInside = { lat: 40.98002, lng: -111.8995 };
const justOutside = { lat: 40.97998, lng: -111.8995 };

describe("pointInPolygon", () => {
  it("contains the center and a point just inside the south edge", () => {
    expect(pointInPolygon(center, square())).toBe(true);
    expect(pointInPolygon(justInside, square())).toBe(true);
  });

  it("rejects a point just outside", () => {
    expect(pointInPolygon(justOutside, square())).toBe(false);
  });

  it("rejects a point inside a hole", () => {
    const withHole: GeoJsonPolygon = {
      type: "Polygon",
      coordinates: [
        square().coordinates[0]!,
        [
          [-111.8997, 40.9803],
          [-111.8993, 40.9803],
          [-111.8993, 40.9807],
          [-111.8997, 40.9807],
          [-111.8997, 40.9803],
        ],
      ],
    };
    expect(pointInPolygon(center, withHole)).toBe(false);
    expect(pointInPolygon({ lat: 40.98015, lng: -111.8995 }, withHole)).toBe(true);
  });
});

describe("distanceInsideMeters", () => {
  it("is 0 outside and grows from the edge toward the center", () => {
    expect(distanceInsideMeters(justOutside, square())).toBe(0);
    const nearEdge = distanceInsideMeters(justInside, square());
    const atCenter = distanceInsideMeters(center, square());
    expect(nearEdge).toBeGreaterThan(0);
    expect(nearEdge).toBeLessThan(5);
    expect(atCenter).toBeGreaterThan(30);
    expect(atCenter).toBeGreaterThan(nearEdge);
  });

  it("is 0 inside a hole", () => {
    const withHole: GeoJsonPolygon = {
      type: "Polygon",
      coordinates: [
        square().coordinates[0]!,
        [
          [-111.8997, 40.9803],
          [-111.8993, 40.9803],
          [-111.8993, 40.9807],
          [-111.8997, 40.9807],
          [-111.8997, 40.9803],
        ],
      ],
    };
    expect(distanceInsideMeters(center, withHole)).toBe(0);
  });
});

describe("distanceMeters", () => {
  it("is 0 at the same point and about 111.2 km per degree of latitude", () => {
    expect(distanceMeters(center, center)).toBe(0);
    const north = distanceMeters(center, { lat: center.lat + 1, lng: center.lng });
    expect(north).toBeGreaterThan(110_000);
    expect(north).toBeLessThan(112_000);
  });
});
