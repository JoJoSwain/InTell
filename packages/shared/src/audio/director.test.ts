import { describe, expect, it } from "vitest";
import { AFTERGLOW_MS } from "./DuckingPolicy";
import {
  DIRECTOR_ACCENT_LOOKAHEAD_SEC,
  DIRECTOR_ACCENT_MAX_PENDING,
  directorStep,
  diffMix,
  emptyTargetMix,
  initialDirectorState,
  parseDirectorState,
  serializeDirectorState,
  type DirectorWorld,
} from "./director";
import type { AmbienceProfileInput, AmbienceZoneInput } from "./ambience";

const T0 = Date.parse("2026-06-15T17:00:00.000Z");

const zone: AmbienceZoneInput = {
  id: "z1",
  boundary: {
    type: "Polygon",
    coordinates: [
      [
        [-111.94, 40.95],
        [-111.91, 40.95],
        [-111.91, 40.97],
        [-111.94, 40.97],
        [-111.94, 40.95],
      ],
    ],
  },
  profileSlug: "marsh",
  priority: 100,
  edgeFadeM: 40,
};

const profiles: AmbienceProfileInput[] = [
  {
    slug: "marsh",
    density: 1,
    layers: [
      {
        id: "bed-day",
        kind: "bed",
        timeWindow: "day",
        months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        wildlifeCall: false,
        nestingMuteMonths: [],
        speakerSafe: true,
        gainDbMin: -12,
        gainDbMax: -8,
        panMin: 0,
        panMax: 0,
        pitchCentsMin: 0,
        pitchCentsMax: 0,
        noRepeatLast: 1,
        crossfadeMs: 2000,
        assets: [{ sha: "bed-sha", weight: 1 }],
      },
      {
        id: "accent-day",
        kind: "oneshot",
        timeWindow: "day",
        months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        wildlifeCall: false,
        nestingMuteMonths: [],
        speakerSafe: true,
        gainDbMin: -18,
        gainDbMax: -12,
        panMin: -1,
        panMax: 1,
        pitchCentsMin: 0,
        pitchCentsMax: 0,
        noRepeatLast: 1,
        crossfadeMs: 0,
        meanIntervalS: 5,
        minIntervalS: 1,
        maxConcurrent: 1,
        assets: [{ sha: "accent-sha", weight: 1 }],
      },
    ],
  },
];

function world(): DirectorWorld {
  return {
    groveId: "grove-1",
    timeZone: "America/Denver",
    allowsSpeakerWildlife: false,
    hushIntervalMin: 7,
    depthBloomTextureM: 15,
    fragments: [
      {
        id: "frag-root",
        lat: 40.961,
        lng: -111.929,
        radiusM: 12,
        tier: "root",
        visibility: "standard",
        title: "Root",
        beaconSha: "beacon-sha",
        resolveSha: "resolve-sha",
        breathPointsMs: [1000, 4000],
        narrationShaByWindow: { day: "narr-day-sha" },
      },
      {
        id: "frag-locked",
        lat: 40.962,
        lng: -111.928,
        radiusM: 12,
        tier: "branch",
        visibility: "locked",
        title: "Locked",
        teaserLockedSha: "teaser-sha",
      },
    ],
    musicCues: [
      {
        id: "cue-day",
        timeWindow: "day",
        priority: 50,
        conditions: {},
        minDwellS: 0,
        crossfadeMs: 1000,
        boundary: zone.boundary,
        edgeFadeM: 60,
        stems: [
          { assetSha: "stem-a", gainDb: 0, stateGains: [] },
          { assetSha: "stem-b", gainDb: -3, stateGains: [] },
        ],
        resolveRootSha: "resolve-root-sha",
      },
      {
        id: "cue-growth",
        timeWindow: "day",
        priority: 90,
        conditions: { heardAll: ["frag-root"] },
        minDwellS: 0,
        crossfadeMs: 1000,
        boundary: zone.boundary,
        edgeFadeM: 60,
        stems: [{ assetSha: "stem-g", gainDb: 0, stateGains: [] }],
      },
    ],
    ambienceZones: [zone],
    ambienceProfiles: profiles,
    classToProfile: new Map([["90", "marsh"]]),
    landcoverCells: ["90"],
    motifDaySha: "motif-sha",
    motifNightSha: null,
    groveBeaconByTier: { root: "beacon-sha" },
    hushListenSha: "listen-sha",
    engineCaps: { canStreamBeds: false, narrationDecodeHz: 24_000 },
  };
}

