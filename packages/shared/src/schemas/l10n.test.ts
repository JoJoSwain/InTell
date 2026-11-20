import { describe, expect, it } from "vitest";
import { AccessNotes, L10n, pickL10n } from "./l10n";

describe("L10n", () => {
  it("accepts language maps", () => {
    const parsed = L10n.parse({ en: "Salt Marsh", es: "Marisma" });
    expect(pickL10n(parsed, "es")).toBe("Marisma");
    expect(pickL10n(parsed, "fr")).toBe("Salt Marsh");
  });
});

describe("AccessNotes", () => {
  it("accepts a partial record of optional L10n keys", () => {
    const parsed = AccessNotes.parse({
      parking: { en: "Lot A" },
      hours: { en: "Dawn to dusk" },
    });
    expect(parsed.parking?.en).toBe("Lot A");
    expect(parsed.transit).toBeUndefined();
  });

  it("rejects unknown keys", () => {
    expect(() => AccessNotes.parse({ wifi: { en: "free" } })).toThrow();
  });
});
