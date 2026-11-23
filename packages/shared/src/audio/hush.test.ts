import { describe, expect, it } from "vitest";
import { createSeededRng } from "./seededRng";
import {
  HUSH_CUE_DELAY_MS,
  HUSH_CUE_GAIN_DB,
  HUSH_FADE_IN_MS,
  HUSH_FADE_OUT_MS,
  HUSH_HOLD_MAX_S,
  HUSH_HOLD_MIN_S,
  HUSH_TRIGGER_FADE_MS,
  hushStep,
  initialHushState,
  type HushStep,
} from "./hush";

const start = new Date("2026-06-15T18:00:00.000Z");

function at(ms: number): Date {
  return new Date(start.getTime() + ms);
}

function step(
  state: HushStep | ReturnType<typeof initialHushState>,
  now: Date,
  overrides: Partial<Parameters<typeof hushStep>[0]> = {},
  seed = 1,
): HushStep {
  return hushStep({
    state,
    settingOn: true,
    insideGrove: true,
    narrationPlaying: false,
    queuedFragment: false,
    lastNarrationEndedAt: start,
    now,
    intervalMin: 7,
    rng: createSeededRng(seed),
    triggerArrived: false,
    ...overrides,
  });
}

describe("hushStep", () => {
  it("stays idle when the setting is off, outside a grove, narrating, or queued", () => {
    const due = at(20 * 60_000);
    expect(step(initialHushState(), due, { settingOn: false }).phase).toBe("idle");
    expect(step(initialHushState(), due, { insideGrove: false }).phase).toBe("idle");
    expect(step(initialHushState(), due, { narrationPlaying: true }).phase).toBe("idle");
    expect(step(initialHushState(), due, { queuedFragment: true }).phase).toBe("idle");
    expect(HUSH_CUE_GAIN_DB).toBe(-12);
  });

  it("draws the interval once and starts when that time arrives", () => {
    const armed = step(initialHushState(), start);
    expect(armed.phase).toBe("idle");
    expect(armed.nextHushAt).not.toBeNull();
    const minutes = ((armed.nextHushAt?.getTime() ?? 0) - start.getTime()) / 60_000;
    expect(minutes).toBeGreaterThanOrEqual(5);
    expect(minutes).toBeLessThanOrEqual(9);
    expect(minutes % 1).toBe(0);

    const again = step(armed, start, {}, 99);
    expect(again.nextHushAt).toEqual(armed.nextHushAt);

    const early = step(armed, new Date(armed.nextHushAt!.getTime() - 1));
    expect(early.phase).toBe("idle");
    const begun = step(armed, armed.nextHushAt!);
    expect(begun.phase).toBe("fadingOut");
    expect(begun.fadeMs).toBe(HUSH_FADE_OUT_MS);
  });

  it("walks fade, cue, hold and fade-in, with the same hold from the same seed", () => {
    const run = (seed: number): HushStep => {
      const armed = step(initialHushState(), start, {}, seed);
      const fading = step(armed, armed.nextHushAt!, {}, seed);
      const cue = step(fading, new Date(fading.phaseStartedAt!.getTime() + HUSH_FADE_OUT_MS), {}, seed);
      expect(cue.phase).toBe("cue");
      expect(cue.playCue).toBe(true);
      const holding = step(
        cue,
        new Date(cue.phaseStartedAt!.getTime() + HUSH_CUE_DELAY_MS),
        {},
        seed,
      );
      expect(holding.phase).toBe("holding");
      const holdS = ((holding.holdEndsAt?.getTime() ?? 0) - holding.phaseStartedAt!.getTime()) / 1000;
      expect(holdS).toBeGreaterThanOrEqual(HUSH_HOLD_MIN_S);
      expect(holdS).toBeLessThanOrEqual(HUSH_HOLD_MAX_S);
      const fadingIn = step(holding, holding.holdEndsAt!, {}, seed);
      expect(fadingIn).toMatchObject({ phase: "fadingIn", fadeMs: HUSH_FADE_IN_MS });
      const idle = step(
        fadingIn,
        new Date(fadingIn.phaseStartedAt!.getTime() + HUSH_FADE_IN_MS),
        {},
        seed,
      );
      expect(idle.phase).toBe("idle");
      expect(idle.nextHushAt).not.toBeNull();
      return holding;
    };

    expect(run(4).holdEndsAt).toEqual(run(4).holdEndsAt);
  });

  it("fades back over 6 s when the setting turns off during the hold", () => {
    const armed = step(initialHushState(), start);
    const fading = step(armed, armed.nextHushAt!);
    const cue = step(fading, new Date(fading.phaseStartedAt!.getTime() + HUSH_FADE_OUT_MS));
    const holding = step(cue, new Date(cue.phaseStartedAt!.getTime() + HUSH_CUE_DELAY_MS));
    const back = step(holding, new Date(holding.phaseStartedAt!.getTime() + 1000), {
      settingOn: false,
    });
    expect(back).toMatchObject({
      phase: "fadingIn",
      fadeMs: HUSH_FADE_IN_MS,
      playCue: false,
    });
  });

  it("fades back over 6 s when the listener leaves the grove during the fade-out", () => {
    const armed = step(initialHushState(), start);
    const fading = step(armed, armed.nextHushAt!);
    const left = step(fading, new Date(fading.phaseStartedAt!.getTime() + 500), {
      insideGrove: false,
    });
    expect(left).toMatchObject({
      phase: "fadingIn",
      fadeMs: HUSH_FADE_IN_MS,
      playCue: false,
    });
  });

  it("ends a hold with a 1 s fade when a fragment triggers", () => {
    const armed = step(initialHushState(), start);
    const fading = step(armed, armed.nextHushAt!);
    const cue = step(fading, new Date(fading.phaseStartedAt!.getTime() + HUSH_FADE_OUT_MS));
    const holding = step(cue, new Date(cue.phaseStartedAt!.getTime() + HUSH_CUE_DELAY_MS));
    const cancelled = step(holding, new Date(holding.phaseStartedAt!.getTime() + 1000), {
      triggerArrived: true,
    });
    expect(cancelled).toMatchObject({
      phase: "fadingIn",
      fadeMs: HUSH_TRIGGER_FADE_MS,
      playCue: false,
    });
  });

  it("does not draw again when the same idle state is repeated", () => {
    const armed = step(initialHushState(), start, {}, 2);
    const repeated = hushStep({
      state: armed,
      settingOn: true,
      insideGrove: true,
      narrationPlaying: false,
      queuedFragment: false,
      lastNarrationEndedAt: start,
      now: start,
      intervalMin: 7,
      rng: () => {
        throw new Error("drew twice");
      },
      triggerArrived: false,
    });
    expect(repeated.nextHushAt).toEqual(armed.nextHushAt);
  });
});
