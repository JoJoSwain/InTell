import { describe, expect, it } from "vitest";
import { GrovePack, RegionPack } from "./packs";

const boundary = {
  type: "Polygon" as const,
  coordinates: [
    [
      [-111.93, 40.96],
      [-111.92, 40.96],
      [-111.92, 40.97],
      [-111.93, 40.97],
      [-111.93, 40.96],
    ],
  ],
};

const baseGrove = {
  schema: 1 as const,
  groveId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
  packVersion: 1,
  builtAt: "2026-06-15T17:00:00.000Z",
  grove: {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
    name: { en: "Demo" },
    premise: { en: "Premise" },
    boundary,
    site: { name: "Site" },
  },
  rings: [],
  characters: [],
  fragments: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000030",
      tier: "root" as const,
      isEnding: false,
      requires: [] as string[][],
      title: { en: "Root" },
      visibility: "marked" as const,
      storyOrder: 1,
      retired: false,
      lat: 40.96,
      lng: -111.93,
      radiusM: 25,
      threadIds: [],
      characterIds: [],
    },
  ],
  revisions: [],
  currentRevisionByFragment: {},
  questions: [],
  crossroads: [],
  music: { cues: [] },
  ambienceZones: [],
  ledger: [],
  gatherings: [],
  assets: [],
};

describe("GrovePack", () => {
  it("accepts a minimal valid pack with requires/isEnding", () => {
    const parsed = GrovePack.parse(baseGrove);
    expect(parsed.fragments[0]?.isEnding).toBe(false);
    expect(parsed.fragments[0]?.requires).toEqual([]);
  });

  it("rejects markerCode on fragments (forbidden)", () => {
    const bad = {
      ...baseGrove,
      fragments: [
        {
          ...baseGrove.fragments[0],
          markerCode: "DEMO-001",
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow();
  });

  it("rejects lat/lng on protected fragments", () => {
    const bad = {
      ...baseGrove,
      fragments: [
        {
          ...baseGrove.fragments[0],
          visibility: "protected" as const,
          lat: 40.96,
          lng: -111.93,
          radiusM: 10,
          markerHash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow(/protected/i);
  });

  it("rejects seed text / voice fields on ledger", () => {
    const bad = {
      ...baseGrove,
      ledger: [
        {
          ringId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000011",
          growers: ["ok"],
          anonymousCount: 0,
          seedsPlanted: 1,
          seedsGrown: 0,
          seedText: "secret",
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow();
  });

  it("rejects vote tallies on crossroads", () => {
    const bad = {
      ...baseGrove,
      crossroads: [
        {
          id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000070",
          ringId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000011",
          anchorFragmentId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000031",
          prompt: { en: "Choose" },
          voteRadiusM: 50,
          opensAt: "2026-01-01T00:00:00.000Z",
          closesAt: "2026-12-01T00:00:00.000Z",
          status: "open",
          options: [],
          voteCount: 12,
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow();
  });
});

describe("RegionPack", () => {
  it("allows null landcover", () => {
    const pack = {
      schema: 1 as const,
      regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
      packVersion: 0,
      builtAt: "2026-06-15T17:00:00.000Z",
      ambienceProfiles: [],
      landcover: null,
      ambienceZones: [],
      musicZones: [],
      musicCues: [],
      uiCues: [],
      assets: [],
    };
    expect(RegionPack.parse(pack).landcover).toBeNull();
  });
});
