import { describe, expect, it } from "vitest";
import { GROVE_BUFFER_M } from "../geo/groveShape";
import { GrovePack, GrovePackDevice } from "../schemas/packs";
import { beaconMix, beaconPanFromRelative, chooseBeacon } from "./beacon";
import {
  accentAllowed,
  backSkipMs,
  resumePointMs,
  suggestBreathPoints,
} from "./breath";
import { depthConditionLatched, insideTierBuffersLatched } from "./depthBloom";
import {
  initialLockedTeaserState,
  lockedTeaserStep,
} from "./lockedTeaser";
import {
  initialMixLevelState,
  mixLevelFor,
  shedLayers,
} from "./mixHealth";
import { pickResolve } from "./resolve";
import {
  BACK_SKIP_MS,
  BEACON_GAIN_FAR_DB,
  BEACON_GAIN_NEAR_DB,
  BEACON_RANGE_M,
  BEACON_TIER_NEAR_M,
  BEACONS_ENABLED_DEFAULT,
  DEPTH_BLOOM_TEXTURE_M_DEFAULT,
  MIX_RECOVER_STEP_MS,
  MIX_SHED_AFTER_WINDOWS,
  MUSIC_GROWTH_STEPS_MAX,
  MUSIC_STEMS_PER_CUE_MAX,
  ONESHOT_CONCURRENT_GLOBAL_MAX,
  RESUME_PREROLL_MS,
  THRESHOLD_MOTIF_DEPTH_M,
  TRANSIENT_CREST_DB,
  VOICE_BUDGET_TOTAL,
} from "./soundFeatures";
import { distanceMeters } from "../geo/polygon";
import {
  initialThresholdMotifState,
  thresholdMotifStep,
} from "./thresholdMotif";
import { allocateVoices } from "./voices";

describe("named constants", () => {
  it("exports Jordan's decided values", () => {
    expect(MUSIC_GROWTH_STEPS_MAX).toBe(4);
    expect(MUSIC_STEMS_PER_CUE_MAX).toBe(4);
    expect(DEPTH_BLOOM_TEXTURE_M_DEFAULT).toBe(15);
    expect(GROVE_BUFFER_M.root).toBe(76.2);
    expect(THRESHOLD_MOTIF_DEPTH_M).toBe(10);
    expect(ONESHOT_CONCURRENT_GLOBAL_MAX).toBe(2);
    expect(TRANSIENT_CREST_DB).toBe(20);
    expect(MIX_SHED_AFTER_WINDOWS).toBe(2);
    expect(MIX_RECOVER_STEP_MS).toBe(60_000);
    expect(VOICE_BUDGET_TOTAL).toBe(12);
    expect(BEACONS_ENABLED_DEFAULT).toBe(true);
    expect(BACK_SKIP_MS).toBe(10_000);
    expect(RESUME_PREROLL_MS).toBe(300);
  });
});

describe("depth hysteresis", () => {
  it("latches texture depth with 5 m hysteresis", () => {
    expect(depthConditionLatched(false, 19, 15)).toBe(false);
    expect(depthConditionLatched(false, 20, 15)).toBe(true);
    expect(depthConditionLatched(true, 11, 15)).toBe(true);
    expect(depthConditionLatched(true, 9, 15)).toBe(false);
  });

  it("latches root buffer with GROVE_BUFFER_M.root", () => {
    const point = { lat: 40.98, lng: -111.9 };
    const frag = { tier: "root" as const, lat: 40.98, lng: -111.9 };
    expect(
      insideTierBuffersLatched([], point, [frag]),
    ).toEqual(["root"]);
  });
});

describe("pickResolve", () => {
  it("prefers fragment override, then tier, then pause", () => {
    expect(
      pickResolve({
        tier: "root",
        cue: { resolveRootSha: "a".repeat(64) },
        fragmentResolveSha: "b".repeat(64),
      }),
    ).toEqual({ kind: "asset", assetSha: "b".repeat(64) });
    expect(
      pickResolve({ tier: "leaf", cue: {} }),
    ).toEqual({ kind: "pause", ms: 8000 });
  });
});

describe("thresholdMotifStep", () => {
  it("plays once at depth, waits then drops under narration", () => {
    let state = initialThresholdMotifState();
    let r = thresholdMotifStep(state, {
      type: "groveEntered",
      at: 0,
      depthM: 12,
      timeWindow: "day",
      motifDaySha: "d".repeat(64),
    });
    expect(r.playSha).toBe("d".repeat(64));
    expect(r.state.played).toBe(true);

    state = initialThresholdMotifState();
    r = thresholdMotifStep(state, {
      type: "groveEntered",
      at: 0,
      depthM: 5,
      timeWindow: "day",
      motifDaySha: "d".repeat(64),
    });
    expect(r.playSha).toBeUndefined();
    r = thresholdMotifStep(r.state, { type: "narrationStarted", at: 1000 });
    r = thresholdMotifStep(r.state, {
      type: "tick",
      at: 1000 + 30_000,
      narrationPlaying: true,
      depthM: 12,
    });
    expect(r.playSha).toBeUndefined();
    expect(r.state.played).toBe(true);
  });
});

