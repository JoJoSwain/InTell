import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  GrovePack,
  GrovePackDevice,
  PreviewManifest,
  PreviewManifestDevice,
  RegionPack,
  RegionPackDevice,
} from "./packs";

const sha =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const homeGroveId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const fragId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const cueId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000060";
const zoneId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000070";
const characterId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000020";
const otherFragId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000031";
const otherGroveId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000011";
const revisionId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000040";
const questionId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000080";
const layerId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000051";
const profileId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000050";
const musicZoneId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000090";
const regionMusicCueId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000091";
const releaseId = "aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1";

const boundary = {
  type: "MultiPolygon" as const,
  coordinates: [
    [
      [
        [-111.93, 40.96],
        [-111.92, 40.96],
        [-111.92, 40.97],
        [-111.93, 40.97],
        [-111.93, 40.96],
      ],
    ],
  ],
};

const polygon = {
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

/** Deep-clone JSON and set `unknownKey` on the object at `path` (dot + index). */
function withUnknownAt(
  base: unknown,
  path: string,
  unknownKey = "futureKey",
): unknown {
  const root = structuredClone(base) as Record<string, unknown>;
  if (path === "") {
    root[unknownKey] = "x";
    return root;
  }
  const parts = path.split(".");
  let cursor: unknown = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const idx = /^\d+$/.test(part) ? Number(part) : null;
    if (cursor == null || typeof cursor !== "object") {
      throw new Error(`missing object at ${parts.slice(0, i).join(".") || "(root)"}`);
    }
    if (idx !== null) {
      cursor = (cursor as unknown[])[idx];
    } else {
      cursor = (cursor as Record<string, unknown>)[part];
    }
  }
  if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) {
    throw new Error(`path ${path} does not end on an object`);
  }
  (cursor as Record<string, unknown>)[unknownKey] = "x";
  return root;
}

function expectDeviceStrips(
  strictSchema: z.ZodTypeAny,
  deviceSchema: z.ZodTypeAny,
  base: unknown,
  path: string,
): void {
  const dirty = withUnknownAt(base, path);
  expect(() => strictSchema.parse(dirty), `strict should reject at ${path || "(root)"}`).toThrow();
  const parsed = deviceSchema.parse(dirty) as Record<string, unknown>;
  const clean = deviceSchema.parse(base) as Record<string, unknown>;
  expect(parsed, `device should strip at ${path || "(root)"}`).toEqual(clean);
}

