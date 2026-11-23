import { describe, expect, it } from "vitest";
import type { GeoJsonPolygon } from "../geo/polygon";
import { createSeededRng, type SeededRng } from "./seededRng";
import {
  activeProfiles,
  eligibleLayers,
  landcoverClass,
  nextOneShot,
  pickBed,
  type AmbienceLayerInput,
  type AmbienceZoneInput,
} from "./ambience";

const square: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-111.9, 40.98],
      [-111.899, 40.98],
      [-111.899, 40.981],
      [-111.9, 40.981],
      [-111.9, 40.98],
    ],
  ],
};

const center = { lat: 40.9805, lng: -111.8995 };
const outside = { lat: 40.97, lng: -111.9 };

function zone(overrides: Partial<AmbienceZoneInput> = {}): AmbienceZoneInput {
  return {
    id: "marsh-zone",
    boundary: square,
    profileSlug: "marsh",
    priority: 200,
    edgeFadeM: 10,
    ...overrides,
  };
}

function layer(overrides: Partial<AmbienceLayerInput> = {}): AmbienceLayerInput {
  return {
    id: "wind",
    kind: "bed",
    timeWindow: "day",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    wildlifeCall: false,
    nestingMuteMonths: [],
    speakerSafe: true,
    gainDbMin: -18,
    gainDbMax: -10,
    panMin: -0.8,
    panMax: 0.8,
    pitchCentsMin: -100,
    pitchCentsMax: 100,
    noRepeatLast: 2,
    crossfadeMs: 4000,
    assets: [
      { sha: "a", weight: 1 },
      { sha: "b", weight: 1 },
      { sha: "c", weight: 1 },
    ],
    ...overrides,
  };
}

const profile = {
  slug: "marsh",
  density: 1,
  layers: [] as AmbienceLayerInput[],
};

describe("landcoverClass", () => {
  it("takes the majority and lets the center win a tie", () => {
    expect(landcoverClass(["a", "a", "a", "b", "b", "b", null])).toBe("a");
    expect(landcoverClass(["c", "a", "a", "a", "b", "b", "b"])).toBe("a");
    expect(landcoverClass([null, "b", "b", "b", "a", "a", "a"])).toBe("b");
    expect(landcoverClass([null, null, null])).toBeNull();
  });
});

describe("activeProfiles", () => {
  const classes = new Map([
    ["marsh-code", "marsh"],
    ["street-code", "street"],
  ]);

  it("is the top zone at weight 1 when the listener is deep inside", () => {
    const profiles = activeProfiles({
      zones: [
        zone({ id: "low", profileSlug: "street", priority: 10, edgeFadeM: 10 }),
        zone({ id: "high", profileSlug: "marsh", priority: 50, edgeFadeM: 10 }),
      ],
      point: center,
      landcoverCells: ["street-code"],
      classToProfile: classes,
    });
    expect(profiles).toEqual([{ profileSlug: "marsh", weight: 1 }]);
  });

  it("blends the fade band with the next zone, weights summing to 1", () => {
    const profiles = activeProfiles({
      zones: [
        zone({ id: "high", profileSlug: "marsh", priority: 50, edgeFadeM: 10_000 }),
        zone({ id: "low", profileSlug: "street", priority: 10, edgeFadeM: 10 }),
      ],
      point: center,
      landcoverCells: ["marsh-code"],
      classToProfile: classes,
    });
    expect(profiles).toHaveLength(2);
    expect(profiles[0]?.profileSlug).toBe("marsh");
    expect(profiles[0]?.weight).toBeGreaterThan(0);
    expect(profiles[0]?.weight).toBeLessThan(1);
    expect(profiles[1]).toEqual({
      profileSlug: "street",
      weight: 1 - (profiles[0]?.weight ?? 0),
    });
  });

  it("gives the remainder to landcover and merges a repeated profile", () => {
    const blended = activeProfiles({
      zones: [zone({ edgeFadeM: 10_000 })],
      point: center,
      landcoverCells: ["street-code"],
      classToProfile: classes,
    });
    expect(blended.map((item) => item.profileSlug)).toEqual(["marsh", "street"]);
    const weight = blended[0]?.weight ?? 0;
    expect(blended[1]?.weight).toBeCloseTo(1 - weight);

    const merged = activeProfiles({
      zones: [zone({ profileSlug: "marsh", edgeFadeM: 10_000 })],
      point: center,
      landcoverCells: ["marsh-code"],
      classToProfile: classes,
    });
    expect(merged).toEqual([{ profileSlug: "marsh", weight: 1 }]);
  });

  it("uses landcover alone, or nothing when the grid and the map miss", () => {
    expect(
      activeProfiles({
        zones: [],
        point: outside,
        landcoverCells: ["street-code"],
        classToProfile: classes,
      }),
    ).toEqual([{ profileSlug: "street", weight: 1 }]);
    expect(
      activeProfiles({
        zones: [],
        point: outside,
        landcoverCells: [null, null],
        classToProfile: classes,
      }),
    ).toEqual([]);
    expect(
      activeProfiles({
        zones: [],
        point: outside,
        landcoverCells: ["unknown"],
        classToProfile: classes,
      }),
    ).toEqual([]);
  });
});

