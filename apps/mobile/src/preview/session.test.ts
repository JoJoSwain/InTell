import { createHash } from "node:crypto";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { listPreview, upsertAsset } from "../db/repos";
import { joinPath, memoryFileStore } from "../files/store";
import { clearPreview, storePreview } from "./session";

const INSTALLED = "a".repeat(64);
const PREVIEW = createHash("sha256").update("preview-bytes").digest("hex");
const RELEASE = "44444444-4444-4444-8444-444444444444";

test("a non-staff response writes no preview and leaves the installed asset", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const files = memoryFileStore();
  await upsertAsset(db, {
    sha: INSTALLED,
    ext: "wav",
    bytes: 1,
    local_uri: `/assets/${INSTALLED}.wav`,
    last_used_at: null,
  });
  await files.write(`/assets/${INSTALLED}.wav`, new Uint8Array([1]));
  await expect(
    storePreview({
      response: { status: 403, body: { error: "forbidden" } },
      db,
      files,
      http: async () => ({ status: 200, body: new Uint8Array() }),
      digest: async (bytes) => createHash("sha256").update(bytes).digest("hex"),
      previewDirectory: "/preview",
    }),
  ).rejects.toThrow(/refused/);
  expect(await listPreview(db)).toHaveLength(0);
  expect(await files.exists(`/assets/${INSTALLED}.wav`)).toBe(true);
  await db.close();
});

test("sign-out clears preview and asks for the exclude flag again", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const files = memoryFileStore();
  const bytes = new TextEncoder().encode("preview-bytes");
  await storePreview({
    response: {
      status: 200,
      body: {
        schema: "preview/1",
        releaseId: RELEASE,
        generatedAt: "2026-01-01T00:00:00Z",
        expiresAt: "2026-01-01T01:00:00Z",
        groves: [],
        assets: [
          {
            sha: PREVIEW,
            ext: "wav",
            url: "https://example.test/preview.wav",
            expiresAt: "2026-01-01T01:00:00Z",
          },
        ],
      },
    },
    db,
    files,
    http: async () => ({ status: 200, body: bytes }),
    digest: async (value) => createHash("sha256").update(value).digest("hex"),
    previewDirectory: "/preview",
    now: () => "2026-01-01T00:00:00Z",
  });
  expect(await files.exists(joinPath("/preview", `${PREVIEW}.wav`))).toBe(true);
  const reexclude = jest.fn();
  const signOut = jest.fn(async () => undefined);
  await clearPreview({ db, files, previewDirectory: "/preview", signOut, reexcludePreview: reexclude });
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(reexclude).toHaveBeenCalledTimes(1);
  expect(await listPreview(db)).toHaveLength(0);
  expect(await files.exists(joinPath("/preview", `${PREVIEW}.wav`))).toBe(false);
  await db.close();
});
