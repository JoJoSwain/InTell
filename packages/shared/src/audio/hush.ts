import type { SeededRng } from "./seededRng";

/** Fade music and surroundings out at the start of a Hush (AUDIO_SPEC §5). */
export const HUSH_FADE_OUT_MS = 4_000;
/** Silence before the "Listen." cue. */
export const HUSH_CUE_DELAY_MS = 1_000;
export const HUSH_HOLD_MIN_S = 60;
export const HUSH_HOLD_MAX_S = 90;
/** Fade back in after the hold. */
export const HUSH_FADE_IN_MS = 6_000;
/** Fade back in when a fragment trigger ends the Hush. */
export const HUSH_TRIGGER_FADE_MS = 1_000;
export const HUSH_CUE_GAIN_DB = -12;

export type HushPhase = "idle" | "fadingOut" | "cue" | "holding" | "fadingIn";

export type HushState = {
  phase: HushPhase;
  phaseStartedAt: Date | null;
  /** When the quiet period may begin. Drawn once, when idle begins. */
  nextHushAt: Date | null;
  /** When the hold ends. Drawn once, on entering the hold. */
  holdEndsAt: Date | null;
  fadeInMs: number;
};

export function initialHushState(): HushState {
  return {
    phase: "idle",
    phaseStartedAt: null,
    nextHushAt: null,
    holdEndsAt: null,
    fadeInMs: HUSH_FADE_IN_MS,
  };
}

export type HushStep = HushState & { fadeMs: number; playCue: boolean };

function addMs(at: Date, ms: number): Date {
  return new Date(at.getTime() + ms);
}

/** Inclusive integer in `[min, max]`. */
function drawInt(rng: SeededRng, min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

function result(state: HushState, fadeMs: number, playCue: boolean): HushStep {
  return { ...state, fadeMs, playCue };
}

function drawNextHush(anchor: Date, intervalMin: number, rng: SeededRng): Date {
  const offset = drawInt(rng, -2, 2);
  return addMs(anchor, (intervalMin + offset) * 60_000);
}

/**
 * Hush schedule. The interval offset and the hold length are drawn only
 * when idle begins and when the hold begins. Each call advances at most one
 * phase, so a tick during the cue still sees `playCue`.
 */
export function hushStep(input: {
  state: HushState;
  settingOn: boolean;
  insideGrove: boolean;
  narrationPlaying: boolean;
  queuedFragment: boolean;
  lastNarrationEndedAt: Date | null;
  now: Date;
  /** Minutes. The caller passes 7 unless the grove says otherwise. */
  intervalMin: number;
  rng: SeededRng;
  triggerArrived: boolean;
}): HushStep {
  const { state, now } = input;
  const pending = input.narrationPlaying || input.queuedFragment;

  if (state.phase !== "idle") {
    if (input.triggerArrived || pending) {
      if (state.phase === "fadingIn" && state.fadeInMs === HUSH_TRIGGER_FADE_MS) {
        return advanceFadeIn(input);
      }
      return result(
        {
          phase: "fadingIn",
          phaseStartedAt: now,
          nextHushAt: null,
          holdEndsAt: null,
          fadeInMs: HUSH_TRIGGER_FADE_MS,
        },
        HUSH_TRIGGER_FADE_MS,
        false,
      );
    }
    if (state.phase === "fadingOut") return advanceFadeOut(input);
    if (state.phase === "cue") return advanceCue(input);
    if (state.phase === "holding") return advanceHold(input);
    return advanceFadeIn(input);
  }

  if (pending) {
    return result(
      { ...state, nextHushAt: null, phaseStartedAt: null, holdEndsAt: null },
      0,
      false,
    );
  }

  const nextHushAt =
    state.nextHushAt ??
    drawNextHush(input.lastNarrationEndedAt ?? now, input.intervalMin, input.rng);

  if (
    input.settingOn &&
    input.insideGrove &&
    !input.triggerArrived &&
    now.getTime() >= nextHushAt.getTime()
  ) {
    return result(
      {
        phase: "fadingOut",
        phaseStartedAt: now,
        nextHushAt: null,
        holdEndsAt: null,
        fadeInMs: HUSH_FADE_IN_MS,
      },
      HUSH_FADE_OUT_MS,
      false,
    );
  }

  return result(
    {
      phase: "idle",
      phaseStartedAt: null,
      nextHushAt,
      holdEndsAt: null,
      fadeInMs: HUSH_FADE_IN_MS,
    },
    0,
    false,
  );
}

function advanceFadeOut(input: {
  state: HushState;
  now: Date;
}): HushStep {
  const started = input.state.phaseStartedAt ?? input.now;
  if (input.now.getTime() - started.getTime() >= HUSH_FADE_OUT_MS) {
    return result(
      {
        ...input.state,
        phase: "cue",
        phaseStartedAt: addMs(started, HUSH_FADE_OUT_MS),
      },
      0,
      true,
    );
  }
  return result(input.state, HUSH_FADE_OUT_MS, false);
}

function advanceCue(input: { state: HushState; now: Date; rng: SeededRng }): HushStep {
  const started = input.state.phaseStartedAt ?? input.now;
  if (input.now.getTime() - started.getTime() >= HUSH_CUE_DELAY_MS) {
    const holdStart = addMs(started, HUSH_CUE_DELAY_MS);
    const holdS = drawInt(input.rng, HUSH_HOLD_MIN_S, HUSH_HOLD_MAX_S);
    return result(
      {
        ...input.state,
        phase: "holding",
        phaseStartedAt: holdStart,
        holdEndsAt: addMs(holdStart, holdS * 1000),
      },
      0,
      false,
    );
  }
  return result(input.state, 0, true);
}

function advanceHold(input: { state: HushState; now: Date }): HushStep {
  const ends = input.state.holdEndsAt;
  if (ends && input.now.getTime() >= ends.getTime()) {
    return result(
      {
        ...input.state,
        phase: "fadingIn",
        phaseStartedAt: ends,
        fadeInMs: HUSH_FADE_IN_MS,
      },
      HUSH_FADE_IN_MS,
      false,
    );
  }
  return result(input.state, 0, false);
}

function advanceFadeIn(input: {
  state: HushState;
  now: Date;
  intervalMin: number;
  rng: SeededRng;
  narrationPlaying: boolean;
  queuedFragment: boolean;
  lastNarrationEndedAt: Date | null;
}): HushStep {
  const started = input.state.phaseStartedAt ?? input.now;
  const fadeMs = input.state.fadeInMs;
  if (input.now.getTime() - started.getTime() >= fadeMs) {
    if (input.narrationPlaying || input.queuedFragment) {
      return result(initialHushState(), 0, false);
    }
    const idleAt = addMs(started, fadeMs);
    return result(
      {
        ...initialHushState(),
        nextHushAt: drawNextHush(idleAt, input.intervalMin, input.rng),
      },
      0,
      false,
    );
  }
  return result(input.state, fadeMs, false);
}
