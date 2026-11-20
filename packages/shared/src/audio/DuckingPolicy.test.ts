import { describe, expect, it } from "vitest";
import {
  AFTERGLOW_MS,
  BUS_DEFAULT_DB,
  DuckingPolicy,
  DUCK_AMOUNT_DB,
  DUCK_ATTACK_MS,
  DUCK_RELEASE_MS,
  computeDuckingLevels,
  SPEAKER_SURROUNDINGS_EXTRA_DB,
} from "./DuckingPolicy";

describe("DuckingPolicy", () => {
  it("exposes afterglow as a constant only", () => {
    expect(DuckingPolicy.afterglowMs).toBe(8000);
    expect(AFTERGLOW_MS).toBe(8000);
  });

  it("uses AUDIO_SPEC attack / release timings", () => {
    expect(DUCK_ATTACK_MS).toBe(800);
    expect(DUCK_RELEASE_MS).toBe(2500);
  });

  it("returns bus defaults when narration is idle on headphones", () => {
    const { busDb, attackMs, releaseMs } = computeDuckingLevels({
      narrationActive: false,
      route: "headphones",
    });
    expect(busDb).toEqual(BUS_DEFAULT_DB);
    expect(attackMs).toBe(800);
    expect(releaseMs).toBe(2500);
  });

  it("ducks music and surroundings under narration", () => {
    const { busDb } = computeDuckingLevels({
      narrationActive: true,
      route: "headphones",
    });
    expect(busDb.story).toBe(0);
    expect(busDb.music).toBe(
      BUS_DEFAULT_DB.music + (DUCK_AMOUNT_DB.music ?? 0),
    );
    expect(busDb.surroundings).toBe(
      BUS_DEFAULT_DB.surroundings + (DUCK_AMOUNT_DB.surroundings ?? 0),
    );
    expect(busDb.ui).toBe(BUS_DEFAULT_DB.ui);
  });

  it("applies speaker surroundings extra attenuation", () => {
    const idle = computeDuckingLevels({
      narrationActive: false,
      route: "speaker",
    });
    expect(idle.busDb.surroundings).toBe(
      BUS_DEFAULT_DB.surroundings + SPEAKER_SURROUNDINGS_EXTRA_DB,
    );

    const ducked = computeDuckingLevels({
      narrationActive: true,
      route: "speaker",
    });
    expect(ducked.busDb.surroundings).toBe(
      BUS_DEFAULT_DB.surroundings +
        (DUCK_AMOUNT_DB.surroundings ?? 0) +
        SPEAKER_SURROUNDINGS_EXTRA_DB,
    );
  });
});
