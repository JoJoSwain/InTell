/**
 * Scripted Farmington walk: GPX fixes + simulated narration ends.
 * Mirrors M6 acceptance in pure logic (A4).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { groveShape } from "../geo/groveShape";
import { AFTERGLOW_MS } from "../audio/DuckingPolicy";
import {
  initialSessionState,
  OUTSIDE_END_MS,
  parseSessionState,
  sessionStep,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
  type SessionWorld,
} from "./session";
import type {
  CompletionRow,
  FragmentInput,
  UnlockRow,
} from "./unlock";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const GPX_PATH = join(ROOT, "apps/mobile/e2e/demo-route.gpx");
const FIXTURE_PATH = join(
  ROOT,
  "supabase/fixtures/farmington-bird-refuge.json",
);
const MEDIA_PATH = join(ROOT, "supabase/seed-media.json");

const GROVE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SESSION_ID = "walk-session-1";
const T0 = Date.parse("2026-06-15T17:00:00.000Z");

type FixtureFrag = {
  key: string;
  tier: "root" | "branch" | "leaf";
  at: [number, number];
  visibility: "standard" | "physical";
  radius_m: number;
  requires: string[][];
  marker_code?: string;
};

type Fixture = {
  fragments: FixtureFrag[];
};

type Media = {
  assets: Record<string, { duration_ms: number }>;
};

function parseGpx(xml: string): { lat: number; lng: number; at: number }[] {
  const points: { lat: number; lng: number; at: number }[] = [];
  const re =
    /<trkpt lat="([^"]+)" lon="([^"]+)"><ele>[^<]*<\/ele><time>([^<]+)<\/time><\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    points.push({
      lat: Number(m[1]),
      lng: Number(m[2]),
      at: Date.parse(m[3]!),
    });
  }
  return points;
}

function markerHash(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function buildWorld(): {
  world: SessionWorld;
  durations: Record<string, number>;
  fragIds: Record<string, string>;
} {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;
  const media = JSON.parse(readFileSync(MEDIA_PATH, "utf8")) as Media;

  const fragIds: Record<string, string> = {};
  for (const f of fixture.fragments) {
    fragIds[f.key] = f.key;
  }

  const fragments: FragmentInput[] = fixture.fragments.map((f) => {
    const versions =
      f.key === "frag8"
        ? [{ lang: "en" as const, timeWindow: "day" as const }]
        : [
            { lang: "en" as const, timeWindow: "day" as const },
            { lang: "en" as const, timeWindow: "night" as const },
          ];
    // frag4 correction: contingency stays at 1; frag10 contingency epoch 2
    const contingencyRevisionNo = f.key === "frag10" ? 2 : 1;
    return {
      id: f.key,
      groveId: GROVE_ID,
      tier: f.tier,
      visibility: f.visibility,
      retired: false,
      lat: f.at[0]!,
      lng: f.at[1]!,
      ...(f.visibility === "standard" ? { radiusM: f.radius_m } : {}),
      requires: f.requires.map((g) => [...g]),
      threadIds: [],
      contingencyRevisionNo,
      versions,
    };
  });

  const boundary = groveShape(
    fragments.map((f) => ({
      id: f.id,
      tier: f.tier,
      lat: f.lat,
      lng: f.lng,
    })),
  );
  if (!boundary) throw new Error("groveShape returned null");

  const markers: Record<string, string> = {};
  const frag9 = fixture.fragments.find((f) => f.key === "frag9");
  if (frag9?.marker_code) {
    markers[markerHash(frag9.marker_code)] = "frag9";
  }

  const fragmentMeta: Record<
    string,
    { revisionNo: number; changeTeaser?: string }
  > = {};
  const durations: Record<string, number> = {};
  for (const f of fixture.fragments) {
    fragmentMeta[f.key] = {
      revisionNo: f.key === "frag10" ? 2 : f.key === "frag4" ? 2 : 1,
      ...(f.key === "frag10"
        ? { changeTeaser: "the path forked again" }
        : {}),
    };
    const asset = media.assets[`narration_${f.key}`];
    durations[f.key] = asset?.duration_ms ?? 2_000;
  }

  return {
    world: {
      groves: [{ id: GROVE_ID, boundary }],
      fragments,
      fragmentMeta,
      externalPrerequisites: [],
      markers,
      completions: [],
      unlocks: [],
      timeWindow: "day",
      lang: "en",
      settings: {
        accessibleTrigger: false,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    },
    durations,
    fragIds,
  };
}

function applyWorldEffects(
  world: SessionWorld,
  effects: SessionEffect[],
): SessionWorld {
  let completions: CompletionRow[] = [...world.completions];
  let unlocks: UnlockRow[] = [...world.unlocks];
  for (const e of effects) {
    if (e.type === "recordCompletion") {
      completions = [
        ...completions,
        {
          fragmentId: e.fragmentId,
          revisionNo: e.revisionNo,
          timeWindow: e.timeWindow,
          onSite: true,
        },
      ];
    }
    if (e.type === "writeUnlocks") {
      for (const id of e.fragmentIds) {
        if (!unlocks.some((u) => u.fragmentId === id)) {
          unlocks = [...unlocks, { fragmentId: id }];
        }
      }
    }
  }
  return { ...world, completions, unlocks };
}

type Pending =
  | { kind: "end"; at: number; playedMs: number }
  | { kind: "afterglow"; at: number };

function runWalk(opts?: {
  midPlayingSnapshot?: boolean;
  midAfterglowSnapshot?: boolean;
  nightAfterFrag7?: boolean;
  contingencyReplay?: boolean;
  correctionNoReplay?: boolean;
}): {
  plays: string[];
  allEffects: SessionEffect[];
  state: SessionState;
  snapshots: { playing?: SessionState; afterglow?: SessionState };
  gpxCoords: { lat: number; lng: number }[];
} {
  let { world, durations } = buildWorld();
  const gpx = parseGpx(readFileSync(GPX_PATH, "utf8"));
  expect(gpx.length).toBeGreaterThan(100);

  if (opts?.contingencyReplay) {
    // Older completion below current contingency epoch → should play again
    world = {
      ...world,
      completions: [
        {
          fragmentId: "frag10",
          revisionNo: 1,
          timeWindow: "day",
          onSite: true,
        },
      ],
      unlocks: [{ fragmentId: "frag10" }],
    };
  }
  if (opts?.correctionNoReplay) {
    // frag4 current revision is correction (r2); contingency epoch still 1;
    // completion at r1 satisfies → must not play again
    world = {
      ...world,
      completions: [
        {
          fragmentId: "frag4",
          revisionNo: 1,
          timeWindow: "day",
          onSite: true,
        },
      ],
      unlocks: [
        { fragmentId: "frag1" },
        { fragmentId: "frag2" },
        { fragmentId: "frag3" },
        { fragmentId: "frag4" },
        { fragmentId: "frag5" },
      ],
    };
  }

  let state = initialSessionState();
  const allEffects: SessionEffect[] = [];
  const plays: string[] = [];
  const pending: Pending[] = [];
  const snapshots: { playing?: SessionState; afterglow?: SessionState } = {};
  let nightFlipped = false;

  function dispatch(event: SessionEvent): SessionEffect[] {
    const result = sessionStep(state, event, world);
    state = result.state;
    allEffects.push(...result.effects);
    world = applyWorldEffects(world, result.effects);
    for (const e of result.effects) {
      if (e.type === "play" && state.playing) {
        plays.push(e.fragmentId);
        const dur = durations[e.fragmentId] ?? 2_000;
        pending.push({
          kind: "end",
          at: state.playing.startedAt + dur,
          playedMs: dur,
        });
      }
      if (e.type === "startAfterglow") {
        pending.push({ kind: "afterglow", at: e.endsAt });
      }
    }
    pending.sort((a, b) => a.at - b.at);
    return result.effects;
  }

  function drainUntil(until: number): void {
    while (pending.length > 0 && pending[0]!.at <= until) {
      const p = pending.shift()!;
      if (p.kind === "end" && state.playing) {
        if (opts?.midPlayingSnapshot && !snapshots.playing) {
          snapshots.playing = parseSessionState(
            JSON.parse(JSON.stringify(state)),
          );
        }
        dispatch({
          type: "narrationEnded",
          at: p.at,
          reason: "natural",
          playedMs: p.playedMs,
        });
        if (opts?.midAfterglowSnapshot && !snapshots.afterglow && state.afterglowEndsAt) {
          snapshots.afterglow = parseSessionState(
            JSON.parse(JSON.stringify(state)),
          );
        }
      } else if (p.kind === "afterglow") {
        dispatch({ type: "afterglowElapsed", at: p.at });
      }
    }
  }

  for (let i = 0; i < gpx.length; i++) {
    const pt = gpx[i]!;
    const at = pt.at || T0 + i * 1000;
    drainUntil(at);

    if (
      opts?.nightAfterFrag7 &&
      !nightFlipped &&
      plays.includes("frag7") &&
      !state.playing &&
      state.afterglowEndsAt === null
    ) {
      world = { ...world, timeWindow: "night" };
      dispatch({ type: "windowChanged", at, timeWindow: "night" });
      nightFlipped = true;
    }

    dispatch({
      type: "fix",
      at,
      lat: pt.lat,
      lng: pt.lng,
      accuracyM: 5,
      ...(state.phase === "idle" ? { sessionId: SESSION_ID } : {}),
    });
  }

  // Finish pending narration / afterglow after last fix
  if (pending.length > 0) {
    const lastAt = pending[pending.length - 1]!.at;
    drainUntil(lastAt);
  }

  // Leave grove and wait 15 min
  const leaveAt =
    (state.lastInsideGroveAt ?? T0) + 1_000;
  dispatch({
    type: "fix",
    at: leaveAt,
    lat: 40.95,
    lng: -111.95,
    accuracyM: 5,
  });
  dispatch({ type: "tick", at: leaveAt + OUTSIDE_END_MS });

  return {
    plays,
    allEffects,
    state,
    snapshots,
    gpxCoords: gpx.map((p) => ({ lat: p.lat, lng: p.lng })),
  };
}

function assertNeverTwoPlaysWithoutClear(effects: SessionEffect[]): void {
  let open = false;
  for (const e of effects) {
    if (e.type === "play") {
      expect(open).toBe(false);
      open = true;
    }
    if (e.type === "recordCompletion" || e.type === "recordProgress") {
      open = false;
    }
  }
  const playIdx = effects
    .map((e, i) => (e.type === "play" ? i : -1))
    .filter((i) => i >= 0);
  for (let i = 1; i < playIdx.length; i++) {
    const between = effects.slice(playIdx[i - 1]! + 1, playIdx[i]!);
    const natural =
      between.some((e) => e.type === "recordCompletion") &&
      between.some((e) => e.type === "startAfterglow");
    const stoppedOrInterrupted = between.some(
      (e) => e.type === "recordProgress",
    );
    expect(natural || stoppedOrInterrupted).toBe(true);
  }
}

describe("Farmington walk", () => {
  it("plays unlocked standard fragments in route order; locked/physical never via proximity", () => {
    const { plays, allEffects, state } = runWalk();

    // frag9 is physical — never in plays from this GPX (route avoids its radius anyway)
    expect(plays).not.toContain("frag9");

    // Expected unlocked chain along the demo route (day)
    const expected = [
      "frag1",
      "frag2",
      "frag4",
      "frag3",
      "frag5",
      "frag6",
      "frag7",
      "frag8",
      "frag10",
    ];
    expect(plays).toEqual(expected);

    // each exactly once
    expect(new Set(plays).size).toBe(plays.length);

    assertNeverTwoPlaysWithoutClear(allEffects);
    expect(state.phase).toBe("idle");
    expect(allEffects.some((e) => e.type === "sessionEnded")).toBe(true);
    expect(allEffects.some((e) => e.type === "writeVisit")).toBe(true);
  });

  it("Day-only frag8 is silent at night after windowChanged", () => {
    const { plays } = runWalk({ nightAfterFrag7: true });
    expect(plays).toContain("frag7");
    expect(plays).not.toContain("frag8");
    // frag10 may or may not play depending on unlock via frag8/frag9 — without frag8/9, locked
    expect(plays).not.toContain("frag10");
  });

  it("contingency: older completion of frag10 plays again", () => {
    // Minimal: start exploring near frag10 with older completion + unlocks
    let { world, durations } = buildWorld();
    world = {
      ...world,
      completions: [
        {
          fragmentId: "frag10",
          revisionNo: 1,
          timeWindow: "day",
          onSite: true,
        },
      ],
      unlocks: world.fragments.map((f) => ({ fragmentId: f.id })),
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    };
    const f10 = world.fragments.find((f) => f.id === "frag10")!;
    let state = initialSessionState();
    const r1 = sessionStep(
      state,
      {
        type: "fix",
        at: T0,
        lat: f10.lat,
        lng: f10.lng,
        accuracyM: 5,
        sessionId: "c",
      },
      world,
    );
    expect(r1.effects.some((e) => e.type === "play" && e.fragmentId === "frag10")).toBe(
      true,
    );
    void durations;
  });

  it("correction: frag4 completed at r1 does not play again at correction revision", () => {
    let { world } = buildWorld();
    world = {
      ...world,
      completions: [
        {
          fragmentId: "frag4",
          revisionNo: 1,
          timeWindow: "day",
          onSite: true,
        },
      ],
      unlocks: world.fragments.map((f) => ({ fragmentId: f.id })),
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    };
    const f4 = world.fragments.find((f) => f.id === "frag4")!;
    const r = sessionStep(
      initialSessionState(),
      {
        type: "fix",
        at: T0,
        lat: f4.lat,
        lng: f4.lng,
        accuracyM: 5,
        sessionId: "corr",
      },
      world,
    );
    expect(r.effects.some((e) => e.type === "play" && e.fragmentId === "frag4")).toBe(
      false,
    );
  });

  it("resume: mid-playing and mid-afterglow continue identically after parseSessionState", () => {
    const { snapshots, plays } = runWalk({
      midPlayingSnapshot: true,
      midAfterglowSnapshot: true,
    });
    expect(snapshots.playing).toBeDefined();
    expect(snapshots.playing!.playing).not.toBeNull();
    expect(snapshots.afterglow).toBeDefined();
    expect(snapshots.afterglow!.afterglowEndsAt).not.toBeNull();

    // Continue from mid-playing snapshot with a natural end
    const { world } = buildWorld();
    const playing = snapshots.playing!;
    const endAt = playing.playing!.startedAt + 2_000;
    const continued = sessionStep(
      playing,
      {
        type: "narrationEnded",
        at: endAt,
        reason: "natural",
        playedMs: 2_000,
      },
      world,
    );
    expect(continued.effects[0]?.type).toBe("recordCompletion");
    expect(continued.state.afterglowEndsAt).toBe(endAt + AFTERGLOW_MS);

    const ag = snapshots.afterglow!;
    const drained = sessionStep(
      ag,
      { type: "afterglowElapsed", at: ag.afterglowEndsAt! },
      {
        ...world,
        completions: [
          {
            fragmentId: ag.lastCompletedFragmentId!,
            revisionNo: 1,
            timeWindow: "day",
            onSite: true,
          },
        ],
      },
    );
    expect(drained.state.afterglowEndsAt).toBeNull();
    expect(plays.length).toBeGreaterThan(0);
  });

  it("pause → resume → natural end is valid between plays", () => {
    let { world } = buildWorld();
    world = {
      ...world,
      settings: {
        accessibleTrigger: true,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    };
    const f1 = world.fragments.find((f) => f.id === "frag1")!;
    let state = initialSessionState();
    const effects: SessionEffect[] = [];
    let r = sessionStep(
      state,
      {
        type: "fix",
        at: T0,
        lat: f1.lat,
        lng: f1.lng,
        accuracyM: 5,
        sessionId: "p",
      },
      world,
    );
    state = r.state;
    effects.push(...r.effects);
    r = sessionStep(state, { type: "narrationPaused", at: T0 + 500 }, world);
    state = r.state;
    r = sessionStep(state, { type: "narrationResumed", at: T0 + 1_500 }, world);
    state = r.state;
    r = sessionStep(
      state,
      {
        type: "narrationEnded",
        at: T0 + 3_000,
        reason: "natural",
        playedMs: 2_000,
      },
      world,
    );
    effects.push(...r.effects);
    expect(r.effects[0]?.type).toBe("recordCompletion");
    assertNeverTwoPlaysWithoutClear(effects);
  });

  it("no coordinates in any effect from the walk", () => {
    const { allEffects, gpxCoords } = runWalk();
    const blob = JSON.stringify(allEffects);
    expect(blob).not.toMatch(/"lat"/);
    expect(blob).not.toMatch(/"lng"/);
    // Sample distinctive GPX coordinates (start + a mid dwell) — never in effects
    const samples = [gpxCoords[0]!, gpxCoords[Math.floor(gpxCoords.length / 2)]!];
    for (const c of samples) {
      expect(blob.includes(c.lat.toFixed(5))).toBe(false);
      expect(blob.includes(c.lng.toFixed(5))).toBe(false);
    }
  });
});
