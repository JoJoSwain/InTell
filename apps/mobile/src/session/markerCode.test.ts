import { createHash } from "node:crypto";
import { hashMarkerCode, hashMarkerCodeSync, normalizeMarkerCode } from "./markerCode";

describe("markerCode", () => {
  it("upper-cases before hashing", async () => {
    expect(normalizeMarkerCode(" ab12 ")).toBe("AB12");
    const a = await hashMarkerCode("ab12");
    const b = await hashMarkerCode("AB12");
    expect(a).toBe(b);
    expect(a).toBe(
      createHash("sha256").update("AB12", "utf8").digest("hex"),
    );
  });

  it("sync helper matches", () => {
    const hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
    expect(hashMarkerCodeSync("xy", hex)).toBe(hex("XY"));
  });
});
