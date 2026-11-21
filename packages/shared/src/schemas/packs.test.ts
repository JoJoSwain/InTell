import { describe, expect, it } from "vitest";
import { GrovePack, PreviewManifest, RegionPack } from "./packs";

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

const sha =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const baseGrove = {
  schema: 2 as const,
  groveId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
  regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
  packVersion: 1,
  builtAt: "2026-06-15T17:00:00.000Z",
  grove: {
    id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
    name: { en: "Demo" },
    premise: { en: "Premise" },
    accessNotes: { parking: { en: "Lot A" } },
    boundary,
    allowsSpeakerWildlifeSounds: false,
  },
  characters: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000020",
      publicName: { en: "Mara" },
      publicIntro: { en: "A guide." },
      portraitSha: sha,
      portraitAlt: { en: "Portrait of Mara" },
    },
  ],
  fragments: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000030",
      tier: "root" as const,
      isEnding: false,
      requires: [] as string[][],
      title: { en: "Root" },
      teaser: { en: "By the reeds. A beginning." },
      visibility: "standard" as const,
      storyOrder: 1,
      retired: false,
      lat: 40.96,
      lng: -111.93,
      radiusM: 10.67,
      threadIds: [] as string[],
      characters: [
        {
          characterId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000020",
          prominence: "major" as const,
          introduces: true,
          cardLine: { en: "You meet Mara." },
        },
      ],
    },
  ],
  externalPrerequisites: [] as {
    fragmentId: string;
    groveId: string;
    contingencyRevisionNo: number;
  }[],
  revisions: [
    {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000040",
      fragmentId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000030",
      revisionNo: 1,
      changeKind: "contingency" as const,
      contingencyRevisionNo: 1,
      versions: [
        {
          lang: "en",
          timeWindow: "day" as const,
          assetSha: sha,
          durationMs: 1000,
          bytes: 100,
          transcript: "Hello.",
        },
      ],
    },
  ],
  questions: [],
  music: { cues: [] },
  ambienceZones: [],
  gatherings: [
    {
      title: { en: "Dawn walk" },
      startsAt: "2026-07-01T13:00:00.000Z",
      url: "https://example.com/gather",
    },
  ],
  assets: [
    {
      sha,
      ext: "m4a",
      bytes: 100,
      kind: "narration" as const,
    },
  ],
};

