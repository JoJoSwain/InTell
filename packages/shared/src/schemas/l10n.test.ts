import { describe, expect, it } from "vitest";
import { L10n, pickL10n } from "./l10n";

describe("L10n", () => {
  it("accepts language maps", () => {
    const parsed = L10n.parse({ en: "Salt Marsh", es: "Marisma" });
    expect(pickL10n(parsed, "es")).toBe("Marisma");
    expect(pickL10n(parsed, "fr")).toBe("Salt Marsh");
  });
});
