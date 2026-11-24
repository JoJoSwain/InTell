import { describe, expect, it } from "vitest";
import {
  ONESHOT_HORIZON_SEC,
  ONESHOT_LOOKAHEAD_SEC,
  ONESHOT_MAX_PENDING,
  ONESHOT_MEAN_INTERVAL_SEC,
  ONESHOT_STRESS_LOOKAHEAD_SEC,
  ONESHOT_STRESS_MAX_PENDING,
  OneShotWindowScheduler,
} from "./oneshotSchedule";
import { createSeededRng, hashSeed } from "./seededRng";

describe("createSeededRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a()).not.toBe(b());
  });
});

describe("hashSeed", () => {
  it("is stable", () => {
    expect(hashSeed("intell-audio-spike")).toBe(hashSeed("intell-audio-spike"));
  });
});

describe("oneshot constants", () => {
  it("uses 20 s lookahead and 2 pending in production", () => {
    expect(ONESHOT_LOOKAHEAD_SEC).toBe(20);
    expect(ONESHOT_MAX_PENDING).toBe(2);
  });

  it("keeps stress aliases for B·S1 load", () => {
    expect(ONESHOT_STRESS_LOOKAHEAD_SEC).toBe(300);
    expect(ONESHOT_STRESS_MAX_PENDING).toBe(37);
    expect(ONESHOT_HORIZON_SEC).toBe(ONESHOT_STRESS_LOOKAHEAD_SEC);
  });
});

describe("OneShotWindowScheduler", () => {
  it("fills ~5 minutes at an 8 s mean interval", () => {
    const s = new OneShotWindowScheduler(hashSeed("spike"));
    s.reset(hashSeed("spike"), 0);
    const plans = s.fillWindow(0, ONESHOT_HORIZON_SEC);
    expect(plans.length).toBe(
      Math.floor(ONESHOT_HORIZON_SEC / ONESHOT_MEAN_INTERVAL_SEC),
    );
    expect(plans[0]?.atSec).toBe(ONESHOT_MEAN_INTERVAL_SEC);
    expect(plans.at(-1)?.atSec).toBe(
      ONESHOT_MEAN_INTERVAL_SEC *
        Math.floor(ONESHOT_HORIZON_SEC / ONESHOT_MEAN_INTERVAL_SEC),
    );
  });

  it("is deterministic across runs", () => {
    const seed = hashSeed("spike");
    const a = new OneShotWindowScheduler(seed);
    const b = new OneShotWindowScheduler(seed);
    a.reset(seed, 10);
    b.reset(seed, 10);
    expect(a.fillWindow(10, 40)).toEqual(b.fillWindow(10, 40));
  });

  it("tops up only beyond the existing cursor", () => {
    const seed = 99;
    const s = new OneShotWindowScheduler(seed);
    s.reset(seed, 0);
    const first = s.fillWindow(0, 24);
    expect(first.map((p) => p.atSec)).toEqual([8, 16, 24]);
    const second = s.fillWindow(0, 40);
    expect(second.map((p) => p.atSec)).toEqual([32, 40]);
  });

  it("skips past due times after a long sleep without duplicating", () => {
    const seed = 7;
    const s = new OneShotWindowScheduler(seed);
    s.reset(seed, 0);
    const first = s.fillWindow(0, 24);
    expect(first).toHaveLength(3);
    // JS slept; audio time jumped past the window.
    const resumed = s.fillWindow(100, 16);
    expect(resumed.every((p) => p.atSec > 100)).toBe(true);
    expect(resumed[0]?.atSec).toBe(104);
  });

  it("fillWindow stops after maxPlans", () => {
    const seed = 1;
    const s = new OneShotWindowScheduler(seed);
    s.reset(seed, 0);
    const plans = s.fillWindow(0, ONESHOT_LOOKAHEAD_SEC, ONESHOT_MAX_PENDING);
    expect(plans).toHaveLength(ONESHOT_MAX_PENDING);
    expect(plans.map((p) => p.atSec)).toEqual([8, 16]);
  });

  it("fillWindowLimited respects pending room", () => {
    const seed = 2;
    const s = new OneShotWindowScheduler(seed);
    s.reset(seed, 0);
    const none = s.fillWindowLimited(0, ONESHOT_LOOKAHEAD_SEC, 2, 2);
    expect(none).toHaveLength(0);
    const one = s.fillWindowLimited(0, ONESHOT_LOOKAHEAD_SEC, 1, 2);
    expect(one).toHaveLength(1);
    const stress = new OneShotWindowScheduler(seed);
    stress.reset(seed, 0);
    const many = stress.fillWindowLimited(
      0,
      ONESHOT_STRESS_LOOKAHEAD_SEC,
      0,
      ONESHOT_STRESS_MAX_PENDING,
    );
    expect(many).toHaveLength(ONESHOT_STRESS_MAX_PENDING);
  });
});
