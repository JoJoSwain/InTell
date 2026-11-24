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

/** Epoch-ms Hush state (JSON-serializable). Preferred by the AudioDirector. */
export type HushStateMs = {
  phase: HushPhase;
  phaseStartedAt: number | null;
  nextHushAt: number | null;
  holdEndsAt: number | null;
  fadeInMs: number;
};

/** Date-based Hush state (legacy wrapper surface). */
export type HushState = {
  phase: HushPhase;
  phaseStartedAt: Date | null;
  /** When the quiet period may begin. Drawn once, when idle begins. */
  nextHushAt: Date | null;
  /** When the hold ends. Drawn once, on entering the hold. */
  holdEndsAt: Date | null;
  fadeInMs: number;
};

export function initialHushStateMs(): HushStateMs {
  return {
    phase: "idle",
    phaseStartedAt: null,
    nextHushAt: null,
    holdEndsAt: null,
    fadeInMs: HUSH_FADE_IN_MS,
  };
}

export function initialHushState(): HushState {
  return {
    phase: "idle",
    phaseStartedAt: null,
    nextHushAt: null,
    holdEndsAt: null,
    fadeInMs: HUSH_FADE_IN_MS,
  };
}

export type HushStepMs = HushStateMs & { fadeMs: number; playCue: boolean };
export type HushStep = HushState & { fadeMs: number; playCue: boolean };

function toMs(state: HushState): HushStateMs {
  return {
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt?.getTime() ?? null,
    nextHushAt: state.nextHushAt?.getTime() ?? null,
    holdEndsAt: state.holdEndsAt?.getTime() ?? null,
    fadeInMs: state.fadeInMs,
  };
}

function toDate(state: HushStateMs): HushState {
  return {
    phase: state.phase,
    phaseStartedAt:
      state.phaseStartedAt != null ? new Date(state.phaseStartedAt) : null,
    nextHushAt: state.nextHushAt != null ? new Date(state.nextHushAt) : null,
    holdEndsAt: state.holdEndsAt != null ? new Date(state.holdEndsAt) : null,
    fadeInMs: state.fadeInMs,
  };
}