function boot() {
  const w = world();
  let state = initialDirectorState({
    seed: 7,
    wallAtMs: T0,
    dayKey: "2026-06-15",
    point: { lat: 40.961, lng: -111.929 },
  });
  const loc = directorStep(
    state,
    {
      type: "location",
      point: { lat: 40.961, lng: -111.929 },
      courseDeg: 90,
      depthM: 12,
      month: 6,
      timeWindow: "day",
      insideGrove: true,
      audioSec: 0,
      wallAtMs: T0,
    },
    w,
  );
  state = loc.state;
  const hb = directorStep(
    state,
    { type: "heartbeat", audioSec: 0, wallAtMs: T0 },
    w,
  );
  return { state: hb.state, world: w, commands: hb.commands };
}

describe("director constants", () => {
  it("uses distinct accent horizon names", () => {
    expect(DIRECTOR_ACCENT_LOOKAHEAD_SEC).toBe(20);
    expect(DIRECTOR_ACCENT_MAX_PENDING).toBe(2);
  });
});

describe("diffMix suspended policy", () => {
  it("emits no play/start/load while suspended; allows unload/stop", () => {
    const prev = emptyTargetMix();
    prev.desiredLoaded = ["a", "b"];
    prev.narration = {
      id: "n1",
      sha: "a",
      meta: { title: "t", artist: "r" },
    };
    const next = emptyTargetMix();
    next.suspended = true;
    next.desiredLoaded = ["a"];
    next.narration = null;
    const cmds = diffMix(prev, next);
    expect(cmds.some((c) => c.type === "suspend")).toBe(true);
    expect(cmds.some((c) => c.type === "unload" && c.sha === "b")).toBe(true);
    expect(cmds.some((c) => c.type === "stop")).toBe(true);
    expect(cmds.some((c) => c.type === "load")).toBe(false);
    expect(cmds.some((c) => c.type === "playNarration")).toBe(false);
    expect(cmds.some((c) => c.type === "startLoopGroup")).toBe(false);
  });
});

