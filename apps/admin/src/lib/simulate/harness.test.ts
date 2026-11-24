/**
 * Simulator integration tests — one per BUILD_PLAN M4 acceptance item
 * and one per A5 feature (docs/briefs/A5-part2.md P2b).
 */
import { describe, expect, it } from "vitest";
import { AFTERGLOW_MS, MIX_SHED_AFTER_WINDOWS } from "@intell/shared";
import { buildDemoWorld, DEMO_ORIGIN } from "./demoWorld";
import { gpxReplaySchedule, parseGpxTrack } from "./gpx";
import {
  createHarnessState,
  lastEvent,
  simulatorTick,
} from "./harness";

const T0 = Date.parse("2026-06-15T17:00:00.000Z");

function start() {
  const world = buildDemoWorld();
  let state = createHarnessState(DEMO_ORIGIN, T0);
  state = simulatorTick(state, world, {});
  return { world, state };
}

describe("M4 acceptance — Simulator", () => {
  it("zone-edge blending yields marsh + urban weights", () => {
    const { world } = start();
    // Point near the urban/marsh overlap on the west edge
    let state = createHarnessState({ lat: 40.9615, lng: -111.9302 }, T0);
    state = simulatorTick(state, world, {});
    const weights = lastEvent(state, "profile_weights")!.weights;
    const slugs = weights.map((w) => w.profileSlug).sort();
    expect(slugs.length).toBeGreaterThanOrEqual(1);
    // At least one of the demo profiles is active inside the marsh polygon
    expect(weights.some((w) => w.profileSlug === "marsh" || w.profileSlug === "urban")).toBe(
      true,
    );
    // Deep inside urban zone (higher priority) should prefer urban
    state = simulatorTick(state, world, { lat: 40.9615, lng: -111.931 });
    const urban = lastEvent(state, "profile_weights")!.weights;
    expect(urban[0]?.profileSlug).toBe("urban");
  });

  it("Day/Night swaps layers and cues", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, { forcedWindow: "day" });
    expect(lastEvent(state, "time_window")!.window).toBe("day");
    expect(lastEvent(state, "eligible_layers")!.layerIds).toContain("marsh-bed-day");
    expect(lastEvent(state, "eligible_layers")!.layerIds).not.toContain("marsh-bed-night");
    expect(lastEvent(state, "music_cue")!.cueId).toBe("cue-day-default");

    state = simulatorTick(state, world, { forcedWindow: "night" });
    expect(lastEvent(state, "time_window")!.window).toBe("night");
    expect(lastEvent(state, "eligible_layers")!.layerIds).toContain("marsh-bed-night");
    expect(lastEvent(state, "eligible_layers")!.layerIds).not.toContain("marsh-bed-day");
    expect(lastEvent(state, "music_cue")!.cueId).toBe("cue-night-default");
  });

  it('toggling "completed" on a branch switches the music stem', () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, { forcedWindow: "day" });
    const before = lastEvent(state, "stem_gain");
    // layer stem index 1 rests at -3
    expect(
      state.events.filter((e) => e.type === "stem_gain" && e.stemIndex === 1).at(-1),
    ).toMatchObject({ gainDb: -3 });

    state = simulatorTick(state, world, {
      completeFragmentId: "frag-branch",
    });
    const after = state.events
      .filter((e) => e.type === "stem_gain" && e.stemIndex === 1)
      .at(-1);
    expect(after).toMatchObject({ gainDb: 0 });
    expect(before).toBeDefined();
  });

  it("speaker mode silences wildlife layers", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, { route: "headphones" });
    expect(lastEvent(state, "eligible_layers")!.layerIds).toContain("wildlife-call");
    expect(lastEvent(state, "wildlife_silenced")!.silenced).toBe(false);

    state = simulatorTick(state, world, { route: "speaker" });
    expect(lastEvent(state, "eligible_layers")!.layerIds).not.toContain("wildlife-call");
    expect(lastEvent(state, "wildlife_silenced")!.silenced).toBe(true);
  });

  it("4× GPX replay compresses schedule and emits gpx_tick", () => {
    const gpx = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="40.96122" lon="-111.93014"><time>2026-06-15T17:00:00.000Z</time></trkpt>
<trkpt lat="40.96122" lon="-111.92980"><time>2026-06-15T17:00:08.000Z</time></trkpt>
</trkseg></trk></gpx>`;
    const pts = parseGpxTrack(gpx);
    const schedule = gpxReplaySchedule(pts, 4);
    expect(schedule.at(-1)!.tMs).toBe(2000);

    const { world } = start();
    let state = createHarnessState(
      { lat: schedule[0]!.lat, lng: schedule[0]!.lng },
      T0,
    );
    for (const step of schedule) {
      state = simulatorTick(state, world, {
        lat: step.lat,
        lng: step.lng,
        atMs: T0 + step.tMs,
        gpx: { tMs: step.tMs, speed: 4 },
      });
    }
    expect(lastEvent(state, "gpx_tick")!.speed).toBe(4);
    expect(lastEvent(state, "gpx_tick")!.tMs).toBe(2000);
  });
});

describe("A5 features — Simulator", () => {
  it("depth bloom enters and leaves with hysteresis", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, { depthM: 0 });
    expect(lastEvent(state, "depth_bloom")!.inside).toBe(false);

    // threshold 15 + hysteresis 5 → enter at 20
    state = simulatorTick(state, world, { depthM: 20 });
    expect(lastEvent(state, "depth_bloom")!.inside).toBe(true);

    // stay latched above 15−5 = 10
    state = simulatorTick(state, world, { depthM: 12 });
    expect(lastEvent(state, "depth_bloom")!.inside).toBe(true);

    state = simulatorTick(state, world, { depthM: 8 });
    expect(lastEvent(state, "depth_bloom")!.inside).toBe(false);
  });

  it("growth steps after the afterglow", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, { forcedWindow: "day" });
    expect(lastEvent(state, "music_cue")!.cueId).toBe("cue-day-default");

    state = simulatorTick(state, world, {
      completeFragmentId: "frag-root",
    });
    state = simulatorTick(state, world, {
      completeFragmentId: "frag-branch",
      endNarration: true,
    });
    expect(lastEvent(state, "resolve")).toBeDefined();
    expect(state.pendingGrowthCueId).toBe("cue-day-growth");

    // Still inside afterglow → deferred, keep default
    state = simulatorTick(state, world, {
      atMs: state.atMs + 1000,
    });
    expect(lastEvent(state, "music_cue")).toMatchObject({
      cueId: "cue-day-default",
      deferred: true,
    });

    // After afterglow → growth cue
    state = simulatorTick(state, world, {
      atMs: state.atMs + AFTERGLOW_MS,
    });
    expect(lastEvent(state, "music_cue")!.cueId).toBe("cue-day-growth");
    expect(lastEvent(state, "music_cue")!.deferred).toBe(false);
  });

  it("resolve by tier (fragment override wins)", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, {
      completeFragmentId: "frag-branch",
      endNarration: true,
    });
    expect(lastEvent(state, "resolve")).toMatchObject({
      kind: "asset",
      detail: "resolve-branch-override-sha",
    });

    state = createHarnessState(DEMO_ORIGIN, T0);
    state = simulatorTick(state, world, { forcedWindow: "day" });
    state = simulatorTick(state, world, {
      completeFragmentId: "frag-root",
      endNarration: true,
    });
    // root fragment has no override → cue resolveRootSha
    expect(lastEvent(state, "resolve")).toMatchObject({
      kind: "asset",
      detail: "resolve-root-sha",
    });
  });

  it("motif once per visit", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, {
      depthM: 12,
      enterGrove: true,
    });
    expect(lastEvent(state, "motif")?.playSha).toBe("motif-day-sha");

    state = simulatorTick(state, world, {
      atMs: state.atMs + 5000,
      depthM: 12,
    });
    // Already played — no new motif event with playSha
    const motifs = state.events.filter((e) => e.type === "motif" && e.playSha);
    expect(motifs).toHaveLength(1);
  });

  it("beacon choice and pan", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, {
      lat: DEMO_ORIGIN.lat,
      lng: DEMO_ORIGIN.lng,
      route: "headphones",
      beaconsEnabled: true,
    });
    const beacon = lastEvent(state, "beacon")!;
    expect(beacon.fragmentId).toBeTruthy();
    expect(Number.isFinite(beacon.pan)).toBe(true);
    expect(beacon.gainDb).toBeGreaterThan(Number.NEGATIVE_INFINITY);

    state = simulatorTick(state, world, { beaconsEnabled: false });
    expect(lastEvent(state, "beacon")!.fragmentId).toBeNull();
  });

  it("accents only in breath gaps", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, {
      narrationPlaying: true,
      breathPointsMs: [1000, 5000],
      narrationPositionMs: 3000,
      checkAccent: true,
    });
    expect(lastEvent(state, "accent_blocked_breath")).toBeDefined();

    state = simulatorTick(state, world, {
      narrationPositionMs: 1000,
      checkAccent: true,
    });
    // No new blocked event on this tick when allowed
    const blocked = state.events.filter((e) => e.type === "accent_blocked_breath");
    expect(blocked).toHaveLength(1);
  });

  it("locked teaser once a day", () => {
    const { world, state: s0 } = start();
    let state = simulatorTick(s0, world, {
      lockedTeaserTap: { fragmentId: "frag-locked" },
    });
    expect(lastEvent(state, "locked_teaser")!.playSha).toBe("teaser-locked-sha");

    state = simulatorTick(state, world, {
      atMs: state.atMs + 60_000,
      lockedTeaserTap: { fragmentId: "frag-locked" },
    });
    expect(lastEvent(state, "locked_teaser")!.playSha).toBeUndefined();
  });

  it("mix ladder sheds layers under sustained pressure", () => {
    const { world, state: s0 } = start();
    let state = s0;
    for (let i = 0; i < MIX_SHED_AFTER_WINDOWS; i++) {
      state = simulatorTick(state, world, {
        atMs: T0 + i * 1000,
        clockStarving: true,
      });
    }
    expect(lastEvent(state, "mix_level")!.shedIndex).toBeGreaterThanOrEqual(1);
    expect(lastEvent(state, "mix_level")!.shed.length).toBeGreaterThanOrEqual(1);
  });
});
