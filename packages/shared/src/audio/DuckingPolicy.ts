import type { AudioRoute, BusId } from "./AudioEngine";
import { dbToGain } from "./gain";

/** AUDIO_SPEC §2.3 bus defaults and duck amounts. */
export const BUS_DEFAULT_DB: Record<BusId, number> = {
  story: 0,
  music: -8,
  surroundings: -10,
  ui: -6,
  moment: -8,
};

/** Extra dB applied while narration is active (negative = quieter). */
export const DUCK_AMOUNT_DB: Partial<Record<BusId, number>> = {
  music: -10,
  surroundings: -6,
  moment: -10,
};

export const DUCK_ATTACK_MS = 800;
export const DUCK_RELEASE_MS = 2500;

/**
 * Afterglow hold after a fragment ends before releasing ducks (AUDIO_SPEC §5).
 * Applies to music and surroundings only — not `moment` (resolves play in afterglow).
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
 * Compute target bus levels for the current narration / route / afterglow state.
 * Afterglow keeps music+surroundings ducked; `moment` recovers so resolves are heard.
 */
export function computeDuckingLevels(opts: {
  narrationActive: boolean;
  route: AudioRoute;
  afterglowActive?: boolean;
}): DuckingLevels {
  const busDb: Record<BusId, number> = { ...BUS_DEFAULT_DB };
  const duckNow = opts.narrationActive || opts.afterglowActive === true;

  if (opts.narrationActive) {
    for (const [bus, amount] of Object.entries(DUCK_AMOUNT_DB) as [
      BusId,
      number,
    ][]) {
      busDb[bus] = (busDb[bus] ?? 0) + amount;
    }
  } else if (opts.afterglowActive) {
    // Hold music + surroundings; leave moment at default
    if (DUCK_AMOUNT_DB.music !== undefined) {
      busDb.music += DUCK_AMOUNT_DB.music;
    }
    if (DUCK_AMOUNT_DB.surroundings !== undefined) {
      busDb.surroundings += DUCK_AMOUNT_DB.surroundings;
    }
  }

  void duckNow;

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
  afterglowActive?: boolean;
}): Record<BusId, number> {
  const { busDb } = computeDuckingLevels(opts);
  return {
    story: dbToGain(busDb.story),
    music: dbToGain(busDb.music),
    surroundings: dbToGain(busDb.surroundings),
    ui: dbToGain(busDb.ui),
    moment: dbToGain(busDb.moment),
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