describe("GrovePack schema 2", () => {
  it("accepts a minimal valid pack", () => {
    const parsed = GrovePack.parse(baseGrove);
    expect(parsed.schema).toBe(2);
    expect(parsed.regionId).toBe(baseGrove.regionId);
    expect(parsed.fragments[0]?.teaser).toEqual({
      en: "By the reeds. A beginning.",
    });
    expect(parsed.grove.allowsSpeakerWildlifeSounds).toBe(false);
  });

  it("accepts physical fragments with lat/lng and no radiusM", () => {
    const pack = {
      ...baseGrove,
      fragments: [
        {
          ...baseGrove.fragments[0],
          visibility: "physical" as const,
          lat: 40.961,
          lng: -111.931,
          markerHash: sha,
          radiusM: undefined,
        },
      ],
    };
    const { radiusM, ...physical } = pack.fragments[0]!;
    void radiusM;
    const parsed = GrovePack.parse({
      ...pack,
      fragments: [physical],
    });
    expect(parsed.fragments[0]?.visibility).toBe("physical");
    expect(parsed.fragments[0]?.lat).toBe(40.961);
    expect(parsed.fragments[0]?.radiusM).toBeUndefined();
  });

  it("rejects physical fragments that include radiusM", () => {
    const bad = {
      ...baseGrove,
      fragments: [
        {
          ...baseGrove.fragments[0],
          visibility: "physical" as const,
          markerHash: sha,
          radiusM: 10.67,
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow(/radiusM/i);
  });

  it("rejects markerCode on fragments (forbidden)", () => {
    const bad = {
      ...baseGrove,
      fragments: [
        {
          ...baseGrove.fragments[0],
          markerCode: "DEM00001",
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow();
  });

  it("rejects Story Notes fields on fragments", () => {
    const bad = {
      ...baseGrove,
      fragments: [
        {
          ...baseGrove.fragments[0],
          notes: "internal",
          indigenyEarth: "secret",
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow();
  });

  it("rejects Story Notes fields on characters", () => {
    const bad = {
      ...baseGrove,
      characters: [
        {
          ...baseGrove.characters[0],
          notes: "staff only",
        },
      ],
    };
    expect(() => GrovePack.parse(bad)).toThrow();
  });

  it("rejects nested site and removed v2 keys", () => {
    expect(() =>
      GrovePack.parse({
        ...baseGrove,
        grove: {
          ...baseGrove.grove,
          site: { name: "old" },
        },
      }),
    ).toThrow();
    expect(() =>
      GrovePack.parse({
        ...baseGrove,
        rings: [],
      }),
    ).toThrow();
    expect(() =>
      GrovePack.parse({
        ...baseGrove,
        crossroads: [],
      }),
    ).toThrow();
    expect(() =>
      GrovePack.parse({
        ...baseGrove,
        ledger: [],
      }),
    ).toThrow();
  });

  it("accepts externalPrerequisites and image assets", () => {
    const parsed = GrovePack.parse({
      ...baseGrove,
      externalPrerequisites: [
        {
          fragmentId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000099",
          groveId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000011",
          contingencyRevisionNo: 2,
        },
      ],
      assets: [
        ...baseGrove.assets,
        { sha: sha.replace(/^a/, "b"), ext: "webp", bytes: 50, kind: "image" },
      ],
    });
    expect(parsed.externalPrerequisites).toHaveLength(1);
    expect(parsed.assets.some((a) => a.kind === "image")).toBe(true);
  });
});

describe("PreviewManifest", () => {
  it("accepts schema preview/1 with GrovePack groves", () => {
    const grove = GrovePack.parse(baseGrove);
    const parsed = PreviewManifest.parse({
      schema: "preview/1",
      releaseId: "aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1",
      generatedAt: "2026-06-15T17:00:00.000Z",
      expiresAt: "2026-06-15T18:00:00.000Z",
      groves: [grove],
      assets: [
        {
          sha,
          ext: "m4a",
          url: "https://example.test/a.m4a",
          expiresAt: "2026-06-15T18:00:00.000Z",
        },
      ],
    });
    expect(parsed.schema).toBe("preview/1");
    expect(parsed.groves).toHaveLength(1);
  });
});

describe("RegionPack schema 2", () => {
  it("requires timezone, sunReference, and layer timeWindow", () => {
    const pack = {
      schema: 2 as const,
      regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
      packVersion: 0,
      builtAt: "2026-06-15T17:00:00.000Z",
      timezone: "America/Denver",
      sunReference: { lat: 40.98, lng: -111.9 },
      ambienceProfiles: [
        {
          id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000050",
          slug: "marsh",
          name: "Marsh",
          layers: [
            {
              id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000051",
              name: "Day bed",
              kind: "bed",
              timeWindow: "day" as const,
              wildlifeCall: false,
              speakerSafe: true,
              assetShas: [sha],
            },
          ],
        },
      ],
      landcover: null,
      ambienceZones: [],
      musicZones: [],
      musicCues: [],
      uiCues: [],
      assets: [],
    };
    const parsed = RegionPack.parse(pack);
    expect(parsed.schema).toBe(2);
    expect(parsed.timezone).toBe("America/Denver");
    expect(parsed.ambienceProfiles[0]?.name).toBe("Marsh");
    expect(parsed.ambienceProfiles[0]?.layers[0]?.timeWindow).toBe("day");
  });

  it("allows null landcover", () => {
    const pack = {
      schema: 2 as const,
      regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
      packVersion: 0,
      builtAt: "2026-06-15T17:00:00.000Z",
      timezone: "America/Denver",
      sunReference: { lat: 40.98, lng: -111.9 },
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