/** Inclusive integer in `[min, max]`. */
function drawInt(rng: SeededRng, min: number, max: number): number {
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

function resultMs(
  state: HushStateMs,
  fadeMs: number,
  playCue: boolean,
): HushStepMs {
  return { ...state, fadeMs, playCue };
}

function drawNextHushMs(
  anchorMs: number,
  intervalMin: number,
  rng: SeededRng,
): number {
  const offset = drawInt(rng, -2, 2);
  return anchorMs + (intervalMin + offset) * 60_000;
}

/**
 * Hush schedule on epoch ms. The interval offset and the hold length are
 * drawn only when idle begins and when the hold begins. Each call advances
 * at most one phase, so a tick during the cue still sees `playCue`.
 */
export function hushStepMs(input: {
  state: HushStateMs;
  settingOn: boolean;
  insideGrove: boolean;
  narrationPlaying: boolean;
  queuedFragment: boolean;
  lastNarrationEndedAt: number | null;
  now: number;
  /** Minutes. The caller passes 7 unless the grove says otherwise. */
  intervalMin: number;
  rng: SeededRng;
  triggerArrived: boolean;
}): HushStepMs {
  const { state, now } = input;
  const pending = input.narrationPlaying || input.queuedFragment;

  if (state.phase !== "idle") {
    const hushCanApply =
      state.phase === "fadingOut" ||
      state.phase === "cue" ||
      state.phase === "holding";
    if (hushCanApply && (!input.settingOn || !input.insideGrove)) {
      return resultMs(
        {
          phase: "fadingIn",
          phaseStartedAt: now,
          nextHushAt: null,
          holdEndsAt: null,
          fadeInMs: HUSH_FADE_IN_MS,
        },
        HUSH_FADE_IN_MS,
        false,
      );
    }
    if (input.triggerArrived || pending) {
      if (state.phase === "fadingIn" && state.fadeInMs === HUSH_TRIGGER_FADE_MS) {
        return advanceFadeInMs(input);
      }
      return resultMs(
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
    if (state.phase === "fadingOut") return advanceFadeOutMs(input);
    if (state.phase === "cue") return advanceCueMs(input);
    if (state.phase === "holding") return advanceHoldMs(input);
    return advanceFadeInMs(input);
  }

  if (pending) {
    return resultMs(
      { ...state, nextHushAt: null, phaseStartedAt: null, holdEndsAt: null },
      0,
      false,
    );
  }

  const nextHushAt =
    state.nextHushAt ??
    drawNextHushMs(
      input.lastNarrationEndedAt ?? now,
      input.intervalMin,
      input.rng,
    );

  if (
    input.settingOn &&
    input.insideGrove &&
    !input.triggerArrived &&
    now >= nextHushAt
  ) {
    return resultMs(
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

  return resultMs(
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

function advanceFadeOutMs(input: {
  state: HushStateMs;
  now: number;
}): HushStepMs {
  const started = input.state.phaseStartedAt ?? input.now;
  if (input.now - started >= HUSH_FADE_OUT_MS) {
    return resultMs(
      {
        ...input.state,
        phase: "cue",
        phaseStartedAt: started + HUSH_FADE_OUT_MS,
      },
      0,
      true,
    );
  }
  return resultMs(input.state, HUSH_FADE_OUT_MS, false);
}

function advanceCueMs(input: {
  state: HushStateMs;
  now: number;
  rng: SeededRng;
}): HushStepMs {
  const started = input.state.phaseStartedAt ?? input.now;
  if (input.now - started >= HUSH_CUE_DELAY_MS) {
    const holdStart = started + HUSH_CUE_DELAY_MS;
    const holdS = drawInt(input.rng, HUSH_HOLD_MIN_S, HUSH_HOLD_MAX_S);
    return resultMs(
      {
        ...input.state,
        phase: "holding",
        phaseStartedAt: holdStart,
        holdEndsAt: holdStart + holdS * 1000,
      },
      0,
      false,
    );
  }
  return resultMs(input.state, 0, true);
}

function advanceHoldMs(input: { state: HushStateMs; now: number }): HushStepMs {
  const ends = input.state.holdEndsAt;
  if (ends != null && input.now >= ends) {
    return resultMs(
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
  return resultMs(input.state, 0, false);
}

function advanceFadeInMs(input: {
  state: HushStateMs;
  now: number;
  intervalMin: number;
  rng: SeededRng;
  narrationPlaying: boolean;
  queuedFragment: boolean;
  lastNarrationEndedAt: number | null;
}): HushStepMs {
  const started = input.state.phaseStartedAt ?? input.now;
  const fadeMs = input.state.fadeInMs;
  if (input.now - started >= fadeMs) {
    if (input.narrationPlaying || input.queuedFragment) {
      return resultMs(initialHushStateMs(), 0, false);
    }
    const idleAt = started + fadeMs;
    return resultMs(
      {
        ...initialHushStateMs(),
        nextHushAt: drawNextHushMs(idleAt, input.intervalMin, input.rng),
      },
      0,
      false,
    );
  }
  return resultMs(input.state, fadeMs, false);
}

/**
 * Date-based wrapper around {@link hushStepMs}. Existing call sites and tests
 * keep working; new code should prefer epoch ms.
 */
export function hushStep(input: {
  state: HushState;
  settingOn: boolean;
  insideGrove: boolean;
  narrationPlaying: boolean;
  queuedFragment: boolean;
  lastNarrationEndedAt: Date | null;
  now: Date;
  intervalMin: number;
  rng: SeededRng;
  triggerArrived: boolean;
}): HushStep {
  const stepped = hushStepMs({
    state: toMs(input.state),
    settingOn: input.settingOn,
    insideGrove: input.insideGrove,
    narrationPlaying: input.narrationPlaying,
    queuedFragment: input.queuedFragment,
    lastNarrationEndedAt: input.lastNarrationEndedAt?.getTime() ?? null,
    now: input.now.getTime(),
    intervalMin: input.intervalMin,
    rng: input.rng,
    triggerArrived: input.triggerArrived,
  });
  const { fadeMs, playCue, ...rest } = stepped;
  return { ...toDate(rest), fadeMs, playCue };
}
