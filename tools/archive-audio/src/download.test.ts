import { describe, expect, it } from "vitest";
import {
  downloadManifestAssets,
  sha256Hex,
  urlsExpired,
} from "./download.mjs";

const SHA_A = sha256Hex(Buffer.from("audio-bytes"));
const SHA_B = sha256Hex(Buffer.from("image-bytes"));

describe("archive-audio download", () => {
  it("treats expiresAt in the past as expired", () => {
    expect(urlsExpired("2020-01-01T00:00:00.000Z", Date.parse("2026-01-01"))).toBe(
      true,
    );
    expect(
      urlsExpired("2030-01-01T00:00:00.000Z", Date.parse("2026-01-01")),
    ).toBe(false);
  });

  it("skips files already present with a matching sha", async () => {
    const writes: string[] = [];
    const summary = await downloadManifestAssets(
      [
        {
          sha256: SHA_A,
          ext: "m4a",
          media: "audio",
          url: "https://example.test/a",
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
      ],
      "/archive",
      {
        readFile: async () => Buffer.from("audio-bytes"),
        writeFile: async (p) => {
          writes.push(p);
        },
        fetchBytes: async () => {
          throw new Error("should not fetch");
        },
      },
    );
    expect(summary).toEqual({
      downloaded: 0,
      alreadyPresent: 1,
      failed: [],
    });
    expect(writes).toEqual([]);
  });

  it("fails on a sha256 mismatch and does not write", async () => {
    const writes: string[] = [];
    const summary = await downloadManifestAssets(
      [
        {
          sha256: SHA_A,
          ext: "m4a",
          media: "audio",
          url: "https://example.test/a",
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
      ],
      "/archive",
      {
        readFile: async () => null,
        writeFile: async (p) => {
          writes.push(p);
        },
        fetchBytes: async () => ({
          ok: true,
          bytes: new TextEncoder().encode("wrong"),
        }),
      },
    );
    expect(summary.downloaded).toBe(0);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0]?.reason).toMatch(/sha256 mismatch/);
    expect(writes).toEqual([]);
  });

  it("downloads when the sha matches", async () => {
    const writes: { path: string; size: number }[] = [];
    const summary = await downloadManifestAssets(
      [
        {
          sha256: SHA_B,
          ext: "png",
          media: "image",
          url: "https://example.test/b",
          expiresAt: "2030-01-01T00:00:00.000Z",
        },
      ],
      "/archive",
      {
        readFile: async () => null,
        writeFile: async (p, bytes) => {
          writes.push({ path: p, size: bytes.byteLength });
        },
        fetchBytes: async () => ({
          ok: true,
          bytes: new TextEncoder().encode("image-bytes"),
        }),
      },
    );
    expect(summary.downloaded).toBe(1);
    expect(summary.failed).toEqual([]);
    expect(writes[0]?.path.replace(/\\/g, "/")).toContain(
      `/images/${SHA_B}.png`,
    );
  });

  it("tells staff to re-export when the URL has expired", async () => {
    const summary = await downloadManifestAssets(
      [
        {
          sha256: SHA_A,
          ext: "m4a",
          media: "audio",
          url: "https://example.test/a",
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      "/archive",
      {
        nowMs: Date.parse("2026-06-01T00:00:00.000Z"),
        readFile: async () => null,
        writeFile: async () => undefined,
        fetchBytes: async () => {
          throw new Error("should not fetch");
        },
      },
    );
    expect(summary.failed[0]?.reason).toMatch(/export again/i);
  });
});
