import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GrovePack, PreviewManifest, RegionPack } from "../schemas/packs";
import {
  assetsToDelete,
  assetsToFetch,
  manifestShas,
  type PackManifest,
} from "./syncDiff";

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

function sha(n: number): string {
  return n.toString(16).padStart(64, "0");
}

const homeGroveId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const fragId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const markerHash = sha(900);

function groveFixture(): GrovePack {
  return GrovePack.parse({
    schema: 4,
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
      growthCueAssetSha: sha(1),
      openingFragmentId: fragId,
      journeys: { walk: { en: "Walk" } },
    },
    characters: [
      {
        id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000020",
        publicName: { en: "Mara" },
        publicIntro: { en: "A guide." },
        portraitSha: sha(2),
        portraitAlt: { en: "Portrait of Mara" },
        homeGroveId,
      },
    ],
    fragments: [
      {
        id: fragId,
        tier: "root",
        isEnding: false,
        requires: [],
        title: { en: "Root" },
        teaser: { en: "By the reeds." },
        visibility: "physical",
        storyOrder: 1,
        retired: false,
        lat: 40.96,
        lng: -111.93,
        markerHash,
        threadIds: [],
        characters: [],
      },
    ],
    crossGroveLinks: [],
    externalPrerequisites: [],
    revisions: [
      {
        id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000040",
        fragmentId: fragId,
        revisionNo: 1,
        changeKind: "contingency",
        contingencyRevisionNo: 1,
        versions: [
          {
            lang: "en",
            timeWindow: "day",
            assetSha: sha(3),
            durationMs: 1000,
            bytes: 100,
            transcript: "Hello.",
          },
        ],
      },
    ],
    questions: [],
    music: {
      cues: [
        {
          id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000060",
          useGroveBoundary: true,
          timeWindow: "day",
          priority: 1,
          conditions: {},
          minDwellS: 0,
          crossfadeMs: 0,
          stems: [
            {
              assetSha: sha(4),
              role: "bed",
              gainDb: 0,
              stateGains: [],
            },
          ],
        },
      ],
    },
    ambienceZones: [],
    gatherings: [],
    assets: [
      { sha: sha(3), ext: "m4a", bytes: 100, kind: "narration" },
      { sha: sha(5), ext: "webp", bytes: 50, kind: "image" },
    ],
  });
}

function regionFixture(): RegionPack {
  return RegionPack.parse({
    schema: 2,
    regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
    packVersion: 1,
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
            timeWindow: "day",
            wildlifeCall: false,
            speakerSafe: true,
            assetShas: [sha(6), sha(7)],
          },
        ],
      },
    ],
    landcover: {
      gridSha: sha(8),
      h3Resolution: 9,
      classes: [{ code: "90", profileSlug: "marsh" }],
    },
    ambienceZones: [],
    musicZones: [],
    musicCues: [
      {
        id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000070",
        timeWindow: "night",
        priority: 1,
        conditions: {},
        minDwellS: 0,
        crossfadeMs: 0,
        stems: [
          { assetSha: sha(9), role: "bed", gainDb: -3, stateGains: [] },
        ],
      },
    ],
    uiCues: [{ key: "hush", language: "en", assetSha: sha(10) }],
    assets: [{ sha: sha(11), ext: "m4a", bytes: 80, kind: "sfx_bed" }],
  });
}

const NON_ASSET_KEYS = new Set(["markerHash"]);

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  for (;;) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = current.unwrap();
      continue;
    }
    if (current instanceof z.ZodDefault) {
      current = current.removeDefault();
      continue;
    }
    if (current instanceof z.ZodEffects) {
      current = current.innerType();
      continue;
    }
    return current;
  }
}

function isShaSchema(schema: z.ZodTypeAny): boolean {
  const inner = unwrap(schema);
  if (!(inner instanceof z.ZodString)) return false;
  return inner._def.checks.some(
    (check) =>
      check.kind === "regex" &&
      check.regex.source.includes("[a-f0-9]{64}"),
  );
}

/** Dotted paths of sha-bearing fields, skipping markerHash. */
function assetShaPaths(schema: z.ZodTypeAny, prefix: string[] = []): string[] {
  const inner = unwrap(schema);
  if (inner instanceof z.ZodArray) {
    const element = unwrap(inner.element);
    if (isShaSchema(element)) return [prefix.join(".")];
    return assetShaPaths(element, prefix);
  }
  if (!(inner instanceof z.ZodObject)) return [];
  const paths: string[] = [];
  for (const [key, child] of Object.entries(inner.shape)) {
    if (NON_ASSET_KEYS.has(key)) continue;
    const next = [...prefix, key];
    const field = child as z.ZodTypeAny;
    if (isShaSchema(field)) {
      paths.push(next.join("."));
      continue;
    }
    const array = unwrap(field);
    if (array instanceof z.ZodArray && isShaSchema(array.element)) {
      paths.push(next.join("."));
      continue;
    }
    paths.push(...assetShaPaths(field, next));
  }
  return paths;
}

