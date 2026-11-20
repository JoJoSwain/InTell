import { z } from "zod";

/**
 * Telemetry event envelope stub (TECH_SPEC §8).
 * Never include coordinates, free text, credit names, or audio.
 */
export const TelemetryEvent = z.object({
  clientEventId: z.string().uuid(),
  name: z.string().min(1),
  occurredAt: z.string().datetime(),
  groveId: z.string().uuid().optional(),
  fragmentId: z.string().uuid().optional(),
  revisionId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  props: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export type TelemetryEvent = z.infer<typeof TelemetryEvent>;

/** Known event names — expand as milestones land. */
export const EVENT_NAMES = [
  "app_opened",
  "pack_downloaded",
  "grove_entered",
  "session_started",
  "session_ended",
  "fragment_triggered",
  "fragment_heard",
  "fragment_revealed",
  "growth_moment_played",
  "hush_started",
  "hush_skipped",
  "mixer_changed",
  "route_changed",
  "journal_opened",
  "moment_opened",
  "echo_played",
  "show_on_map_tapped",
  "field_note_saved",
  "field_note_shared_as_seed",
  "grow_opened",
  "seed_planted",
  "vote_cast",
  "question_viewed",
  "ledger_opened",
  "checkin_submitted",
  "checkin_skipped",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
