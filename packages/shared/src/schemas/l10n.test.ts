import { describe, expect, it } from "vitest";
import { isL10nBlank, L10n, pickL10n } from "./l10n";

describe("L10n", () => {
  it("parses and picks preferred then en", () => {
    const parsed = L10n.parse({ en: "Salt Marsh", es: "Marisma" });
    expect(pickL10n(parsed, "es")).toBe("Marisma");
    expect(pickL10n(parsed, "fr")).toBe("Salt Marsh");
  });
});

describe("isL10nBlank (G2)", () => {
  it("treats empty object, missing en, and blank en as blank", () => {
    expect(isL10nBlank({})).toBe(true);
    expect(isL10nBlank({ es: "hola" })).toBe(true);
    expect(isL10nBlank({ en: "" })).toBe(true);
    expect(isL10nBlank({ en: "  " })).toBe(true);
    expect(isL10nBlank(null)).toBe(true);
  });

  it("treats non-blank en as present", () => {
    expect(isL10nBlank({ en: "hello" })).toBe(false);
    expect(isL10nBlank({ en: " hello ", es: "hola" })).toBe(false);
  });
});
