import { describe, expect, it } from "vitest";
import {
  ARCHIVE_TTL_SEC,
  archiveExpiresAt,
  exportAuditInsert,
  handleExportArchive,
  parseStagingPath,
  signManifestAssets,
  type ExportDeps,
} from "../../../supabase/functions/export-archive/handler.ts";

function baseDeps(overrides: Partial<ExportDeps> = {}): {
  deps: ExportDeps;
  logs: string[];
} {
  const logs: string[] = [];
  const deps: ExportDeps = {
    log: (event) => logs.push(`export-archive ${event}`),
    buildFiles: async () => ({
      files: [{ path: "manifest.json", content: '{"version":1}' }],
      scope: { regionId: null },
    }),
    zip: async () => new Uint8Array([0x50, 0x4b]),
    audit: async () => undefined,
    ...overrides,
  };
  return { deps, logs };
}

describe("export-archive handler", () => {
  it("returns 400 for a bad body", async () => {
    const { deps, logs } = baseDeps();
    const res = await handleExportArchive({ regionId: "not-a-uuid" }, deps);
    expect(res.status).toBe(400);
    expect(logs.some((l) => l.includes("invalid-body"))).toBe(true);
  });

  it("returns a zip on success", async () => {
    const { deps, logs } = baseDeps();
    const res = await handleExportArchive({}, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50);
    expect(logs.some((l) => l.endsWith(" ok"))).toBe(true);
  });

  it("records an audit row with the actor, export_archive, and scope", async () => {
    const actor = "bbbbbbbb-bbbb-4ccc-8ddd-000000000099";
    const regionId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
    const rows: ReturnType<typeof exportAuditInsert>[] = [];
    const { deps } = baseDeps({
      buildFiles: async () => ({
        files: [{ path: "manifest.json", content: "{}" }],
        scope: { regionId },
      }),
      audit: async (scope) => {
        rows.push(exportAuditInsert(actor, scope));
      },
    });
    const res = await handleExportArchive({ regionId }, deps);
    expect(res.status).toBe(200);
    expect(rows).toEqual([
      {
        actor,
        action: "export_archive",
        entity: "region",
        entity_id: regionId,
        detail: { scope: regionId },
      },
    ]);

    const all = exportAuditInsert(actor, { regionId: null });
    expect(all.action).toBe("export_archive");
    expect(all.detail.scope).toBe("all");
    expect(all.actor).toBe(actor);
  });

  it("signs every manifest asset with a url and expiresAt", async () => {
    const expiresAt = archiveExpiresAt(1_700_000_000_000, ARCHIVE_TTL_SEC);
    expect(parseStagingPath("staging-audio/abc.m4a")).toEqual({
      bucket: "staging-audio",
      objectPath: "abc.m4a",
    });
    const signed = await signManifestAssets(
      [
        {
          sha256: "aaa",
          kind: "narration",
          storagePath: "staging-audio/aaa.m4a",
          media: "audio",
          isPublic: false,
          ext: "m4a",
        },
        {
          sha256: "bbb",
          kind: "image",
          storagePath: "staging-images/bbb.png",
          media: "image",
          isPublic: true,
          ext: "png",
        },
      ],
      expiresAt,
      async (bucket, objectPath) =>
        `https://signed.test/${bucket}/${objectPath}?token=1`,
    );
    expect(signed).toHaveLength(2);
    for (const asset of signed) {
      expect(asset.url).toMatch(/^https:\/\/signed\.test\//);
      expect(asset.expiresAt).toBe(expiresAt);
    }
  });

  it("returns 404 when region is missing", async () => {
    const { deps } = baseDeps({
      buildFiles: async () => ({ error: "region not found", status: 404 }),
    });
    const res = await handleExportArchive(
      { regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001" },
      deps,
    );
    expect(res.status).toBe(404);
  });
});