function valuesAt(root: unknown, path: string): string[] {
  const parts = path.split(".");
  const found: string[] = [];
  const walk = (node: unknown, index: number) => {
    if (node == null) return;
    if (index === parts.length) {
      if (typeof node === "string") found.push(node);
      else if (Array.isArray(node)) {
        for (const item of node) {
          if (typeof item === "string") found.push(item);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, index);
      return;
    }
    if (typeof node === "object") {
      walk((node as Record<string, unknown>)[parts[index]!], index + 1);
    }
  };
  walk(root, 0);
  return found;
}

function expectCollectsEveryShaField(pack: PackManifest, schema: z.ZodTypeAny) {
  const paths = assetShaPaths(schema);
  expect(paths.length).toBeGreaterThan(0);
  const collected = new Set(manifestShas(pack));
  const fromFixture = new Set<string>();
  for (const path of paths) {
    const values = valuesAt(pack, path);
    expect(values, path).not.toEqual([]);
    for (const value of values) {
      fromFixture.add(value);
      expect(collected, path).toContain(value);
    }
  }
  expect(collected).toEqual(fromFixture);
}

describe("manifestShas", () => {
  it("collects every sha-bearing field on a grove pack except markerHash", () => {
    const pack = groveFixture();
    expectCollectsEveryShaField(pack, GrovePack);
    expect(manifestShas(pack)).not.toContain(markerHash);
  });

  it("collects every sha-bearing field on a region pack", () => {
    expectCollectsEveryShaField(regionFixture(), RegionPack);
  });

  it("collects grove shas and preview asset shas", () => {
    const grove = groveFixture();
    const preview = PreviewManifest.parse({
      schema: "preview/1",
      releaseId: "aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1",
      generatedAt: "2026-06-15T17:00:00.000Z",
      expiresAt: "2026-06-15T18:00:00.000Z",
      groves: [grove],
      assets: [
        {
          sha: sha(12),
          ext: "m4a",
          url: "https://example.test/a.m4a",
          expiresAt: "2026-06-15T18:00:00.000Z",
        },
      ],
    });
    expectCollectsEveryShaField(preview, PreviewManifest);
  });
});

describe("assetsToFetch", () => {
  it("returns only shas the device does not have", () => {
    const pack = groveFixture();
    const needed = manifestShas(pack);
    const missing = needed[0]!;
    expect(assetsToFetch(pack, needed.filter((item) => item !== missing))).toEqual([
      missing,
    ]);
    expect(assetsToFetch(pack, needed)).toEqual([]);
  });
});

describe("assetsToDelete", () => {
  const shared = sha(3);
  const onlyA = sha(21);
  const onlyB = sha(22);
  const orphan = sha(23);

  function groveWith(id: string, asset: string, also: string[]): GrovePack {
    const pack = groveFixture();
    return GrovePack.parse({
      ...pack,
      groveId: id,
      grove: { ...pack.grove, id, growthCueAssetSha: undefined },
      characters: [],
      revisions: [
        {
          ...pack.revisions[0],
          versions: [
            { ...pack.revisions[0]!.versions[0], assetSha: asset },
          ],
        },
      ],
      music: { cues: [] },
      assets: [
        { sha: asset, ext: "m4a", bytes: 10, kind: "narration" },
        ...also.map((item) => ({
          sha: item,
          ext: "m4a",
          bytes: 10,
          kind: "narration" as const,
        })),
      ],
    });
  }

  it("deletes assets missing from every installed manifest, and keeps one shared by two packs", () => {
    const packA = groveWith(
      "aaaaaaaa-bbbb-4ccc-8ddd-0000000000a1",
      shared,
      [onlyA],
    );
    const packB = groveWith(
      "aaaaaaaa-bbbb-4ccc-8ddd-0000000000b1",
      shared,
      [onlyB],
    );
    const local = [shared, onlyA, onlyB, orphan];

    expect(assetsToDelete(local, [packA, packB])).toEqual([orphan]);
    expect(assetsToDelete(local, [packB])).toEqual([onlyA, orphan].sort());
    expect(assetsToDelete(local, [packB])).not.toContain(shared);
    expect(assetsToDelete(local, [])).toEqual([...local].sort());
  });
});
