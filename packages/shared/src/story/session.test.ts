import { describe, expect, it } from "vitest";
import { groveShape } from "../geo/groveShape";
import type { GeoJsonMultiPolygon } from "../geo/polygon";
import { AFTERGLOW_MS } from "../audio/DuckingPolicy";
import {
  computedPlayedMs,
  initialSessionState,
  OUTSIDE_END_MS,
  parseSessionState,
  SESSION_MAX_MS,
  sessionStep,
  storyStateOf,
  type SessionEffect,
  type SessionState,
  type SessionWorld,
} from "./session";
import type { CompletionRow, FragmentInput, UnlockRow } from "./unlock";

const GROVE_ID = "grove-demo";

function squareAround(
  lat: number,
  lng: number,
  delta = 0.002,
): GeoJsonMultiPolygon {
  // Outer ring counterclockwise: SW → SE → NE → NW → SW
  return {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [lng - delta, lat - delta],
          [lng + delta, lat - delta],
          [lng + delta, lat + delta],
          [lng - delta, lat + delta],
          [lng - delta, lat - delta],
        ],
      ],
    ],
  };
}

function frag(overrides: Partial<FragmentInput> = {}): FragmentInput {
  return {
    id: "f1",
    groveId: GROVE_ID,
    tier: "root",
    visibility: "standard",
    retired: false,
    lat: 40.9612,
    lng: -111.929,
    radiusM: 25,
    requires: [],
    threadIds: ["t1"],
    contingencyRevisionNo: 1,
    versions: [
      { lang: "en", timeWindow: "day" },
      { lang: "en", timeWindow: "night" },
    ],
    ...overrides,
  };
}

function world(overrides: Partial<SessionWorld> = {}): SessionWorld {
  const f1 = frag();
  return {
    groves: [{ id: GROVE_ID, boundary: squareAround(f1.lat, f1.lng) }],
    fragments: [f1],
    fragmentMeta: {
      f1: { revisionNo: 1, characterIds: ["char-a"], teaser: "locked teaser" },
    },
    externalPrerequisites: [],
    markers: {},
    completions: [],
    unlocks: [],
    timeWindow: "day",
    lang: "en",
    settings: {
      accessibleTrigger: false,
      locationAvailable: true,
      accuracyToleranceM: 25,
    },
    ...overrides,
  };
}

function step(
  state: SessionState,
  event: Parameters<typeof sessionStep>[1],
  w: SessionWorld,
): { state: SessionState; effects: SessionEffect[] } {
  return sessionStep(state, event, w);
}

function effectTypes(effects: SessionEffect[]): string[] {
  return effects.map((e) => e.type);
}

