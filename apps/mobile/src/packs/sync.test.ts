import { GrovePack, RegionPack, type PackIndexEntry } from "@intell/shared";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { listAssets, upsertAsset, upsertPack } from "../db/repos";
import { memoryFileStore } from "../files/store";
import { syncContent } from "./sync";

const KEEP = "b".repeat(64);
const DROP = "c".repeat(64);
const GROVE = "11111111-1111-4111-8111-111111111111";
const OTHER = "44444444-4444-4444-8444-444444444444";
const REGION = "22222222-2222-4222-8222-222222222222";
const FRAGMENT = "33333333-3333-4333-8333-333333333333";

function groveManifest(regionId: string): string {
  return JSON.stringify(
    GrovePack.parse({
      schema: 4,
      groveId: GROVE,
      regionId,
      packVersion: 1,
      builtAt: "2026-01-01T00:00:00Z",
      grove: {
        id: GROVE,
        name: { en: "Demo" },
        premise: { en: "A test grove" },
        boundary: {
          type: "MultiPolygon",
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
        },
        allowsSpeakerWildlifeSounds: false,
        openingFragmentId: FRAGMENT,
        journeys: {},
      },
      characters: [],
      crossGroveLinks: [],
      fragments: [
        {
          id: FRAGMENT,
          tier: "root",
          isEnding: false,
          requires: [],
          title: { en: "Root" },
          teaser: { en: "Teaser" },
          visibility: "standard",
          storyOrder: 1,
          retired: false,
          lat: 0,
          lng: 0,
          radiusM: 10,
          threadIds: [],
          characters: [],
        },
      ],
      externalPrerequisites: [],
      revisions: [],
      questions: [],
      music: { cues: [] },
      ambienceZones: [],
      gatherings: [],
      assets: [{ sha: KEEP, ext: "wav", bytes: 1, kind: "narration" }],
    }),
  );
}

function indexEntry(over: Partial<PackIndexEntry> = {}): PackIndexEntry {
  return {
    scope: "grove",
    id: GROVE,
    version: 1,
    manifestPath: "packs/grove/x/1.json",
    manifestSha256: "d".repeat(64),
    bytesTotal: 1,
    name: { en: "Demo" },
    bbox: [0, 0, 1, 1],
    ...over,
  };
}

test("sync deletes an asset missing from every kept manifest", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const files = memoryFileStore();
  await files.write(`/assets/${KEEP}.wav`, new Uint8Array([1]));
  await files.write(`/assets/${DROP}.wav`, new Uint8Array([2]));
  await upsertPack(db, {
    scope: "grove",
    id: GROVE,
    version: 1,
    manifest_json: groveManifest(REGION),
    installed_at: "2026-01-01T00:00:00Z",
  });
  await upsertAsset(db, { sha: KEEP, ext: "wav", bytes: 1, local_uri: `/assets/${KEEP}.wav`, last_used_at: null });
  await upsertAsset(db, { sha: DROP, ext: "wav", bytes: 1, local_uri: `/assets/${DROP}.wav`, last_used_at: null });

  await syncContent({
    transport: "wifi",
    confirmCellular: async () => false,
    fetchIndex: async () => [indexEntry()],
    install: async () => {
      throw new Error("install should not run for the current version");
    },
    db,
    files,
  });

  const shas = (await listAssets(db)).map((asset) => asset.sha);
  expect(shas).toEqual([KEEP]);
  expect(await files.exists(`/assets/${DROP}.wav`)).toBe(false);
  await db.close();
});

test("a declined cellular download does not install", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  await upsertPack(db, {
    scope: "grove",
    id: GROVE,
    version: 1,
    manifest_json: groveManifest(REGION),
    installed_at: "2026-01-01T00:00:00Z",
  });
  const install = jest.fn(async () => undefined);
  await syncContent({
    transport: "cellular",
    confirmCellular: async () => false,
    fetchIndex: async () => [indexEntry({ version: 2 })],
    install,
    db,
    files: memoryFileStore(),
  });
  expect(install).not.toHaveBeenCalled();
  await db.close();
});

