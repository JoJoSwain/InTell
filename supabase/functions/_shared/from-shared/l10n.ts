import { z } from "zod";

/** Localized string map, e.g. `{ en: "…", es: "…" }`. */
export const L10n = z.record(z.string().min(1), z.string());
export type L10n = z.infer<typeof L10n>;

/** Grove access notes (DATA_MODEL §4 / A35): each key optional, each value L10n. */
export const AccessNotes = z
  .object({
    parking: L10n.optional(),
    transit: L10n.optional(),
    restrooms: L10n.optional(),
    terrain: L10n.optional(),
    hours: L10n.optional(),
    accessibility: L10n.optional(),
  })
  .strict();
export type AccessNotes = z.infer<typeof AccessNotes>;

export function pickL10n(
  value: L10n,
  lang: string,
  fallback = "en"
): string | undefined {
  return value[lang] ?? value[fallback] ?? Object.values(value)[0];
}
