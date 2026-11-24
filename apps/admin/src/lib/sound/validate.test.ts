import { describe, expect, it } from "vitest";
import {
  expectedKindForGroveCue,
  groveCueAssetKindError,
  normalizeTimingMsList,
  refuseMonoBed,
  resolveAssetKindError,
  validateMusicConditionAdmin,
  validateStemCount,
} from "./validate";
import { parsePolygonGeoJson } from "./helpers";

describe("zone GeoJSON", () => {
  it("accepts Polygon and rejects Point", () => {
    expect(
      typeof parsePolygonGeoJson(
        '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}',
      ),
    ).toBe("string");
    expect(parsePolygonGeoJson('{"type":"Point","coordinates":[0,0]}')).toEqual(
      { error: "boundary must be a GeoJSON Polygon" },
    );
  });
});

describe("condition builder validation", () => {
  const frag = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
  const existing = new Set([frag]);

  it("requires heardAll ids to exist", () => {
    expect(
      validateMusicConditionAdmin(
        { heardAll: ["bbbbbbbb-bbbb-4ccc-8ddd-000000000099"] },
        { existingFragmentIds: existing, heardAllLengthsInWindow: [1] },
      ),
    ).toMatch(/does not exist/);
    expect(
      validateMusicConditionAdmin(
        { heardAll: [frag] },
        { existingFragmentIds: existing, heardAllLengthsInWindow: [1] },
      ),
    ).toBeNull();
  });

  it("refuses more than 4 growth steps per grove+window", () => {
    expect(
      validateMusicConditionAdmin(
        {},
        {
          existingFragmentIds: existing,
          heardAllLengthsInWindow: [1, 2, 1, 2, 1],
        },
      ),
    ).toMatch(/GROWTH_STEPS_OVER_MAX/);
  });

  it("refuses negative minDepthM", () => {
    expect(
      validateMusicConditionAdmin(
        { minDepthM: -1 },
        { existingFragmentIds: existing, heardAllLengthsInWindow: [] },
      ),
    ).toMatch(/minDepthM/);
  });

  it("allows minDepthM ≥ 0", () => {
    expect(
      validateMusicConditionAdmin(
        { minDepthM: 0 },
        { existingFragmentIds: existing, heardAllLengthsInWindow: [] },
      ),
    ).toBeNull();
  });
});

describe("stems and asset kinds", () => {
  it("caps stems at 4", () => {
    expect(validateStemCount(5)).toMatch(/STEMS_OVER_MAX/);
    expect(validateStemCount(4)).toBeNull();
  });

  it("requires music_moment for resolves and motifs, beacon for beacons", () => {
    expect(resolveAssetKindError("sfx_bed", "resolve root")).toMatch(
      /music_moment/,
    );
    expect(resolveAssetKindError("music_moment", "resolve root")).toBeNull();
    expect(expectedKindForGroveCue("beacon_root")).toBe("beacon");
    expect(expectedKindForGroveCue("threshold_motif_day")).toBe(
      "music_moment",
    );
    expect(groveCueAssetKindError("beacon_leaf", "music_moment")).toMatch(
      /beacon/,
    );
    expect(groveCueAssetKindError("beacon_leaf", "beacon")).toBeNull();
  });

  it("refuses mono beds as BED_MONO", () => {
    expect(refuseMonoBed("sfx_bed", 1)).toMatch(/BED_MONO/);
    expect(refuseMonoBed("sfx_bed", 2)).toBeNull();
    expect(refuseMonoBed("sfx_oneshot", 1)).toBeNull();
  });
});

describe("breath and swell lists", () => {
  it("sorts, dedupes, and enforces duration", () => {
    expect(normalizeTimingMsList([300, 100, 100, 200], 500, "breath")).toEqual([
      100, 200, 300,
    ]);
    expect(normalizeTimingMsList([600], 500, "breath")).toEqual({
      error: "breath: 600 ms exceeds duration 500 ms",
    });
    expect(normalizeTimingMsList([-1], 500, "swell")).toEqual({
      error: "swell: times must be non-negative integers",
    });
  });
});
