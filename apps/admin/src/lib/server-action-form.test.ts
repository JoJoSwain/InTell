import { describe, expect, it } from "vitest";
import { sanitizeNext } from "@/lib/auth-redirect";
import type { ServerActionResult } from "@/lib/server-action-result";

describe("V1 sanitizeNext for ServerActionForm hrefs", () => {
  it("allows relative paths and rejects absolute / protocol-relative", () => {
    expect(sanitizeNext("/media/audio", "/")).toBe("/media/audio");
    expect(sanitizeNext("/media/audio?_=1", "/")).toBe("/media/audio?_=1");
    expect(sanitizeNext("https://evil.test/x", "/")).toBe("/");
    expect(sanitizeNext("//evil.test", "/")).toBe("/");
  });
});

describe("V2 ServerActionResult failure shape", () => {
  it("discriminates ok false with error string", () => {
    const fail: ServerActionResult = { ok: false, error: "title required" };
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error).toBe("title required");
  });
});