test("a grove in the index that isn't installed is never downloaded by sync", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const install = jest.fn(async () => undefined);
  await syncContent({
    transport: "wifi",
    confirmCellular: async () => true,
    fetchIndex: async () => [indexEntry(), indexEntry({ id: OTHER })],
    install,
    db,
    files: memoryFileStore(),
  });
  expect(install).not.toHaveBeenCalled();
  await db.close();
});

test("an installed grove with a newer version is updated", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  await upsertPack(db, {
    scope: "grove",
    id: GROVE,
    version: 1,
    manifest_json: groveManifest(REGION),
    installed_at: "2026-01-01T00:00:00Z",
  });
  const install = jest.fn(async () => undefined);
  const newer = indexEntry({ version: 2 });
  await syncContent({
    transport: "wifi",
    confirmCellular: async () => true,
    fetchIndex: async () => [newer, indexEntry({ id: OTHER, version: 3 })],
    install,
    db,
    files: memoryFileStore(),
  });
  expect(install).toHaveBeenCalledTimes(1);
  expect(install).toHaveBeenCalledWith(newer);
  await db.close();
});

test("the region pack follows an installed grove", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  await upsertPack(db, {
    scope: "grove",
    id: GROVE,
    version: 1,
    manifest_json: groveManifest(REGION),
    installed_at: "2026-01-01T00:00:00Z",
  });
  const install = jest.fn(async () => undefined);
  const region = indexEntry({ scope: "region", id: REGION, version: 1, manifestPath: "packs/region/x/1.json" });
  const otherRegion = indexEntry({
    scope: "region",
    id: OTHER,
    version: 4,
    manifestPath: "packs/region/y/4.json",
  });
  await syncContent({
    transport: "wifi",
    confirmCellular: async () => true,
    fetchIndex: async () => [indexEntry(), region, otherRegion],
    install,
    db,
    files: memoryFileStore(),
  });
  expect(install).toHaveBeenCalledTimes(1);
  expect(install).toHaveBeenCalledWith(region);

  await upsertPack(db, {
    scope: "region",
    id: REGION,
    version: 1,
    manifest_json: JSON.stringify(
      RegionPack.parse({
        schema: 2,
        regionId: REGION,
        packVersion: 1,
        builtAt: "2026-01-01T00:00:00Z",
        timezone: "America/Denver",
        sunReference: { lat: 0, lng: 0 },
        ambienceProfiles: [],
        landcover: null,
        ambienceZones: [],
        musicZones: [],
        musicCues: [],
        uiCues: [],
        assets: [],
      }),
    ),
    installed_at: "2026-01-01T00:00:00Z",
  });
  install.mockClear();
  const newerRegion = indexEntry({ scope: "region", id: REGION, version: 2, manifestPath: "packs/region/x/2.json" });
  await syncContent({
    transport: "wifi",
    confirmCellular: async () => true,
    fetchIndex: async () => [indexEntry(), newerRegion],
    install,
    db,
    files: memoryFileStore(),
  });
  expect(install).toHaveBeenCalledTimes(1);
  expect(install).toHaveBeenCalledWith(newerRegion);
  await db.close();
});

test("an installed grove whose stored manifest fails to parse is reinstalled", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const files = memoryFileStore();
  await files.write(`/assets/${KEEP}.wav`, new Uint8Array([1]));
  await upsertPack(db, {
    scope: "grove",
    id: GROVE,
    version: 4,
    manifest_json: JSON.stringify({ schema: 99, regionId: REGION, assets: [{ sha: KEEP }] }),
    installed_at: "2026-01-01T00:00:00Z",
  });
  await upsertAsset(db, { sha: KEEP, ext: "wav", bytes: 1, local_uri: `/assets/${KEEP}.wav`, last_used_at: null });
  const install = jest.fn(async () => undefined);
  const grove = indexEntry({ version: 1 });
  const region = indexEntry({ scope: "region", id: REGION, version: 1, manifestPath: "packs/region/x/1.json" });
  await syncContent({
    transport: "wifi",
    confirmCellular: async () => true,
    fetchIndex: async () => [grove, region],
    install,
    db,
    files,
  });
  expect(install).toHaveBeenCalledWith(grove);
  expect(install).toHaveBeenCalledWith(region);
  expect((await listAssets(db)).map((asset) => asset.sha)).toEqual([KEEP]);
  expect(await files.exists(`/assets/${KEEP}.wav`)).toBe(true);
  await db.close();
});
