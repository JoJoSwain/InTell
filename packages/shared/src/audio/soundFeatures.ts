/**
 * Named constants for A5 sound features (Jordan Nov 23 decisions).
 * Tunable without hunting magic numbers in rule bodies.
 */

export const MUSIC_GROWTH_STEPS_MAX = 4;
export const MUSIC_STEMS_PER_CUE_MAX = 4;

export const DEPTH_BLOOM_TEXTURE_M_DEFAULT = 15;
export const DEPTH_BLOOM_HYSTERESIS_M = 5;

export const RESOLVE_ROOT_MS_MIN = 4_000;
export const RESOLVE_ROOT_MS_MAX = 8_000;
export const RESOLVE_BRANCH_MS_MIN = 3_000;
export const RESOLVE_BRANCH_MS_MAX = 6_000;
export const RESOLVE_LEAF_MS_MIN = 2_000;
export const RESOLVE_LEAF_MS_MAX = 4_000;

export const THRESHOLD_MOTIF_DEPTH_M = 10;
export const THRESHOLD_MOTIF_WAIT_MS = 30_000;

export const ONESHOT_CONCURRENT_GLOBAL_MAX = 2;
export const BED_DURATION_WARN_MS = 120_000;
export const REGION_AMBIENCE_BUDGET_BYTES = 40 * 1024 * 1024;

export const BEACON_RANGE_M = 100;
export const BEACON_TIER_NEAR_M = 10;

export const BREATH_SILENCE_MIN_MS = 350;
export const RESUME_PREROLL_MS = 300;
export const BACK_SKIP_MS = 10_000;

/** Crest factor (true peak vs RMS of loudest 400 ms) above this → TRANSIENT warning. */
export const TRANSIENT_CREST_DB = 20;

/** Shed one mix layer after this many consecutive degraded watchdog windows (~10 s). */
export const MIX_SHED_AFTER_WINDOWS = 2;
/** Recover one mix layer after this much healthy clock time. */
export const MIX_RECOVER_STEP_MS = 60_000;

export const VOICE_SLOT_NARRATION = 1;
export const VOICE_SLOT_STEMS = 4;
export const VOICE_SLOT_BEDS = 2;
export const VOICE_SLOT_ACCENTS = 2;
export const VOICE_SLOT_BEACON = 1;
export const VOICE_SLOT_MOMENT = 1;
export const VOICE_SLOT_SPARE = 1;
export const VOICE_BUDGET_TOTAL =
  VOICE_SLOT_NARRATION +
  VOICE_SLOT_STEMS +
  VOICE_SLOT_BEDS +
  VOICE_SLOT_ACCENTS +
  VOICE_SLOT_BEACON +
  VOICE_SLOT_MOMENT +
  VOICE_SLOT_SPARE;

/** Shed order under stress (first shed first). */
export const MIX_SHED_ORDER = [
  "accents",
  "beacon",
  "extraStems",
  "secondBed",
  "music",
] as const;

export type MixShedLayer = (typeof MIX_SHED_ORDER)[number];

export const BEACONS_ENABLED_DEFAULT = true;