describe("beacon", () => {
  const listener = { lat: 40.98, lng: -111.9 };

  /** Offset north by metres (approx). */
  function northOf(m: number) {
    return { lat: listener.lat + m / 111_320, lng: listener.lng };
  }

  it("gain is linear in dB from FAR at range to NEAR at 0 m", () => {
    expect(BEACON_GAIN_FAR_DB).toBe(-24);
    expect(BEACON_GAIN_NEAR_DB).toBe(-6);
    const near = beaconMix(listener, 0, listener, 0);
    expect(near.gainDb).toBeCloseTo(BEACON_GAIN_NEAR_DB, 5);
    const midTarget = northOf(BEACON_RANGE_M / 2);
    const mid = beaconMix(listener, 0, midTarget, 0);
    expect(distanceMeters(listener, midTarget)).toBeCloseTo(
      BEACON_RANGE_M / 2,
      0,
    );
    expect(mid.gainDb).toBeCloseTo(
      (BEACON_GAIN_NEAR_DB + BEACON_GAIN_FAR_DB) / 2,
      0,
    );
    const farTarget = northOf(BEACON_RANGE_M);
    const far = beaconMix(listener, 0, farTarget, 0);
    expect(far.gainDb).toBeCloseTo(BEACON_GAIN_FAR_DB, 0);
  });

  it("pans front half and mirrors the back half (180° centered)", () => {
    expect(beaconPanFromRelative(0)).toBe(0);
    expect(beaconPanFromRelative(45)).toBeCloseTo(0.5);
    expect(beaconPanFromRelative(-45)).toBeCloseTo(-0.5);
    expect(beaconPanFromRelative(90)).toBe(1);
    expect(beaconPanFromRelative(-90)).toBe(-1);
    expect(beaconPanFromRelative(135)).toBeCloseTo(0.5);
    expect(beaconPanFromRelative(-135)).toBeCloseTo(-0.5);
    expect(beaconPanFromRelative(180)).toBe(0);
    expect(beaconPanFromRelative(-180)).toBe(0);

    const ahead = beaconMix(listener, 0, northOf(50), 0);
    expect(ahead.pan).toBeCloseTo(0, 1);
    expect(ahead.lowpassHz).toBe(18_000);

    const behind = beaconMix(
      listener,
      0,
      { lat: listener.lat - 50 / 111_320, lng: listener.lng },
      0,
    );
    expect(behind.pan).toBeCloseTo(0, 1);
    expect(behind.lowpassHz).toBe(2_000);

    const held = beaconMix(listener, null, northOf(50), 0.5);
    expect(held.pan).toBe(0.5);
  });

  it("chooses by nearest band then tier (stable), with switch hysteresis", () => {
    // Old pairwise comparator was non-transitive for leaf@0 / root@9 / branch@15
    // depending on input order. New rule: d0=0, band ≤10 → leaf+root → root.
    const trio = [
      { id: "leaf", tier: "leaf" as const, lat: listener.lat, lng: listener.lng },
      {
        id: "root",
        tier: "root" as const,
        ...northOf(9),
      },
      {
        id: "branch",
        tier: "branch" as const,
        ...northOf(15),
      },
    ];
    expect(
      chooseBeacon({
        listener,
        playableUnexplored: trio,
        currentId: null,
        narrationPlaying: false,
        beaconsEnabled: true,
        headphones: true,
      }),
    ).toBe("root");
    expect(
      chooseBeacon({
        listener,
        playableUnexplored: [...trio].reverse(),
        currentId: null,
        narrationPlaying: false,
        beaconsEnabled: true,
        headphones: true,
      }),
    ).toBe("root");

    expect(
      chooseBeacon({
        listener,
        playableUnexplored: [
          { id: "leaf", tier: "leaf", lat: 40.9801, lng: -111.9 },
          { id: "root", tier: "root", lat: 40.98015, lng: -111.9 },
        ],
        currentId: null,
        narrationPlaying: false,
        beaconsEnabled: true,
        headphones: true,
      }),
    ).toBe("root");

    // Hysteresis: stay on current unless best is > BEACON_TIER_NEAR_M closer
    expect(BEACON_TIER_NEAR_M).toBe(10);
    const currentNear = {
      id: "cur",
      tier: "leaf" as const,
      ...northOf(8),
    };
    const slightlyCloserRoot = {
      id: "root2",
      tier: "root" as const,
      ...northOf(5),
    };
    expect(
      chooseBeacon({
        listener,
        playableUnexplored: [currentNear, slightlyCloserRoot],
        currentId: "cur",
        narrationPlaying: false,
        beaconsEnabled: true,
        headphones: true,
      }),
    ).toBe("cur");

    expect(
      chooseBeacon({
        listener,
        playableUnexplored: [
          { id: "leaf", tier: "leaf", lat: 40.9801, lng: -111.9 },
        ],
        currentId: null,
        narrationPlaying: true,
        beaconsEnabled: true,
        headphones: true,
      }),
    ).toBeNull();
  });
});