describe("directorStep", () => {
  it("ducks music under narration and holds afterglow", () => {
    const { state: s0, world: w } = boot();
    let { state } = directorStep(
      s0,
      {
        type: "sessionEffect",
        effect: {
          type: "play",
          fragmentId: "frag-root",
          revisionNo: 1,
          sha: "narr-day-sha",
          breathPointsMs: [1000],
        },
        audioSec: 1,
        wallAtMs: T0 + 1000,
      },
      w,
    );
    expect(state.lastEmitted.busDb.music).toBeLessThan(-8);

    ({ state } = directorStep(
      state,
      {
        type: "sessionEffect",
        effect: {
          type: "startAfterglow",
          endsAt: T0 + 1000 + AFTERGLOW_MS,
          fragmentId: "frag-root",
          tier: "root",
        },
        audioSec: 2,
        wallAtMs: T0 + 2000,
      },
      w,
    ));
    expect(state.afterglowEndsAtMs).toBe(T0 + 1000 + AFTERGLOW_MS);
    expect(state.resolvePlay?.sha ?? state.lastEmitted.moment?.sha).toBeTruthy();
    expect(state.pendingGrowthCueId).toBe("cue-growth");
  });

  it("plays motif once on groveEntered at depth", () => {
    const { state: s0, world: w } = boot();
    const first = directorStep(
      s0,
      {
        type: "sessionEffect",
        effect: { type: "groveEntered", groveId: "grove-1" },
        audioSec: 1,
        wallAtMs: T0 + 1000,
      },
      w,
    );
    const sha =
      first.commands.find((c) => c.type === "playMoment")?.type === "playMoment"
        ? (
            first.commands.find((c) => c.type === "playMoment") as {
              sha: string;
            }
          ).sha
        : first.state.motifPlay?.sha;
    expect(sha).toBe("motif-sha");

    const second = directorStep(
      first.state,
      {
        type: "sessionEffect",
        effect: { type: "groveEntered", groveId: "grove-1" },
        audioSec: 2,
        wallAtMs: T0 + 2000,
      },
      w,
    );
    expect(second.state.motif.played).toBe(true);
    expect(
      second.commands.filter((c) => c.type === "playMoment"),
    ).toHaveLength(0);
  });

  it("interruption began suspends; ended without shouldResume is a no-op", () => {
    const { state: s0, world: w } = boot();
    let { state, commands } = directorStep(
      s0,
      {
        type: "interruption",
        phase: "began",
        audioSec: 1,
        wallAtMs: T0 + 1000,
      },
      w,
    );
    expect(state.suspended).toBe(true);
    expect(commands.some((c) => c.type === "suspend")).toBe(true);
    expect(
      commands.some(
        (c) =>
          c.type === "load" ||
          c.type === "playNarration" ||
          c.type === "startLoopGroup",
      ),
    ).toBe(false);

    ({ state, commands } = directorStep(
      state,
      {
        type: "interruption",
        phase: "ended",
        audioSec: 2,
        wallAtMs: T0 + 2000,
      },
      w,
    ));
    expect(state.suspended).toBe(true);
    expect(commands.some((c) => c.type === "resume")).toBe(false);

    ({ state, commands } = directorStep(
      state,
      {
        type: "interruption",
        phase: "ended",
        shouldResume: true,
        audioSec: 3,
        wallAtMs: T0 + 3000,
      },
      w,
    ));
    expect(state.suspended).toBe(false);
    expect(commands.some((c) => c.type === "resume")).toBe(true);
  });

  it("assetFailed marks sha unusable and continues", () => {
    const { state: s0, world: w } = boot();
    const { state } = directorStep(
      s0,
      { type: "assetFailed", sha: "bed-sha", audioSec: 1, wallAtMs: T0 + 1000 },
      w,
    );
    expect(state.failedShas).toContain("bed-sha");
    expect(
      Object.values(state.bedByLayerId).some((b) => b.sha === "bed-sha"),
    ).toBe(false);
  });

  it("serialize / parse resumes identically mid-afterglow", () => {
    const { state: s0, world: w } = boot();
    let { state } = directorStep(
      s0,
      {
        type: "sessionEffect",
        effect: {
          type: "startAfterglow",
          endsAt: T0 + AFTERGLOW_MS,
          fragmentId: "frag-root",
          tier: "root",
        },
        audioSec: 1,
        wallAtMs: T0 + 1000,
      },
      w,
    );
    const raw = serializeDirectorState(state);
    const restored = parseDirectorState(raw);
    expect(restored.afterglowEndsAtMs).toBe(state.afterglowEndsAtMs);
    expect(restored.v).toBe(1);

    const a = directorStep(
      state,
      { type: "heartbeat", audioSec: 2, wallAtMs: T0 + 2000 },
      w,
    );
    const b = directorStep(
      restored,
      { type: "heartbeat", audioSec: 2, wallAtMs: T0 + 2000 },
      w,
    );
    expect(a.commands).toEqual(b.commands);
  });

  it("is deterministic for the same seed and inputs", () => {
    const run = () => {
      const { state: s0, world: w } = boot();
      const steps = [];
      let state = s0;
      for (let i = 1; i <= 5; i++) {
        const r = directorStep(
          state,
          {
            type: "heartbeat",
            audioSec: i * 5,
            wallAtMs: T0 + i * 5000,
          },
          w,
        );
        state = r.state;
        steps.push(r.commands);
      }
      return steps;
    };
    expect(run()).toEqual(run());
  });

  it("chooses one beacon and updates pan", () => {
    const { state: s0 } = boot();
    expect(s0.currentBeaconId).toBe("frag-root");
    expect(s0.lastEmitted.beacon?.sha).toBe("beacon-sha");
    expect(Number.isFinite(s0.lastEmitted.beacon?.pan)).toBe(true);
  });
});

