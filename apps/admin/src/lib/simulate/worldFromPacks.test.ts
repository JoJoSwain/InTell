import { describe, expect, it } from "vitest";
import { worldFromPacks } from "./worldFromPacks";

const sha =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const groveId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const regionId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const fragId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const fragBranch = "aaaaaaaa-bbbb-4ccc-8ddd-000000000031";
const zonePoly = {
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

const fixtureGrove = {
  schema: 4 as const,
  groveId,
  regionId,
  packVersion: 1,
  builtAt: "2026-06-15T17:00:00.000Z",
  grove: {
    id: groveId,
    name: { en: "Demo" },
    premise: { en: "Premise" },
    boundary: {
      type: "MultiPolygon" as const,
      coordinates: [[zonePoly.coordinates[0]!]],
    },
    allowsSpeakerWildlifeSounds: false,
    depthBloomTextureM: 15,
    openingFragmentId: fragId,
    journeys: {
      walk: { en: "walk" },
      bike: { en: "bike" },
      transit: { en: "transit" },
    },
  },
  characters: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000020",
      publicName: { en: "Mara" },
      publicIntro: { en: "A guide." },
      portraitSha: sha,
      portraitAlt: { en: "Portrait" },
      homeGroveId: groveId,
    },
  ],
  fragments: [
    {
      id: fragId,
      tier: "root" as const,
      isEnding: false,
      requires: [] as string[][],
      title: { en: "Beginning" },
      teaser: { en: "Teaser" },
      visibility: "standard" as const,
      storyOrder: 1,
      retired: false,
      lat: 40.96122,
      lng: -111.92896,
      radiusM: 10.67,
      threadIds: [] as string[],
      characters: [],
      beaconAssetSha: sha,
    },
    {
      id: fragBranch,
      tier: "branch" as const,
      isEnding: false,
      requires: [[fragId]],
      title: { en: "Branch" },
      teaser: { en: "Branch teaser" },
      visibility: "standard" as const,
      storyOrder: 2,
      retired: false,
      lat: 40.96116,
      lng: -111.92843,
      radiusM: 10.67,
      threadIds: [] as string[],
      characters: [],
      teaserLockedAssetSha: sha,
    },
  ],
  crossGroveLinks: [],
  externalPrerequisites: [],
  revisions: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000040",
      fragmentId: fragId,
      revisionNo: 1,
      changeKind: "contingency" as const,
      contingencyRevisionNo: 1,
      versions: [
        {
          lang: "en",
          timeWindow: "day" as const,
          assetSha: sha,
          durationMs: 5000,
          bytes: 100,
          transcript: "Hello.",
          breathPointsMs: [1000, 3000],
          swellCuesMs: [2000],
        },
      ],
    },
  ],
  questions: [],
  music: {
    cues: [
      {
        id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000050",
        useGroveBoundary: true,
        edgeFadeM: 60,
        timeWindow: "day" as const,
        priority: 50,
        conditions: {},
        minDwellS: 0,
        crossfadeMs: 6000,
        stems: [
          {
            assetSha: sha,
            role: "base",
            gainDb: 0,
            stateGains: [],
          },
        ],
        resolveRootAssetSha: sha,
      },
    ],
  },
  soundCues: [
    { kind: "threshold_motif_day" as const, assetSha: sha },
  ],
  ambienceZones: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000060",
      boundary: zonePoly,
      profileSlug: "marsh",
      priority: 100,
      edgeFadeM: 40,
    },
  ],
  gatherings: [],
  assets: [{ sha, ext: "m4a", bytes: 100, kind: "narration" as const }],
};

const fixtureRegion = {
  schema: 2 as const,
  regionId,
  packVersion: 1,
  builtAt: "2026-06-15T17:00:00.000Z",
  timezone: "America/Denver",
  sunReference: { lat: 40.96, lng: -111.92 },
  ambienceProfiles: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000070",
      slug: "marsh",
      name: "Marsh",
      density: 1,
      layers: [
        {
          id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000071",
          name: "bed day",
          kind: "bed",
          timeWindow: "day" as const,
          wildlifeCall: false,
          speakerSafe: true,
          assetShas: [sha],
          months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        },
        {
          id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000072",
          name: "wildlife",
          kind: "oneshot",
          timeWindow: "day" as const,
          wildlifeCall: true,
          speakerSafe: false,
          assetShas: [sha],
          months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        },
      ],
    },
  ],
  landcover: {
    gridSha: sha,
    h3Resolution: 9,
    classes: [{ code: "90", profileSlug: "marsh" }],
  },
  ambienceZones: [],
  musicZones: [],
  musicCues: [],
  uiCues: [],
  assets: [{ sha, ext: "m4a", bytes: 100, kind: "sfx_bed" as const }],
};

describe("worldFromPacks", () => {
  it("loads a fixture preview grove+region into SimulatorWorld", () => {
    const result = worldFromPacks({
      grove: fixtureGrove,
      region: fixtureRegion,
      assets: [
        {
          sha,
          ext: "m4a",
          url: "https://example.test/a.m4a",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(result.empty).toBe(false);
    expect(result.world.groveId).toBe(groveId);
    expect(result.world.fragments).toHaveLength(2);
    expect(result.world.fragments[0]?.title).toBe("Beginning");
    expect(result.world.cues.some((c) => c.timeWindow === "day")).toBe(true);
    expect(result.world.profiles[0]?.slug).toBe("marsh");
    expect(result.world.ambienceZones[0]?.profileSlug).toBe("marsh");
    expect(result.world.motifDaySha).toBe(sha);
    expect(result.breathByFragment[fragId]).toEqual([1000, 3000]);
    expect(result.swellByFragment[fragId]).toEqual([2000]);
    expect(result.assetUrls.get(sha)).toContain("example.test");
    expect(result.origin.lat).toBeCloseTo(40.96122, 4);
  });

  it("rejects invalid grove packs via strict schema", () => {
    expect(() =>
      worldFromPacks({
        grove: { ...fixtureGrove, schema: 3 },
        region: fixtureRegion,
      }),
    ).toThrow();
  });
});
