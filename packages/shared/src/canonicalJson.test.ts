import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  contentSha256,
  roundCoord,
  sortKeysDeep,
} from "./canonicalJson";

describe("canonicalJson", () => {
  it("sorts object keys deeply and omits whitespace", () => {
    const raw = { b: 1, a: { d: 2, c: 3 } };
    expect(canonicalJson(raw)).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(sortKeysDeep(raw)).toEqual({ a: { c: 3, d: 2 }, b: 1 });
  });

  it("rounds lat/lng to 6 decimals", () => {
    expect(canonicalJson({ lat: 40.96122185123, lng: -111.93014661234 })).toBe(
      '{"lat":40.961222,"lng":-111.930147}',
    );
    expect(roundCoord(1.2345674)).toBe(1.234567);
  });

  it("contentSha256 is stable", async () => {
    const digest = (s: string) =>
      createHash("sha256").update(s, "utf8").digest("hex");
    const a = await contentSha256({ z: 1, a: [2, 1] }, digest);
    const b = await contentSha256({ a: [2, 1], z: 1 }, digest);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
