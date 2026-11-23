import { describe, expect, it } from "vitest";
import { farPieceFailures, fragmentsForShape } from "./grove-shape-preview";

describe("farPieceFailures", () => {
  it("warns when a piece is more than 1 km away and not when closer", () => {
    const far = farPieceFailures("g1", [
      {
        id: "a",
        tier: "root",
        location_geojson: { coordinates: [-111.9, 40.98] },
      },
      {
        id: "b",
        tier: "root",
        location_geojson: { coordinates: [-111.88, 40.98] },
      },
    ]);
    // ~1.7 km east at this latitude → warn
    expect(far[0]?.code).toBe("GROVE_FAR_PIECE");

    const near = farPieceFailures("g1", [
      {
        id: "a",
        tier: "root",
        location_geojson: { coordinates: [-111.9, 40.98] },
      },
      {
        id: "b",
        tier: "root",
        location_geojson: { coordinates: [-111.895, 40.98] },
      },
    ]);
    expect(near).toEqual([]);
  });

  it("skips retired fragments", () => {
    expect(
      fragmentsForShape([
        {
          id: "a",
          tier: "root",
          status: "retired",
          location_geojson: { coordinates: [-111.9, 40.98] },
        },
      ]),
    ).toEqual([]);
  });
});
