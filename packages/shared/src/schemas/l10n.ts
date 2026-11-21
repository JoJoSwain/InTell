import { z } from "zod";

/** Language-keyed strings (DATA_MODEL §2). */
export const L10n = z.record(z.string().min(1), z.string());
export type L10n = z.infer<typeof L10n>;

/**
 * True when L10n is blank for checklist / pack omission (G2 / DATA_MODEL §11):
 * `{}`, missing `en`, or `en` blank after trim. Mirrors `fn_l10n_blank`.
 */
export function isL10nBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 0) return true;
  const en = rec.en;
  if (typeof en !== "string") return true;
  return en.trim() === "";
}

export function pickL10n(
  value: L10n,
  preferred: string,
  fallback = "en",
): string | undefined {
  return value[preferred] ?? value[fallback] ?? Object.values(value)[0];
}