describe("eligibleLayers", () => {
  const layers = [
    layer({ id: "day" }),
    layer({ id: "night", timeWindow: "night" }),
    layer({ id: "summer", months: [6, 7, 8] }),
    layer({ id: "bird", wildlifeCall: true, nestingMuteMonths: [4, 5, 6] }),
    layer({ id: "harsh", speakerSafe: false }),
  ];
  const marsh = { ...profile, layers };

  function eligible(
    overrides: Partial<Parameters<typeof eligibleLayers>[0]> = {},
  ): string[] {
    return eligibleLayers({
      profile: marsh,
      timeWindow: "day",
      month: 7,
      route: "headphones",
      muteAllSurroundingsOnSpeaker: false,
      hushActive: false,
      ...overrides,
    }).map((item) => item.id);
  }

  it("filters window, month, nesting, speaker, grove mute and hush", () => {
    expect(eligible()).toEqual(["day", "summer", "bird", "harsh"]);
    expect(eligible({ month: 1 })).toEqual(["day", "bird", "harsh"]);
    expect(eligible({ month: 5 })).not.toContain("bird");
    expect(eligible({ route: "speaker" })).toEqual(["day", "summer"]);
    expect(eligible({ route: "speaker", month: 5 })).not.toContain("bird");
    expect(eligible({ route: "speaker", muteAllSurroundingsOnSpeaker: true })).toEqual([]);
    expect(eligible({ hushActive: true })).toEqual([]);
  });

  it("keeps wildlife and non-speaker-safe layers on headphones", () => {
    expect(eligible({ route: "headphones", month: 7 })).toEqual([
      "day",
      "summer",
      "bird",
      "harsh",
    ]);
  });
});

describe("pickBed", () => {
  it("avoids the last repeats and is quieter at a lower weight", () => {
    const bed = layer({ noRepeatLast: 2 });
    const picked = pickBed({
      layer: bed,
      profileWeight: 1,
      recentShas: ["a", "b"],
      rng: createSeededRng(1),
    });
    expect(picked?.sha).toBe("c");
    expect(picked?.gainDb).toBeGreaterThanOrEqual(-18);
    expect(picked?.gainDb).toBeLessThanOrEqual(-10);

    const full = pickBed({
      layer: bed,
      profileWeight: 1,
      recentShas: [],
      rng: createSeededRng(4),
    });
    const half = pickBed({
      layer: bed,
      profileWeight: 0.5,
      recentShas: [],
      rng: createSeededRng(4),
    });
    expect(half?.sha).toBe(full?.sha);
    expect(half?.gainDb).toBeCloseTo((full?.gainDb ?? 0) + 20 * Math.log10(0.5));
    expect(half?.gainDb ?? 0).toBeLessThan(full?.gainDb ?? 0);
  });

  it("repeats the same pick from the same seed", () => {
    const once = pickBed({
      layer: layer(),
      profileWeight: 1,
      recentShas: [],
      rng: createSeededRng(9),
    });
    const twice = pickBed({
      layer: layer(),
      profileWeight: 1,
      recentShas: [],
      rng: createSeededRng(9),
    });
    expect(twice).toEqual(once);
  });
});