const richGrove = {
  schema: 4 as const,
  groveId: homeGroveId,
  regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
  packVersion: 1,
  builtAt: "2026-06-15T17:00:00.000Z",
  grove: {
    id: homeGroveId,
    name: { en: "Demo" },
    premise: { en: "Premise" },
    boundary,
    allowsSpeakerWildlifeSounds: false,
    openingFragmentId: fragId,
    journeys: {
      walk: { en: "TEST walk journey" },
      bike: { en: "TEST bike journey" },
      transit: { en: "TEST transit journey" },
    },
  },
  characters: [
    {
      id: characterId,
      publicName: { en: "Mara" },
      publicIntro: { en: "A guide." },
      portraitSha: sha,
      portraitAlt: { en: "Portrait of Mara" },
      homeGroveId,
    },
  ],
  fragments: [
    {
      id: fragId,
      tier: "root" as const,
      isEnding: false,
      requires: [] as string[][],
      title: { en: "Root" },
      teaser: { en: "By the reeds." },
      visibility: "standard" as const,
      storyOrder: 1,
      retired: false,
      lat: 40.96,
      lng: -111.93,
      radiusM: 10.67,
      threadIds: [] as string[],
      characters: [
        {
          characterId,
          prominence: "major" as const,
          introduces: true,
          cardLine: { en: "You meet Mara." },
        },
      ],
    },
  ],
  crossGroveLinks: [
    {
      fragmentId: fragId,
      otherFragmentId: otherFragId,
      otherGroveId,
      direction: "requires" as const,
      tip: { lat: 40.961, lng: -111.931 },
    },
  ],
  externalPrerequisites: [
    {
      fragmentId: fragId,
      groveId: otherGroveId,
      contingencyRevisionNo: 1,
    },
  ],
  revisions: [
    {
      id: revisionId,
      fragmentId: fragId,
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
  questions: [
    {
      id: questionId,
      text: { en: "What did you notice?" },
      requiresCompleted: false,
    },
  ],
  music: {
    cues: [
      {
        id: cueId,
        useGroveBoundary: true,
        timeWindow: "day" as const,
        priority: 1,
        conditions: { narrationPlaying: false },
        minDwellS: 0,
        crossfadeMs: 500,
        stems: [
          {
            assetSha: sha,
            role: "pad",
            gainDb: -6,
            stateGains: [{ when: { minDepthM: 5 }, gainDb: -3 }],
          },
        ],
      },
    ],
  },
  soundCues: [
    {
      kind: "beacon_root" as const,
      assetSha: sha,
    },
  ],
  ambienceZones: [
    {
      id: zoneId,
      boundary: polygon,
      profileSlug: "marsh",
      priority: 1,
      edgeFadeM: 10,
    },
  ],
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

const richRegion = {
  schema: 2 as const,
  regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
  packVersion: 0,
  builtAt: "2026-06-15T17:00:00.000Z",
  timezone: "America/Denver",
  sunReference: { lat: 40.98, lng: -111.9 },
  ambienceProfiles: [
    {
      id: profileId,
      slug: "marsh",
      name: "Marsh",
      layers: [
        {
          id: layerId,
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
  landcover: {
    gridSha: sha,
    h3Resolution: 9,
    classes: [{ code: "11", profileSlug: "marsh" }],
  },
  ambienceZones: [
    {
      id: zoneId,
      boundary: polygon,
      profileSlug: "marsh",
      priority: 1,
      edgeFadeM: 10,
    },
  ],
  musicZones: [
    {
      id: musicZoneId,
      boundary: polygon,
      edgeFadeM: 20,
    },
  ],
  musicCues: [
    {
      id: regionMusicCueId,
      zoneId: musicZoneId,
      timeWindow: "day" as const,
      priority: 1,
      conditions: { narrationPlaying: false },
      minDwellS: 0,
      crossfadeMs: 500,
      stems: [
        {
          assetSha: sha,
          role: "pad",
          gainDb: -6,
          stateGains: [{ when: { minDepthM: 5 }, gainDb: -3 }],
        },
      ],
    },
  ],
  uiCues: [
    {
      key: "arrival",
      language: "en",
      assetSha: sha,
    },
  ],
  assets: [
    {
      sha,
      ext: "m4a",
      bytes: 100,
      kind: "music_stem" as const,
    },
  ],
};

const richPreview = {
  schema: "preview/1" as const,
  releaseId,
  generatedAt: "2026-06-15T17:00:00.000Z",
  expiresAt: "2026-06-15T18:00:00.000Z",
  groves: [richGrove],
  assets: [
    {
      sha,
      ext: "m4a",
      url: "https://example.test/a.m4a",
      expiresAt: "2026-06-15T18:00:00.000Z",
    },
  ],
};

describe("GrovePackDevice deep strip", () => {
  const levels: { path: string; label: string }[] = [
    { path: "", label: "top-level" },
    { path: "grove", label: "grove" },
    { path: "grove.journeys", label: "grove.journeys" },
    { path: "characters.0", label: "characters[]" },
    { path: "fragments.0", label: "fragments[]" },
    { path: "fragments.0.characters.0", label: "fragments[].characters[]" },
    { path: "crossGroveLinks.0", label: "crossGroveLinks[]" },
    { path: "crossGroveLinks.0.tip", label: "crossGroveLinks[].tip" },
    { path: "externalPrerequisites.0", label: "externalPrerequisites[]" },
    { path: "revisions.0", label: "revisions[]" },
    { path: "revisions.0.versions.0", label: "revisions[].versions[]" },
    { path: "questions.0", label: "questions[]" },
    { path: "music", label: "music" },
    { path: "music.cues.0", label: "music.cues[]" },
    { path: "music.cues.0.stems.0", label: "music.cues[].stems[]" },
    {
      path: "music.cues.0.stems.0.stateGains.0",
      label: "music.cues[].stems[].stateGains[]",
    },
    { path: "soundCues.0", label: "soundCues[]" },
    { path: "ambienceZones.0", label: "ambienceZones[]" },
    { path: "gatherings.0", label: "gatherings[]" },
    { path: "assets.0", label: "assets[]" },
  ];

  for (const { path, label } of levels) {
    it(`strips unknown keys at ${label}`, () => {
      expectDeviceStrips(GrovePack, GrovePackDevice, richGrove, path);
    });
  }

  it("still enforces physical radiusM refine after strip", () => {
    const bad = {
      ...richGrove,
      fragments: [
        {
          ...richGrove.fragments[0]!,
          visibility: "physical" as const,
          markerHash: sha,
          radiusM: 10.67,
          futureKey: "x",
        },
      ],
    };
    expect(() => GrovePackDevice.parse(bad)).toThrow(/radiusM/i);
  });

  it("turns unknown cue condition keys into neverMatch", () => {
    const dirty = withUnknownAt(richGrove, "music.cues.0.conditions");
    expect(() => GrovePack.parse(dirty)).toThrow();
    const parsed = GrovePackDevice.parse(dirty);
    expect(parsed.music.cues[0]?.conditions).toEqual({ neverMatch: true });
  });

  it("turns unknown stem when keys into neverMatch", () => {
    const dirty = withUnknownAt(
      richGrove,
      "music.cues.0.stems.0.stateGains.0.when",
    );
    expect(() => GrovePack.parse(dirty)).toThrow();
    const parsed = GrovePackDevice.parse(dirty);
    expect(parsed.music.cues[0]?.stems[0]?.stateGains[0]?.when).toEqual({
      neverMatch: true,
    });
  });
});

describe("RegionPackDevice deep strip", () => {
  const levels: { path: string; label: string }[] = [
    { path: "", label: "top-level" },
    { path: "sunReference", label: "sunReference" },
    { path: "ambienceProfiles.0", label: "ambienceProfiles[]" },
    { path: "ambienceProfiles.0.layers.0", label: "ambienceProfiles[].layers[]" },
    { path: "landcover", label: "landcover" },
    { path: "landcover.classes.0", label: "landcover.classes[]" },
    { path: "ambienceZones.0", label: "ambienceZones[]" },
    { path: "musicZones.0", label: "musicZones[]" },
    { path: "musicCues.0", label: "musicCues[]" },
    { path: "musicCues.0.stems.0", label: "musicCues[].stems[]" },
    {
      path: "musicCues.0.stems.0.stateGains.0",
      label: "musicCues[].stems[].stateGains[]",
    },
    { path: "uiCues.0", label: "uiCues[]" },
    { path: "assets.0", label: "assets[]" },
  ];

  for (const { path, label } of levels) {
    it(`strips unknown keys at ${label}`, () => {
      expectDeviceStrips(RegionPack, RegionPackDevice, richRegion, path);
    });
  }

  it("turns unknown region cue condition keys into neverMatch", () => {
    const dirty = withUnknownAt(richRegion, "musicCues.0.conditions");
    expect(() => RegionPack.parse(dirty)).toThrow();
    const parsed = RegionPackDevice.parse(dirty);
    expect(parsed.musicCues[0]?.conditions).toEqual({ neverMatch: true });
  });
});

describe("PreviewManifestDevice deep strip", () => {
  const levels: { path: string; label: string }[] = [
    { path: "", label: "top-level" },
    { path: "groves.0", label: "groves[] (GrovePackDevice)" },
    { path: "groves.0.fragments.0", label: "groves[].fragments[]" },
    { path: "assets.0", label: "assets[]" },
  ];

  for (const { path, label } of levels) {
    it(`strips unknown keys at ${label}`, () => {
      expectDeviceStrips(
        PreviewManifest,
        PreviewManifestDevice,
        richPreview,
        path,
      );
    });
  }
});