describe("breath / resume / back", () => {
  it("resumePointMs uses max breath ≤ stop minus preroll", () => {
    expect(resumePointMs([], 5000)).toBe(0);
    expect(resumePointMs([1000, 4000], 4000)).toBe(4000 - RESUME_PREROLL_MS);
    expect(resumePointMs([1000, 4000], 3500)).toBe(1000 - RESUME_PREROLL_MS);
  });

  it("suggestBreathPoints finds long silences", () => {
    const sr = 1000;
    const samples = new Float32Array(2000);
    for (let i = 500; i < 1000; i++) samples[i] = 0;
    for (let i = 0; i < 500; i++) samples[i] = 0.5;
    for (let i = 1000; i < 2000; i++) samples[i] = 0.5;
    const points = suggestBreathPoints(samples, sr);
    expect(points.length).toBeGreaterThanOrEqual(1);
  });

  it("accentAllowed and backSkipMs", () => {
    expect(accentAllowed(1000, [1000])).toBe(true);
    expect(accentAllowed(1500, [1000])).toBe(false);
    expect(backSkipMs(15_000)).toBe(5_000);
  });
});

describe("lockedTeaserStep", () => {
  it("plays locked once per day, never wrongTime or over narration", () => {
    let state = initialLockedTeaserState("2026-06-15");
    let r = lockedTeaserStep(state, {
      at: 1,
      dayKey: "2026-06-15",
      reason: "locked",
      fragmentId: "f1",
      teaserSha: "t".repeat(64),
      narrationPlaying: false,
    });
    expect(r.playSha).toBeDefined();
    r = lockedTeaserStep(r.state, {
      at: 2,
      dayKey: "2026-06-15",
      reason: "locked",
      fragmentId: "f1",
      teaserSha: "t".repeat(64),
      narrationPlaying: false,
    });
    expect(r.playSha).toBeUndefined();
    expect(
      lockedTeaserStep(state, {
        at: 1,
        dayKey: "2026-06-15",
        reason: "wrongTime",
        fragmentId: "f2",
        teaserSha: "t".repeat(64),
        narrationPlaying: false,
      }).playSha,
    ).toBeUndefined();
  });
});

describe("mixLevelFor / allocateVoices", () => {
  it("sheds after degraded windows and recovers slowly", () => {
    let s = initialMixLevelState();
    s = mixLevelFor(
      { clockStarving: true, batterySaver: false, thermal: false },
      s,
      0,
    );
    s = mixLevelFor(
      { clockStarving: true, batterySaver: false, thermal: false },
      s,
      5_000,
    );
    expect(shedLayers(s)).toEqual(["accents"]);
    s = mixLevelFor(
      { clockStarving: false, batterySaver: false, thermal: false },
      s,
      5_000,
    );
    s = mixLevelFor(
      { clockStarving: false, batterySaver: false, thermal: false },
      s,
      5_000 + MIX_RECOVER_STEP_MS,
    );
    expect(shedLayers(s)).toEqual([]);
  });

  it("pauses accents and beacon during crossfade", () => {
    const r = allocateVoices(
      [
        { kind: "stem", id: "s1" },
        { kind: "accent", id: "a1" },
        { kind: "beacon", id: "b1" },
      ],
      true,
    );
    expect(r.granted).toContain("s1");
    expect(r.denied).toEqual(expect.arrayContaining(["a1", "b1"]));
  });
});

describe("GrovePackDevice", () => {
  it("strips unknown top-level keys", () => {
    const base = {
      schema: 4 as const,
      groveId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
      regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
      packVersion: 1,
      builtAt: "2026-01-01T00:00:00.000Z",
      grove: {
        id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
        name: { en: "Demo" },
        premise: { en: "P" },
        boundary: {
          type: "MultiPolygon" as const,
          coordinates: [
            [
              [
                [-111.93, 40.96],
                [-111.92, 40.96],
                [-111.92, 40.97],
                [-111.93, 40.97],
                [-111.93, 40.96],
              ],
            ],
          ],
        },
        allowsSpeakerWildlifeSounds: false,
        openingFragmentId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000030",
        journeys: {},
      },
      characters: [],
      fragments: [],
      crossGroveLinks: [],
      externalPrerequisites: [],
      revisions: [],
      questions: [],
      music: { cues: [] },
      ambienceZones: [],
      gatherings: [],
      assets: [],
      futureKey: "ignored",
    };
    expect(() => GrovePack.parse(base)).toThrow();
    const device = GrovePackDevice.parse(base);
    expect("futureKey" in device).toBe(false);
    expect(device.schema).toBe(4);
  });
});
