import { z } from "zod";

/** Localized string map, e.g. `{ en: "…", es: "…" }`. */
export const L10n = z.record(z.string().min(1), z.string());
export type L10n = z.infer<typeof L10n>;

export function pickL10n(
  value: L10n,
  lang: string,
  fallback = "en"
): string | undefined {
  return value[lang] ?? value[fallback] ?? Object.values(value)[0];
}
