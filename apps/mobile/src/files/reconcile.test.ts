import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { insertCompletionIgnore, listPacks, upsertAsset, upsertPack } from "../db/repos";
import { memoryFileStore } from "./store";
import { reconcile } from "./reconcile";

test("reconcile drops a pack whose file is gone and keeps completions", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const sha = "a".repeat(64);
  await upsertPack(db, {
    scope: "grove",
    id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    manifest_json: JSON.stringify({ assets: [{ sha, ext: "wav" }] }),
    installed_at: "2026-01-01T00:00:00Z",
  });
  await upsertAsset(db, {
    sha,
    ext: "wav",
    bytes: 3,
    local_uri: `/assets/${sha}.wav`,
    last_used_at: null,
  });
  await insertCompletionIgnore(db, {
    fragment_id: "33333333-3333-4333-8333-333333333333",
    revision_no: 1,
    time_window: "day",
    completed_at: "2026-01-01T00:00:00Z",
    on_site: 1,
    trigger: "proximity",
    session_id: "s",
  });
  const files = memoryFileStore();
  await reconcile({ db, files, assetDirectory: "/assets", previewDirectory: "/preview" });
  expect(await listPacks(db)).toHaveLength(0);
  const completion = await db.getFirst<{ completed_at: string }>(
    "SELECT completed_at FROM completions",
  );
  expect(completion?.completed_at).toBe("2026-01-01T00:00:00Z");
  await db.close();
});
