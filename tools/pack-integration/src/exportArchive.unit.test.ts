import { describe, expect, it } from "vitest";
import {
  handleExportArchive,
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
