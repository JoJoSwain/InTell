import { createHash } from "node:crypto";
import { GrovePack, type PackIndexEntry } from "@intell/shared";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { listPacks } from "../db/repos";
import { joinPath, memoryFileStore } from "../files/store";
import { publicMediaUrl } from "../api/mediaUrl";
import { MissingObjectError, ShaMismatchError, installPack, type HttpGet } from "./install";

const GROVE = "11111111-1111-4111-8111-111111111111";
const REGION = "22222222-2222-4222-8222-222222222222";
const FRAGMENT = "33333333-3333-4333-8333-333333333333";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const digest = async (bytes: Uint8Array) => sha256(bytes);

function groveManifest(assetSha: string, assetBytes: number, version = 1, extra: { sha: string; bytes: number }[] = []): Uint8Array {
  const pack = GrovePack.parse({
    schema: 3,
    groveId: GROVE,
    regionId: REGION,
    packVersion: version,
    builtAt: "2026-01-01T00:00:00Z",
    grove: {
      id: GROVE,
      name: { en: "Demo" },
      premise: { en: "A test grove" },
      boundary: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      allowsSpeakerWildlifeSounds: false,
      openingFragmentId: FRAGMENT,
      journeys: {},
    },
    characters: [],
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
    assets: [
      { sha: assetSha, ext: "wav", bytes: assetBytes, kind: "narration" },
      ...extra.map((asset) => ({ sha: asset.sha, ext: "wav", bytes: asset.bytes, kind: "narration" as const })),
    ],
  });
  return new TextEncoder().encode(JSON.stringify(pack));
}

function entry(manifest: Uint8Array, version = 1): PackIndexEntry {
  return {
    scope: "grove",
    id: GROVE,
    version,
    manifestPath: `packs/grove/${GROVE}/${version}.json`,
    manifestSha256: sha256(manifest),
    bytesTotal: manifest.byteLength,
    name: { en: "Demo" },
    bbox: [0, 0, 1, 1],
  };
}

test("a failed download leaves no pack and a retry skips a verified file", async () => {
  const asset = new TextEncoder().encode("narration");
  const assetSha = sha256(asset);
  const manifest = groveManifest(assetSha, asset.byteLength);
  const index = entry(manifest);
  const files = memoryFileStore();
  const db = openNodeSqlite();
  await migrate(db);
  const calls: string[] = [];
  let exploded = false;
  const flaky = {
    ...files,
    write: async (uri: string, bytes: Uint8Array) => {
      await files.write(uri, bytes);
      if (!exploded && uri.includes(assetSha)) {
        exploded = true;
        throw new Error("network dropped");
      }
    },
  };
  const http: HttpGet = async (url) => {
    calls.push(url);
    if (url.endsWith("1.json")) return { status: 200, body: manifest };
    return { status: 200, body: asset };
  };
  const args = {
    entry: index,
    supabaseUrl: "http://127.0.0.1:54321",
    http,
    files: flaky,
    db,
    digest,
    assetDirectory: "/assets",
    stagingDirectory: "/staging",
    now: () => "2026-01-01T00:00:00Z",
  };

  await expect(installPack(args)).rejects.toThrow("network dropped");
  expect(await listPacks(db)).toHaveLength(0);

  const before = calls.length;
  await installPack(args);
  const assetUrl = publicMediaUrl("http://127.0.0.1:54321", `a/${assetSha}.wav`);
  const assetCalls = calls.slice(before).filter((url) => url === assetUrl);
  expect(assetCalls).toHaveLength(0);
  expect(await files.exists(joinPath("/assets", `${assetSha}.wav`))).toBe(true);
  expect(await listPacks(db)).toHaveLength(1);
  await db.close();
});

test("a bad asset sha writes no pack", async () => {
  const asset = new TextEncoder().encode("narration");
  const manifest = groveManifest(sha256(new TextEncoder().encode("other")), asset.byteLength);
  const db = openNodeSqlite();
  await migrate(db);
  await expect(
    installPack({
      entry: entry(manifest),
      supabaseUrl: "http://127.0.0.1:54321",
      http: async (url) => ({ status: 200, body: url.endsWith(".json") ? manifest : asset }),
      files: memoryFileStore(),
      db,
      digest,
      assetDirectory: "/assets",
      stagingDirectory: "/staging",
    }),
  ).rejects.toBeInstanceOf(ShaMismatchError);
  expect(await listPacks(db)).toHaveLength(0);
  await db.close();
});

test("storage 400 and 404 are missing", async () => {
  const asset = new TextEncoder().encode("narration");
  const assetSha = sha256(asset);
  const manifest = groveManifest(assetSha, asset.byteLength);
  const db = openNodeSqlite();
  await migrate(db);
  for (const status of [400, 404]) {
    await expect(
      installPack({
        entry: entry(manifest),
        supabaseUrl: "http://127.0.0.1:54321",
        http: async (url) => ({ status: url.endsWith(".json") ? 200 : status, body: manifest }),
        files: memoryFileStore(),
        db,
        digest,
        assetDirectory: "/assets",
        stagingDirectory: "/staging",
      }),
    ).rejects.toBeInstanceOf(MissingObjectError);
  }
  expect(await listPacks(db)).toHaveLength(0);
  await db.close();
});

test("an update downloads only new shas and keeps the shared file", async () => {
  const shared = new TextEncoder().encode("shared");
  const added = new TextEncoder().encode("added");
  const sharedSha = sha256(shared);
  const addedSha = sha256(added);
  const first = groveManifest(sharedSha, shared.byteLength, 1);
  const second = groveManifest(sharedSha, shared.byteLength, 2, [{ sha: addedSha, bytes: added.byteLength }]);
  const files = memoryFileStore();
  const db = openNodeSqlite();
  await migrate(db);
  const calls: string[] = [];
  const http: HttpGet = async (url) => {
    calls.push(url);
    if (url.endsWith(".json")) return { status: 200, body: url.includes("/2.json") ? second : first };
    if (url.includes(addedSha)) return { status: 200, body: added };
    return { status: 200, body: shared };
  };
  const base = {
    supabaseUrl: "http://127.0.0.1:54321",
    http,
    files,
    db,
    digest,
    assetDirectory: "/assets",
    stagingDirectory: "/staging",
    now: () => "2026-01-01T00:00:00Z",
  };
  await installPack({ ...base, entry: entry(first, 1) });
  const sharedPath = joinPath("/assets", `${sharedSha}.wav`);
  calls.length = 0;
  await installPack({ ...base, entry: entry(second, 2) });
  const sharedUrl = publicMediaUrl("http://127.0.0.1:54321", `a/${sharedSha}.wav`);
  const addedUrl = publicMediaUrl("http://127.0.0.1:54321", `a/${addedSha}.wav`);
  expect(calls.filter((url) => url === sharedUrl)).toHaveLength(0);
  expect(calls.filter((url) => url === addedUrl)).toHaveLength(1);
  expect(await files.exists(sharedPath)).toBe(true);
  const packs = await listPacks(db);
  expect(packs).toHaveLength(1);
  expect(packs[0]?.version).toBe(2);
  await db.close();
});
