import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./auth-redirect";

describe("sanitizeNext (R2)", () => {
  it("allows relative paths", () => {
    expect(sanitizeNext("/auth/set-password")).toBe("/auth/set-password");
    expect(sanitizeNext("/")).toBe("/");
    expect(sanitizeNext("/regions/new")).toBe("/regions/new");
  });

  it("rejects absolute and protocol-relative next", () => {
    expect(sanitizeNext("//evil.example")).toBe("/auth/set-password");
    expect(sanitizeNext("https://evil.example")).toBe("/auth/set-password");
    expect(sanitizeNext("http://evil.example/phish")).toBe(
      "/auth/set-password",
    );
    expect(sanitizeNext("/\\evil.example")).toBe("/auth/set-password");
  });

  it("uses a custom fallback", () => {
    expect(sanitizeNext("https://evil.example", "/")).toBe("/");
    expect(sanitizeNext(null, "/sign-in")).toBe("/sign-in");
  });
});