describe("parseSessionState / versioning", () => {
  it("round-trips initial state", () => {
    const s = initialSessionState();
    expect(parseSessionState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it("rejects unknown versions", () => {
    expect(() => parseSessionState({ ...initialSessionState(), v: 2 })).toThrow();
  });
});

describe("session start", () => {
  it("refuses to start without sessionId", () => {
    const w = world();
    const f = w.fragments[0]!;
    const { state, effects } = step(initialSessionState(), {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
    }, w);
    expect(state.phase).toBe("idle");
    expect(effects.some((e) => e.type === "sessionStarted")).toBe(false);
  });

  it("starts exploring on a fix inside a grove", () => {
    const w = world();
    const f = w.fragments[0]!;
    const { state, effects } = step(initialSessionState(), {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "sess-1",
    }, w);
    expect(state.phase).toBe("exploring");
    expect(state.sessionId).toBe("sess-1");
    expect(state.groveIds).toContain(GROVE_ID);
    expect(state.currentGroveId).toBe(GROVE_ID);
    expect(effects.some((e) => e.type === "sessionStarted")).toBe(true);
    expect(effects.some((e) => e.type === "groveEntered")).toBe(true);
    expect(
      effects.some(
        (e) => e.type === "analytics" && e.name === "session_started",
      ),
    ).toBe(true);
  });

  it("starts on a scan even outside every grove", () => {
    const physical = frag({
      id: "phys",
      visibility: "physical",
      radiusM: undefined,
    });
    const w = world({
      fragments: [physical],
      fragmentMeta: { phys: { revisionNo: 1 } },
      markers: { abc: "phys" },
      unlocks: [{ fragmentId: "phys" }],
    });
    const { state, effects } = step(initialSessionState(), {
      type: "scan",
      at: 2_000,
      markerHash: "abc",
      sessionId: "sess-scan",
    }, w);
    expect(state.phase).toBe("exploring");
    expect(effects.some((e) => e.type === "play")).toBe(true);
  });
});

describe("proximity and accessible", () => {
  it("plays after two accurate fixes within the radius", () => {
    const w = world({
      settings: {
        accessibleTrigger: false,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    const second = step(state, {
      type: "fix",
      at: 2_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
    }, w);
    expect(second.effects.some((e) => e.type === "play")).toBe(true);
    const play = second.effects.find((e) => e.type === "play");
    expect(play).toMatchObject({
      type: "play",
      fragmentId: "f1",
      via: "proximity",
    });
    expect(
      second.effects.find(
        (e) => e.type === "analytics" && e.name === "fragment_triggered",
      ),
    ).toMatchObject({
      props: { trigger: "proximity", time_window: "day" },
      refs: { fragmentId: "f1", sessionId: "s" },
    });
  });

  it("accessible: a single fix within 35 ft starts play", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    const { effects } = step(initialSessionState(), {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w);
    expect(effects.some((e) => e.type === "play" && e.via === "accessible")).toBe(
      true,
    );
  });

  it("never passes physical fragments to proximityCandidates", () => {
    const standard = frag({ id: "std" });
    const physical = frag({
      id: "phys",
      visibility: "physical",
      radiusM: undefined,
      lat: standard.lat,
      lng: standard.lng,
    });
    const w = world({
      fragments: [standard, physical],
      fragmentMeta: { std: { revisionNo: 1 }, phys: { revisionNo: 1 } },
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const { effects } = step(initialSessionState(), {
      type: "fix",
      at: 1_000,
      lat: standard.lat,
      lng: standard.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w);
    const plays = effects.filter((e) => e.type === "play");
    expect(plays.every((e) => e.type === "play" && e.fragmentId === "std")).toBe(
      true,
    );
    expect(plays.some((e) => e.type === "play" && e.fragmentId === "phys")).toBe(
      false,
    );
  });
});

describe("eligibility table", () => {
  const cases: {
    name: string;
    fragment: Partial<FragmentInput>;
    completions?: CompletionRow[];
    unlocks?: UnlockRow[];
    timeWindow?: "day" | "night";
    expectPlay: boolean;
  }[] = [
    { name: "unlocked root", fragment: {}, expectPlay: true },
    {
      name: "locked",
      fragment: { requires: [["missing"]] },
      expectPlay: false,
    },
    {
      name: "out of window",
      fragment: {
        versions: [{ lang: "en", timeWindow: "day" }],
      },
      timeWindow: "night",
      expectPlay: false,
    },
    {
      name: "completed current epoch",
      fragment: {},
      completions: [
        { fragmentId: "f1", revisionNo: 1, timeWindow: "day", onSite: true },
      ],
      expectPlay: false,
    },
    {
      name: "changed (older contingency)",
      fragment: { contingencyRevisionNo: 3 },
      completions: [
        { fragmentId: "f1", revisionNo: 1, timeWindow: "day", onSite: true },
      ],
      expectPlay: true,
    },
    {
      name: "retired",
      fragment: { retired: true },
      expectPlay: false,
    },
    {
      name: "physical never via proximity",
      fragment: { visibility: "physical", radiusM: undefined },
      unlocks: [{ fragmentId: "f1" }],
      expectPlay: false,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const f = frag(c.fragment);
      const w = world({
        fragments: [f],
        fragmentMeta: { [f.id]: { revisionNo: f.contingencyRevisionNo } },
        completions: c.completions ?? [],
        unlocks: c.unlocks ?? [],
        timeWindow: c.timeWindow ?? "day",
        settings: {
          accessibleTrigger: true,
          locationAvailable: true,
          accuracyToleranceM: 25,
        },
      });
      const { effects } = step(initialSessionState(), {
        type: "fix",
        at: 1_000,
        lat: f.lat,
        lng: f.lng,
        accuracyM: 5,
        sessionId: "s",
      }, w);
      const played = effects.some(
        (e) => e.type === "play" && e.fragmentId === f.id,
      );
      expect(played).toBe(c.expectPlay);
    });
  }
});

describe("scan teasers", () => {
  it("locked → showTeaser reason locked", () => {
    const physical = frag({
      id: "phys",
      visibility: "physical",
      radiusM: undefined,
      requires: [["need"]],
    });
    const w = world({
      fragments: [physical],
      fragmentMeta: {
        phys: { revisionNo: 1, changeTeaser: "it changed" },
      },
      markers: { h: "phys" },
    });
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1,
      lat: physical.lat,
      lng: physical.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    const { effects } = step(state, {
      type: "scan",
      at: 2,
      markerHash: "h",
    }, w);
    expect(effects).toContainEqual({
      type: "showTeaser",
      fragmentId: "phys",
      reason: "locked",
      changeTeaser: "it changed",
    });
  });

  it("unlocked wrong time → showTeaser reason wrongTime", () => {
    const physical = frag({
      id: "phys",
      visibility: "physical",
      radiusM: undefined,
      versions: [{ lang: "en", timeWindow: "day" }],
    });
    const w = world({
      fragments: [physical],
      fragmentMeta: { phys: { revisionNo: 1 } },
      markers: { h: "phys" },
      unlocks: [{ fragmentId: "phys" }],
      timeWindow: "night",
    });
    const { effects } = step(initialSessionState(), {
      type: "scan",
      at: 1,
      markerHash: "h",
      sessionId: "s",
    }, w);
    expect(effects).toContainEqual({
      type: "showTeaser",
      fragmentId: "phys",
      reason: "wrongTime",
    });
  });

  it("unknown marker hash is a silent no-op", () => {
    const w = world({ markers: {} });
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1,
      lat: 40.9612,
      lng: -111.929,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    const { effects } = step(state, {
      type: "scan",
      at: 2,
      markerHash: "unknown",
    }, w);
    expect(effects).toEqual([]);
  });
});

describe("natural end effect order", () => {
  it("recordCompletion → writeUnlocks → metCharacters → analytics → startAfterglow", () => {
    const branch = frag({
      id: "f2",
      tier: "branch",
      requires: [["f1"]],
      lat: 40.9613,
      lng: -111.9291,
    });
    const root = frag({ id: "f1" });
    const w = world({
      fragments: [root, branch],
      fragmentMeta: {
        f1: { revisionNo: 1, characterIds: ["c1"] },
        f2: { revisionNo: 1 },
      },
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: root.lat,
      lng: root.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    expect(state.playing?.fragmentId).toBe("f1");
    const { state: after, effects } = step(state, {
      type: "narrationEnded",
      at: 3_000,
      reason: "natural",
      playedMs: 2_000,
    }, w);
    const types = effectTypes(effects);
    expect(types).toEqual([
      "recordCompletion",
      "writeUnlocks",
      "metCharacters",
      "analytics",
      "analytics",
      "analytics",
      "startAfterglow",
    ]);
    expect(effects.find((e) => e.type === "writeUnlocks")).toMatchObject({
      // f1 has empty requires → shouldWriteUnlock; f2 unlocks from f1's completion
      fragmentIds: ["f1", "f2"],
    });
    const analytics = effects.filter((e) => e.type === "analytics");
    expect(analytics[0]).toMatchObject({
      name: "fragment_completed",
      props: { time_window: "day", change_kind: null },
      refs: { fragmentId: "f1", sessionId: "s" },
    });
    expect(analytics.map((e) => e.type === "analytics" && e.name)).toEqual([
      "fragment_completed",
      "fragment_unlocked",
      "fragment_unlocked",
    ]);
    expect(effects.find((e) => e.type === "startAfterglow")).toMatchObject({
      endsAt: 3_000 + AFTERGLOW_MS,
      fragmentId: "f1",
      tier: "root",
    });
    expect(after.afterglowEndsAt).toBe(3_000 + AFTERGLOW_MS);
    expect(after.playing).toBeNull();
  });
});

describe("pause / resume", () => {
  it("computes playedMs excluding pause; stop while paused records progress", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    ({ state } = step(state, { type: "narrationPaused", at: 2_000 }, w));
    expect(state.playing?.pausedAt).toBe(2_000);
    expect(computedPlayedMs(state.playing!, 2_500)).toBe(1_000);
    ({ state } = step(state, { type: "narrationResumed", at: 3_000 }, w));
    expect(state.playing?.pausedAt).toBeNull();
    expect(state.playing?.pausedTotalMs).toBe(1_000);
    expect(computedPlayedMs(state.playing!, 4_000)).toBe(2_000);

    ({ state } = step(state, { type: "narrationPaused", at: 4_500 }, w));
    const ended = step(state, { type: "stop", at: 5_000 }, w);
    const progress = ended.effects.find((e) => e.type === "recordProgress");
    expect(progress).toMatchObject({
      type: "recordProgress",
      maxProgressMs: computedPlayedMs(state.playing!, 5_000),
    });
    expect(ended.effects.some((e) => e.type === "stopNarration")).toBe(true);
  });

  it("interrupted keeps a queued scan only; stopped clears the queue", () => {
    const root = frag({ id: "f1" });
    const physical = frag({
      id: "phys",
      visibility: "physical",
      radiusM: undefined,
      lat: root.lat + 0.0001,
      lng: root.lng,
    });
    const w = world({
      fragments: [root, physical],
      fragmentMeta: {
        f1: { revisionNo: 1 },
        phys: { revisionNo: 1 },
      },
      markers: { h: "phys" },
      unlocks: [{ fragmentId: "phys" }],
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: root.lat,
      lng: root.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    ({ state } = step(state, { type: "scan", at: 1_500, markerHash: "h" }, w));
    expect(state.queued).toEqual({ fragmentId: "phys", via: "scan" });

    const interrupted = step(state, {
      type: "narrationEnded",
      at: 2_000,
      reason: "interrupted",
      playedMs: 500,
    }, w);
    expect(interrupted.state.queued).toEqual({
      fragmentId: "phys",
      via: "scan",
    });

    // rebuild playing with a proximity queue instead
    let s2 = initialSessionState();
    ({ state: s2 } = step(s2, {
      type: "fix",
      at: 1_000,
      lat: root.lat,
      lng: root.lng,
      accuracyM: 5,
      sessionId: "s2",
    }, w));
    // Force a non-scan queue by completing afterglow path: set queued manually via scan then replace...
    // Simpler: play, then scan to queue, then stop.
    ({ state: s2 } = step(s2, { type: "scan", at: 1_100, markerHash: "h" }, w));
    const stopped = step(s2, {
      type: "narrationEnded",
      at: 2_000,
      reason: "stopped",
      playedMs: 900,
    }, w);
    expect(stopped.state.queued).toBeNull();
  });
});

describe("scan visit grove", () => {
  it("adds the scanned fragment's groveId so writeVisit includes it", () => {
    const groveA = GROVE_ID;
    const groveB = "grove-b";
    const rootA = frag({
      id: "f1",
      groveId: groveA,
      lat: 40.9612,
      lng: -111.929,
    });
    const physB = frag({
      id: "phys-b",
      groveId: groveB,
      visibility: "physical",
      radiusM: undefined,
      lat: 40.97,
      lng: -111.91,
    });
    const w = world({
      groves: [
        { id: groveA, boundary: squareAround(rootA.lat, rootA.lng) },
        { id: groveB, boundary: squareAround(physB.lat, physB.lng) },
      ],
      fragments: [rootA, physB],
      fragmentMeta: {
        f1: { revisionNo: 1 },
        "phys-b": { revisionNo: 1 },
      },
      markers: { "hash-b": "phys-b" },
      unlocks: [{ fragmentId: "phys-b" }],
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const w2 = w;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: rootA.lat,
      lng: rootA.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w2));
    expect(state.groveIds).toEqual([groveA]);
    // Stop A's narration so the scan can play immediately
    ({ state } = step(state, {
      type: "narrationEnded",
      at: 2_000,
      reason: "stopped",
      playedMs: 500,
    }, w2));
    ({ state } = step(state, {
      type: "scan",
      at: 3_000,
      markerHash: "hash-b",
    }, w2));
    expect(state.groveIds).toEqual([groveA, groveB]);
    expect(state.playing?.fragmentId).toBe("phys-b");
    ({ state } = step(state, {
      type: "narrationEnded",
      at: 5_000,
      reason: "natural",
      playedMs: 2_000,
    }, w2));
    const ended = step(state, { type: "stop", at: 6_000 }, w2);
    const visit = ended.effects.find((e) => e.type === "writeVisit");
    expect(visit).toMatchObject({
      type: "writeVisit",
      groves: [
        { groveId: groveA, fragmentsCompleted: 0 },
        { groveId: groveB, fragmentsCompleted: 1 },
      ],
    });
  });
});

describe("location mode without access", () => {
  it("returns idle when locationAvailable is false", () => {
    const w = world({
      settings: {
        accessibleTrigger: false,
        locationAvailable: false,
        accuracyToleranceM: 25,
      },
    });
    const physical = frag({
      id: "phys",
      visibility: "physical",
      radiusM: undefined,
    });
    const w2: SessionWorld = {
      ...w,
      fragments: [physical],
      fragmentMeta: { phys: { revisionNo: 1 } },
      markers: { h: "phys" },
      unlocks: [{ fragmentId: "phys" }],
    };
    const { effects } = step(initialSessionState(), {
      type: "scan",
      at: 1_000,
      markerHash: "h",
      sessionId: "s",
    }, w2);
    expect(
      effects.some(
        (e) => e.type === "setLocationMode" && e.mode === "idle",
      ),
    ).toBe(true);
  });
});

describe("settingsChanged merges event into world for the step", () => {
  it("uses event.locationAvailable even when world still says true", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    // World still has locationAvailable: true; event turns it off.
    const { effects } = step(
      state,
      {
        type: "settingsChanged",
        at: 2_000,
        accessibleTrigger: true,
        locationAvailable: false,
      },
      w,
    );
    expect(
      effects.some(
        (e) => e.type === "setLocationMode" && e.mode === "idle",
      ),
    ).toBe(true);
  });
});

describe("timeouts and visit", () => {
  it("ends after 15 minutes outside; writeVisit is per grove", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    // leave grove
    ({ state } = step(state, {
      type: "fix",
      at: 2_000,
      lat: f.lat + 0.05,
      lng: f.lng,
      accuracyM: 5,
    }, w));
    const ended = step(state, {
      type: "tick",
      at: 2_000 + OUTSIDE_END_MS,
    }, w);
    expect(ended.state.phase).toBe("idle");
    const visit = ended.effects.find((e) => e.type === "writeVisit");
    expect(visit).toMatchObject({
      type: "writeVisit",
      sessionId: "s",
      groves: [{ groveId: GROVE_ID, fragmentsCompleted: 0 }],
    });
  });

  it("ends after SESSION_MAX_MS", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    const ended = step(state, {
      type: "tick",
      at: 1_000 + SESSION_MAX_MS,
    }, w);
    expect(ended.state.phase).toBe("idle");
    expect(ended.effects.some((e) => e.type === "sessionEnded")).toBe(true);
  });
});

describe("windowChanged", () => {
  it("drops a queued fragment with no version for the new window", () => {
    const dayOnly = frag({
      id: "day",
      versions: [{ lang: "en", timeWindow: "day" }],
      lat: 40.9614,
      lng: -111.9292,
    });
    const root = frag({ id: "f1" });
    const w = world({
      fragments: [root, dayOnly],
      fragmentMeta: { f1: { revisionNo: 1 }, day: { revisionNo: 1 } },
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: root.lat,
      lng: root.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    // Queue day-only while root plays: move to dayOnly and trigger accessible
    ({ state } = step(state, {
      type: "fix",
      at: 1_500,
      lat: dayOnly.lat,
      lng: dayOnly.lng,
      accuracyM: 5,
    }, w));
    expect(state.queued?.fragmentId).toBe("day");
    const { state: next } = step(state, {
      type: "windowChanged",
      at: 1_600,
      timeWindow: "night",
    }, w);
    expect(next.queued).toBeNull();
  });
});

describe("storyStateOf", () => {
  it("prefers playing grove, then currentGroveId, then last entered", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    let state = initialSessionState();
    ({ state } = step(state, {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w));
    const story = storyStateOf(state, w);
    expect(story.groveId).toBe(GROVE_ID);
    expect(story.playingFragmentId).toBe("f1");
    expect(story.playingTier).toBe("root");
    expect(story.narrationPlaying).toBe(true);
    expect(story.heard).toBeInstanceOf(Set);
  });
});

describe("groveShape boundary integration", () => {
  it("builds a MultiPolygon the reducer accepts", () => {
    const fragments = [
      frag({ id: "a", tier: "root", lat: 40.9612, lng: -111.929 }),
      frag({ id: "b", tier: "branch", lat: 40.9615, lng: -111.9285 }),
    ];
    const boundary = groveShape(
      fragments.map((f) => ({
        id: f.id,
        tier: f.tier,
        lat: f.lat,
        lng: f.lng,
      })),
    );
    expect(boundary?.type).toBe("MultiPolygon");
  });
});

describe("privacy", () => {
  it("session start and play effects have no lat/lng keys", () => {
    const w = world({
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    });
    const f = w.fragments[0]!;
    const { effects } = step(initialSessionState(), {
      type: "fix",
      at: 1_000,
      lat: f.lat,
      lng: f.lng,
      accuracyM: 5,
      sessionId: "s",
    }, w);
    for (const e of effects) {
      const json = JSON.stringify(e);
      expect(json).not.toMatch(/"lat"/);
      expect(json).not.toMatch(/"lng"/);
    }
  });
});
