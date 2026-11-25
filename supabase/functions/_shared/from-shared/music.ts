import { z } from "zod";

/** Shared by pack builders (strict) and device parsers (strip / neverMatch). */
export type PackObjMode = "strict" | "device";

/** AUDIO_SPEC §4.2 — cue conditions and stem state_gains[].when */
export const musicConditionFields = {
  threadIds: z.array(z.string().uuid()).optional(),
  tiers: z.array(z.enum(["root", "branch", "leaf"])).optional(),
  heardAll: z.array(z.string().uuid()).optional(),
  heardAny: z.array(z.string().uuid()).optional(),
  notHeard: z.array(z.string().uuid()).optional(),
  narrationPlaying: z.boolean().optional(),
  minDepthM: z.number().nonnegative().optional(),
  insideTierBuffer: z.enum(["root", "branch", "leaf"]).optional(),
} as const satisfies z.ZodRawShape;

const knownMusicConditionKeys = new Set(Object.keys(musicConditionFields));

const musicConditionWithMarker = z
  .object({
    ...musicConditionFields,
    /** Set by device parsers when a condition carried unknown keys. */
    neverMatch: z.literal(true).optional(),
  })
  .strip();

/**
 * Strict: reject unknown keys.
 * Device: any unknown key becomes `{ neverMatch: true }` so older phones
 * never widen a future restriction by stripping it.
 */
export function musicConditionSchema(mode: PackObjMode) {
  if (mode === "strict") {
    return z.object(musicConditionFields).strict();
  }
  return z.preprocess((raw) => {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
      return raw;
    }
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (!knownMusicConditionKeys.has(key)) {
        return { neverMatch: true as const };
      }
    }
    return raw;
  }, musicConditionWithMarker);
}

export const MusicCondition = musicConditionSchema("strict");
export type MusicCondition = z.infer<typeof musicConditionWithMarker>;

/** Packed stem rule (camelCase in GrovePack). */
export function stemRulePackSchema(mode: PackObjMode) {
  const base = z.object({
    when: musicConditionSchema(mode),
    gainDb: z.number(),
  });
  return mode === "strict" ? base.strict() : base.strip();
}

/** Stem gain rule with snake_case gain (snapshots / admin). */
export function stemRuleSchema(mode: PackObjMode) {
  const base = z.object({
    when: musicConditionSchema(mode),
    gain_db: z.number(),
  });
  return mode === "strict" ? base.strict() : base.strip();
}

export const StemRule = stemRuleSchema("strict");
export type StemRule = z.infer<typeof StemRule>;

export const StemRulePack = stemRulePackSchema("strict");
export type StemRulePack = z.infer<typeof StemRulePack>;
