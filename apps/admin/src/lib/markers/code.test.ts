import { describe, expect, it } from "vitest";
import {
  generateMarkerCode,
  hashMarkerCode,
  isValidMarkerCode,
  MARKER_ALPHABET,
} from "./code";

describe("marker code", () => {
  it("generates 8 Crockford base32 chars", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateMarkerCode();
      expect(code).toHaveLength(8);
      expect(isValidMarkerCode(code)).toBe(true);
      for (const ch of code) {
        expect(MARKER_ALPHABET).toContain(ch);
      }
    }
  });

  it("hashes upper-case UTF-8 sha256", async () => {
    const hex = await hashMarkerCode("dem00001");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(hex).toBe(await hashMarkerCode("DEM00001"));
  });
});
