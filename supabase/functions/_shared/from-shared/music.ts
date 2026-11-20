import { z } from "zod";

/** AUDIO_SPEC §4.2 — cue conditions and stem state_gains[].when */
export const MusicCondition = z
  .object({
    threadIds: z.array(z.string().uuid()).optional(),
    tiers: z.array(z.enum(["root", "branch", "leaf"])).optional(),
    heardAll: z.array(z.string().uuid()).optional(),
    heardAny: z.array(z.string().uuid()).optional(),
    notHeard: z.array(z.string().uuid()).optional(),
    narrationPlaying: z.boolean().optional(),
  })
  .strict();

export type MusicCondition = z.infer<typeof MusicCondition>;

/** Stem gain rule: first matching `when` applies (AUDIO_SPEC §4.2). */
export const StemRule = z
  .object({
    when: MusicCondition,
    gain_db: z.number(),
  })
  .strict();

export type StemRule = z.infer<typeof StemRule>;

/** Packed stem rule (camelCase in GrovePack). */
export const StemRulePack = z
  .object({
    when: MusicCondition,
    gainDb: z.number(),
  })
  .strict();

export type StemRulePack = z.infer<typeof StemRulePack>;
