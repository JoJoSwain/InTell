import type { PackIndexEntry } from "@intell/shared";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { listAssets, upsertAsset, upsertPack } from "../db/repos";
import { memoryFileStore } from "../files/store";
import { syncContent } from "./sync";

const KEEP = "b".repeat(64);
const DROP = "c".repeat(64);
const GROVE = "11111111-1111-4111-8111-111111111111";

function indexEntry(): PackIndexEntry {
  return {
    scope: "grove",
    id: GROVE,
    version: 1,
    manifestPath: "packs/grove/x/1.json",
    manifestSha256: "d".repeat(64),
    bytesTotal: 1,
    name: { en: "Demo" },
    bbox: [0, 0, 1, 1],
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
    manifest_json: JSON.stringify({ assets: [{ sha: KEEP }] }),
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
  const install = jest.fn(async () => undefined);
  await syncContent({
    transport: "cellular",
    confirmCellular: async () => false,
    fetchIndex: async () => [indexEntry()],
    install,
    db,
    files: memoryFileStore(),
  });
  expect(install).not.toHaveBeenCalled();
  await db.close();
});