describe("nextOneShot", () => {
  const shot = layer({
    kind: "oneshot",
    meanIntervalS: 8,
    minIntervalS: 2,
    maxConcurrent: 2,
  });

  function step(
    overrides: Partial<Parameters<typeof nextOneShot>[0]> = {},
    rng: SeededRng = createSeededRng(1),
  ) {
    return nextOneShot({
      layer: shot,
      profileWeight: 1,
      density: 1,
      nowSec: 0,
      recentShas: [],
      concurrent: 0,
      narrationPlaying: false,
      narrationStartedAtSec: null,
      narrationEndsAtSec: null,
      lastOneShotAtSec: null,
      state: { nextAtSec: null },
      rng,
      ...overrides,
    });
  }

  it("waits at least the minimum, and a higher density comes sooner", () => {
    const zeros = (): SeededRng => () => 0;
    const first = step({ rng: zeros() });
    expect(first.shot).toBeNull();
    expect(first.state.nextAtSec).toBe(2);

    const sparse = step({ rng: () => 0.5, layer: layer({ kind: "oneshot", meanIntervalS: 8, minIntervalS: 0 }) });
    const dense = step({
      rng: () => 0.5,
      density: 2,
      layer: layer({ kind: "oneshot", meanIntervalS: 8, minIntervalS: 0 }),
    });
    expect(dense.state.nextAtSec ?? 0).toBeLessThan(sparse.state.nextAtSec ?? 0);
  });

  it("drops a shot at the concurrency cap and draws the next gap from that tick", () => {
    const due = step({
      state: { nextAtSec: 0 },
      nowSec: 10,
      concurrent: 2,
      rng: () => 0,
    });
    expect(due.shot).toBeNull();
    expect(due.state.nextAtSec).toBe(12);
  });

  it("drops shots in the narration guard and closer than 4 s", () => {
    expect(
      step({
        state: { nextAtSec: 0 },
        nowSec: 10,
        narrationPlaying: true,
        narrationStartedAtSec: 9,
        rng: () => 0,
      }).shot,
    ).toBeNull();
    expect(
      step({
        state: { nextAtSec: 0 },
        nowSec: 10,
        narrationPlaying: true,
        narrationEndsAtSec: 11,
        rng: () => 0,
      }).shot,
    ).toBeNull();
    expect(
      step({
        state: { nextAtSec: 0 },
        nowSec: 10,
        narrationPlaying: true,
        lastOneShotAtSec: 7,
        rng: () => 0,
      }).shot,
    ).toBeNull();
    expect(
      step({
        state: { nextAtSec: 0 },
        nowSec: 10,
        narrationPlaying: true,
        lastOneShotAtSec: 6,
      }).shot?.sha,
    ).toBeTruthy();
  });

  it("returns the same event for the same state and seed, and does not draw while waiting", () => {
    const state = { nextAtSec: 0 };
    const once = step({ state, nowSec: 5 }, createSeededRng(3));
    const twice = step({ state, nowSec: 5 }, createSeededRng(3));
    expect(twice).toEqual(once);
    expect(once.shot?.pan).toBeGreaterThanOrEqual(-0.8);
    expect(once.shot?.pan).toBeLessThanOrEqual(0.8);
    expect(once.shot?.rate).toBeGreaterThan(0);

    expect(() =>
      step({ state: { nextAtSec: 20 }, nowSec: 5 }, () => {
        throw new Error("drew while waiting");
      }),
    ).not.toThrow();
  });
});
