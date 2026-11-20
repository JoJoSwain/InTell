import type { AudioRoute, BusId } from "./AudioEngine";
import { dbToGain } from "./gain";

/** AUDIO_SPEC §2.3 bus defaults and duck amounts. */
export const BUS_DEFAULT_DB: Record<BusId, number> = {
  story: 0,
  music: -8,
  surroundings: -10,
  ui: -6,
};

/** Extra dB applied while narration is active (negative = quieter). */
export const DUCK_AMOUNT_DB: Partial<Record<BusId, number>> = {
  music: -10,
  surroundings: -6,
};

export const DUCK_ATTACK_MS = 800;
export const DUCK_RELEASE_MS = 2500;

/**
 * Afterglow hold after a fragment ends before releasing ducks (AUDIO_SPEC §5).
 * Constant only for the M1 spike — no behavior wired yet.
 */
export const AFTERGLOW_MS = 8000;

/** Extra surroundings attenuation on the speaker route (AUDIO_SPEC §2.3). */
export const SPEAKER_SURROUNDINGS_EXTRA_DB = -6;

export interface DuckingLevels {
  busDb: Record<BusId, number>;
  attackMs: number;
  releaseMs: number;
}

/**
 * Compute target bus levels for the current narration / route state.
 * Does not apply afterglow timing — callers that need afterglow use AFTERGLOW_MS.
 */
export function computeDuckingLevels(opts: {
  narrationActive: boolean;
  route: AudioRoute;
}): DuckingLevels {
  const busDb: Record<BusId, number> = { ...BUS_DEFAULT_DB };

  if (opts.narrationActive) {
    for (const [bus, amount] of Object.entries(DUCK_AMOUNT_DB) as [
      BusId,
      number,
    ][]) {
      busDb[bus] = (busDb[bus] ?? 0) + amount;
    }
  }

  if (opts.route === "speaker") {
    busDb.surroundings += SPEAKER_SURROUNDINGS_EXTRA_DB;
  }

  return {
    busDb,
    attackMs: DUCK_ATTACK_MS,
    releaseMs: DUCK_RELEASE_MS,
  };
}

/** Convenience: linear gains for each bus under the same policy. */
export function computeDuckingGains(opts: {
  narrationActive: boolean;
  route: AudioRoute;
}): Record<BusId, number> {
  const { busDb } = computeDuckingLevels(opts);
  return {
    story: dbToGain(busDb.story),
    music: dbToGain(busDb.music),
    surroundings: dbToGain(busDb.surroundings),
    ui: dbToGain(busDb.ui),
  };
}

/** DuckingPolicy namespace matching AUDIO_SPEC §2.3 (+ afterglow constant). */
export const DuckingPolicy = {
  BUS_DEFAULT_DB,
  DUCK_AMOUNT_DB,
  DUCK_ATTACK_MS,
  DUCK_RELEASE_MS,
  afterglowMs: AFTERGLOW_MS,
  SPEAKER_SURROUNDINGS_EXTRA_DB,
  computeDuckingLevels,
  computeDuckingGains,
} as const;
