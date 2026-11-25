import { describe, expect, it } from "vitest";
import { AFTERGLOW_MS } from "./DuckingPolicy";
import { resumePointMs } from "./breath";
import {
  directorStep,
  diffMix,
  emptyTargetMix,
  initialDirectorState,
  parseDirectorState,
  serializeDirectorState,
  type DirectorCommand,
  type DirectorState,
  type DirectorWorld,
} from "./director";
import type { AmbienceProfileInput, AmbienceZoneInput } from "./ambience";
import {
  HUSH_CUE_GAIN_DB,
  HUSH_FADE_OUT_MS,
  HUSH_TRIGGER_FADE_MS,
} from "./hush";
import {
  ONESHOT_LOOKAHEAD_SEC,
  ONESHOT_MAX_PENDING,
} from "./oneshotSchedule";
import {
  MIX_RECOVER_STEP_MS,
  MIX_SHED_AFTER_WINDOWS,
  MIX_SHED_ORDER,
  VOICE_BUDGET_TOTAL,
} from "./soundFeatures";
import { shedLayers } from "./mixHealth";

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

function world(overrides: Partial<DirectorWorld> = {}): DirectorWorld {
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
        resolveSha: undefined,
        breathPointsMs: [1000, 4000],
        narrationShaByWindow: { day: "narr-root-sha" },
      },
      {
        id: "frag-branch",
        lat: 40.9612,
        lng: -111.9285,
        radiusM: 12,
        tier: "branch",
        visibility: "standard",
        title: "Branch",
        beaconSha: "beacon-branch-sha",
        resolveSha: "resolve-branch-override-sha",
        narrationShaByWindow: { day: "narr-branch-sha" },
      },
      {
        id: "frag-leaf",
        lat: 40.9615,
        lng: -111.928,
        radiusM: 12,
        tier: "leaf",
        visibility: "standard",
        title: "Leaf",
        narrationShaByWindow: { day: "narr-leaf-sha" },
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
      {
        id: "frag-no-resolve",
        lat: 40.9605,
        lng: -111.9295,
        radiusM: 12,
        tier: "leaf",
        visibility: "standard",
        title: "No resolve",
        narrationShaByWindow: { day: "narr-none-sha" },
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
        resolveBranchSha: "resolve-branch-sha",
        resolveLeafSha: "resolve-leaf-sha",
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
      {
        id: "cue-day-b",
        timeWindow: "day",
        priority: 40,
        conditions: { heardAll: ["frag-leaf"] },
        minDwellS: 0,
        crossfadeMs: 2000,
        boundary: zone.boundary,
        edgeFadeM: 60,
        stems: [{ assetSha: "stem-b2", gainDb: 0, stateGains: [] }],
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
    ...overrides,
  };
}

function boot(opts?: {
  point?: { lat: number; lng: number };
  world?: DirectorWorld;
  seed?: number;
}) {
  const w = opts?.world ?? world();
  const point = opts?.point ?? { lat: 40.961, lng: -111.929 };
  let state = initialDirectorState({
    seed: opts?.seed ?? 7,
    wallAtMs: T0,
    dayKey: "2026-06-15",
    point,
  });
  state = directorStep(
    state,
    {
      type: "location",
      point,
      courseDeg: 90,
      depthM: 12,
      month: 6,
      timeWindow: "day",
      insideGrove: true,
      audioSec: 0,
      wallAtMs: T0,
    },
    w,
  ).state;
  const hb = directorStep(
    state,
    { type: "heartbeat", audioSec: 0, wallAtMs: T0 },
    w,
  );
  return { state: hb.state, world: w, commands: hb.commands };
}

function step(
  state: DirectorState,
  w: DirectorWorld,
  input: Parameters<typeof directorStep>[1],
) {
  return directorStep(state, input, w);
}

function momentSha(commands: DirectorCommand[], state: DirectorState): string | undefined {
  const cmd = commands.find((c) => c.type === "playMoment");
  if (cmd && cmd.type === "playMoment") return cmd.sha;
  return state.lastEmitted.moment?.sha ?? state.resolvePlay?.sha;
}

describe("director constants", () => {
  it("uses oneshotSchedule as the single accent-horizon source", () => {
    expect(ONESHOT_LOOKAHEAD_SEC).toBe(20);
    expect(ONESHOT_MAX_PENDING).toBe(2);
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

describe("1. afterglow resolve by tier", () => {
  it("plays the cue tier resolve; fragment override wins; missing → pause", () => {
    const { state: s0, world: w } = boot();

    // Root — cue resolveRootSha (no fragment override)
    let r = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + AFTERGLOW_MS,
        fragmentId: "frag-root",
        tier: "root",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(momentSha(r.commands, r.state)).toBe("resolve-root-sha");

    // Branch — fragment override
    r = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + AFTERGLOW_MS,
        fragmentId: "frag-branch",
        tier: "branch",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(momentSha(r.commands, r.state)).toBe("resolve-branch-override-sha");

    // Leaf — cue resolveLeafSha
    r = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + AFTERGLOW_MS,
        fragmentId: "frag-leaf",
        tier: "leaf",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(momentSha(r.commands, r.state)).toBe("resolve-leaf-sha");

    // No asset on cue without tier resolves — plain 8 s pause
    const wBare = world({
      musicCues: [
        {
          id: "cue-bare",
          timeWindow: "day",
          priority: 50,
          conditions: {},
          minDwellS: 0,
          crossfadeMs: 0,
          boundary: zone.boundary,
          edgeFadeM: 60,
          stems: [{ assetSha: "stem-a", gainDb: 0, stateGains: [] }],
        },
      ],
    });
    const bare = boot({ world: wBare });
    r = step(bare.state, wBare, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + AFTERGLOW_MS,
        fragmentId: "frag-no-resolve",
        tier: "leaf",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(r.commands.some((c) => c.type === "playMoment")).toBe(false);
    expect(r.state.resolvePlay).toBeNull();
    expect(r.state.afterglowEndsAtMs).toBe(T0 + AFTERGLOW_MS);
    expect(AFTERGLOW_MS).toBe(8000);
  });
});

describe("2. growth deferral", () => {
  it("switches to the growth cue only after afterglow ends", () => {
    const { state: s0, world: w } = boot();
    expect(s0.currentCueId).toBe("cue-day");

    let { state } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + AFTERGLOW_MS,
        fragmentId: "frag-root",
        tier: "root",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(state.pendingGrowthCueId).toBe("cue-growth");
    expect(state.currentCueId).toBe("cue-day");

    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));
    expect(state.currentCueId).toBe("cue-day");
    expect(state.pendingGrowthCueId).toBe("cue-growth");

    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: 10,
      wallAtMs: T0 + AFTERGLOW_MS + 1000,
    }));
    expect(state.currentCueId).toBe("cue-growth");
    expect(state.pendingGrowthCueId).toBeNull();
  });
});

describe("3. Hush", () => {
  it("schedules after the interval, plays Listen. on ui, cancels on play", () => {
    const { state: s0, world: w } = boot();
    // Arm next hush
    let { state } = step(s0, w, {
      type: "heartbeat",
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(state.hush.phase).toBe("idle");
    expect(state.hush.nextHushAt).not.toBeNull();
    const due = state.hush.nextHushAt!;

    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: (due - T0) / 1000,
      wallAtMs: due,
    }));
    expect(state.hush.phase).toBe("fadingOut");

    // Advance through fade-out into cue
    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: (due - T0) / 1000 + HUSH_FADE_OUT_MS / 1000,
      wallAtMs: due + HUSH_FADE_OUT_MS,
    }));
    expect(state.hush.phase).toBe("cue");
    expect(state.hushPlayCue || state.lastEmitted.hushCue).toBeTruthy();
    const listen = state.lastEmitted.hushCue;
    expect(listen?.sha).toBe("listen-sha");
    expect(listen?.gainDb).toBe(HUSH_CUE_GAIN_DB);

    // Cancel with play → 1 s trigger fade
    const cancelled = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
      },
      audioSec: state.audioClockSec + 0.1,
      wallAtMs: state.wallAtMs + 100,
    });
    expect(cancelled.state.hush.phase).toBe("fadingIn");
    expect(cancelled.state.hush.fadeInMs).toBe(HUSH_TRIGGER_FADE_MS);
  });
});

describe("4. accent gating", () => {
  it("schedules only in breath pauses; caps pending and horizon", () => {
    const { state: s0, world: w } = boot();
    let { state } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
        breathPointsMs: [1000, 4000],
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });

    // Mid-sentence — no accents
    ({ state } = step(state, w, {
      type: "narrationProgress",
      positionMs: 2500,
      durationMs: 10_000,
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));
    expect(state.pendingAccents).toHaveLength(0);
    expect(state.lastEmitted.accentsPending).toHaveLength(0);

    // At a breath point — may schedule
    ({ state } = step(state, w, {
      type: "narrationProgress",
      positionMs: 1000,
      durationMs: 10_000,
      audioSec: 3,
      wallAtMs: T0 + 3000,
    }));
    expect(state.pendingAccents.length).toBeLessThanOrEqual(
      ONESHOT_MAX_PENDING,
    );
    for (const a of state.pendingAccents) {
      expect(a.whenSec).toBeGreaterThan(state.audioClockSec);
      expect(a.whenSec).toBeLessThanOrEqual(
        state.audioClockSec + ONESHOT_LOOKAHEAD_SEC,
      );
    }

    // Without narration, horizon still respects caps
    ({ state } = step(state, w, {
      type: "sessionEffect",
      effect: { type: "stopNarration" },
      audioSec: 4,
      wallAtMs: T0 + 4000,
    }));
    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: 5,
      wallAtMs: T0 + 5000,
    }));
    expect(state.pendingAccents.length).toBeLessThanOrEqual(
      ONESHOT_MAX_PENDING,
    );
    for (const a of state.pendingAccents) {
      expect(a.whenSec - state.audioClockSec).toBeLessThanOrEqual(
        ONESHOT_LOOKAHEAD_SEC,
      );
    }
  });
});

describe("5. locked teaser", () => {
  it("plays once per fragment per day; never over narration; never wrongTime", () => {
    const { state: s0, world: w } = boot();

    // Over narration — no play
    let { state, commands } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    ({ state, commands } = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "showTeaser",
        fragmentId: "frag-locked",
        reason: "locked",
      },
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));
    expect(
      commands.some((c) => c.type === "playOneShot" && c.bus === "story"),
    ).toBe(false);

    ({ state } = step(state, w, {
      type: "sessionEffect",
      effect: { type: "stopNarration" },
      audioSec: 3,
      wallAtMs: T0 + 3000,
    }));

    // wrongTime — never
    ({ state, commands } = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "showTeaser",
        fragmentId: "frag-locked",
        reason: "wrongTime",
      },
      audioSec: 4,
      wallAtMs: T0 + 4000,
    }));
    expect(
      commands.some((c) => c.type === "playOneShot" && c.bus === "story"),
    ).toBe(false);

    // locked once
    ({ state, commands } = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "showTeaser",
        fragmentId: "frag-locked",
        reason: "locked",
      },
      audioSec: 5,
      wallAtMs: T0 + 5000,
    }));
    const first = commands.find(
      (c) => c.type === "playOneShot" && c.bus === "story",
    );
    expect(first).toMatchObject({ type: "playOneShot", sha: "teaser-sha" });

    ({ state, commands } = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "showTeaser",
        fragmentId: "frag-locked",
        reason: "locked",
      },
      audioSec: 6,
      wallAtMs: T0 + 6000,
    }));
    expect(
      commands.some((c) => c.type === "playOneShot" && c.bus === "story"),
    ).toBe(false);
  });
});

describe("6. beacon lifecycle", () => {
  it("starts, updates on move, stops for narration / setting / speaker", () => {
    const { state: s0, world: w, commands: bootCmds } = boot();
    expect(
      bootCmds.some((c) => c.type === "startBeacon") ||
        s0.lastEmitted.beacon != null,
    ).toBe(true);
    expect(s0.lastEmitted.beacon?.fragmentId).toBe("frag-root");
    const pan0 = s0.lastEmitted.beacon!.pan;
    const gain0 = s0.lastEmitted.beacon!.gainDb;

    // Move toward branch — updateBeacon
    let { state, commands } = step(s0, w, {
      type: "location",
      point: { lat: 40.9612, lng: -111.9285 },
      courseDeg: 45,
      depthM: 5,
      month: 6,
      timeWindow: "day",
      insideGrove: true,
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    const beacon = state.lastEmitted.beacon;
    expect(beacon).toBeTruthy();
    if (
      beacon &&
      (Math.abs(beacon.pan - pan0) > 0.01 || Math.abs(beacon.gainDb - gain0) > 0.1)
    ) {
      expect(
        commands.some((c) => c.type === "updateBeacon" || c.type === "startBeacon"),
      ).toBe(true);
    }

    // Narration stops beacon
    ({ state, commands } = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
      },
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));
    expect(state.lastEmitted.beacon).toBeNull();
    expect(commands.some((c) => c.type === "stopBeacon")).toBe(true);

    ({ state } = step(state, w, {
      type: "sessionEffect",
      effect: { type: "stopNarration" },
      audioSec: 3,
      wallAtMs: T0 + 3000,
    }));

    // Setting off
    ({ state, commands } = step(state, w, {
      type: "settings",
      settings: { beaconsEnabled: false },
      audioSec: 4,
      wallAtMs: T0 + 4000,
    }));
    expect(state.lastEmitted.beacon).toBeNull();

    // Re-enable then speaker
    ({ state } = step(state, w, {
      type: "settings",
      settings: { beaconsEnabled: true, route: "headphones" },
      audioSec: 5,
      wallAtMs: T0 + 5000,
    }));
    ({ state, commands } = step(state, w, {
      type: "settings",
      settings: { route: "speaker" },
      audioSec: 6,
      wallAtMs: T0 + 6000,
    }));
    expect(state.lastEmitted.beacon).toBeNull();
  });
});

describe("7. budget under crossfade", () => {
  it("pauses accents and beacon during crossfade; never exceeds 12 voices", () => {
    expect(VOICE_BUDGET_TOTAL).toBe(12);
    const { state: s0, world: w } = boot();

    // Complete frag-root → afterglow with growth pending, still on cue-day
    let { state } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + AFTERGLOW_MS,
        fragmentId: "frag-root",
        tier: "root",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(state.pendingGrowthCueId).toBe("cue-growth");
    expect(state.currentCueId).toBe("cue-day");

    // After afterglow: cue switches with crossfade — accents + beacon pause
    const switched = step(state, w, {
      type: "heartbeat",
      audioSec: 10,
      wallAtMs: T0 + AFTERGLOW_MS + 100,
    });
    expect(switched.state.currentCueId).toBe("cue-growth");
    expect(switched.state.crossfading).toBe(true);
    expect(switched.state.lastEmitted.accentsPending).toHaveLength(0);
    expect(switched.state.lastEmitted.beacon).toBeNull();
    expect(switched.state.activeVoiceIds.length).toBeLessThanOrEqual(12);
  });
});

describe("8. mix ladder", () => {
  it("sheds in order, recovers slowly, never sheds narration", () => {
    const { state: s0, world: w } = boot();
    let { state } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });

    const shedTicks =
      MIX_SHED_ORDER.length * MIX_SHED_AFTER_WINDOWS + MIX_SHED_AFTER_WINDOWS;
    for (let i = 0; i < shedTicks; i++) {
      ({ state } = step(state, w, {
        type: "health",
        clockStarving: true,
        audioSec: 2 + i,
        wallAtMs: T0 + 2000 + i * 5000,
      }));
    }
    expect(shedLayers(state.mix)).toEqual([...MIX_SHED_ORDER]);
    expect(state.lastEmitted.narration).toBeTruthy();
    expect(state.lastEmitted.accentsPending).toHaveLength(0);
    expect(state.lastEmitted.beacon).toBeNull();

    // Recover one step after MIX_RECOVER_STEP_MS of healthy clock
    ({ state } = step(state, w, {
      type: "health",
      clockStarving: false,
      audioSec: 20,
      wallAtMs: T0 + 100_000,
    }));
    const afterOne = state.mix.shedIndex;
    expect(afterOne).toBe(MIX_SHED_ORDER.length); // just cleared starving; need dwell

    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: 21,
      wallAtMs: T0 + 100_000 + MIX_RECOVER_STEP_MS,
    }));
    expect(state.mix.shedIndex).toBe(MIX_SHED_ORDER.length - 1);
    expect(state.lastEmitted.narration).toBeTruthy();
  });
});

describe("9. interruption resume from breath point", () => {
  it("emits resume then playNarration at resumePointMs", () => {
    const breaths = [1000, 4000];
    const { state: s0, world: w } = boot();
    let { state } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
        breathPointsMs: breaths,
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    ({ state } = step(state, w, {
      type: "narrationProgress",
      positionMs: 3500,
      durationMs: 10_000,
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));

    const expected = resumePointMs(breaths, 3500);
    ({ state } = step(state, w, {
      type: "interruption",
      phase: "began",
      audioSec: 3,
      wallAtMs: T0 + 3000,
    }));
    expect(state.suspended).toBe(true);
    expect(state.resumePointMs).toBe(expected);

    const resumed = step(state, w, {
      type: "interruption",
      phase: "ended",
      shouldResume: true,
      audioSec: 4,
      wallAtMs: T0 + 4000,
    });
    expect(resumed.state.suspended).toBe(false);
    expect(resumed.commands.some((c) => c.type === "resume")).toBe(true);
    const play = resumed.commands.find((c) => c.type === "playNarration");
    expect(play).toMatchObject({
      type: "playNarration",
      startAtMs: expected,
      sha: "narr-root-sha",
    });
  });
});

describe("10. memory policy", () => {
  it("loads narration at 24 kHz; current+next only; no load while suspended", () => {
    const { state: s0, world: w, commands: bootCmds } = boot();
    // Prefetch nearest playable alongside any playing
    const narrLoads = bootCmds.filter(
      (c) => c.type === "load" && c.decodeHz === 24_000,
    );
    // After play, current + next
    let { state, commands } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    const loadNarr = commands.filter(
      (c) => c.type === "load" && (c.sha === "narr-root-sha" || c.decodeHz === 24_000),
    );
    expect(
      loadNarr.some(
        (c) =>
          c.type === "load" &&
          c.sha === "narr-root-sha" &&
          c.decodeHz === 24_000,
      ) || state.lastEmitted.decodeHzBySha["narr-root-sha"] === 24_000,
    ).toBe(true);

    const narrShas = Object.entries(state.lastEmitted.decodeHzBySha)
      .filter(([, hz]) => hz === 24_000)
      .map(([sha]) => sha);
    expect(narrShas.length).toBeLessThanOrEqual(2);
    expect(narrShas).toContain("narr-root-sha");

    // Seed an extra narration in previous desiredLoaded → unload
    state = {
      ...state,
      lastEmitted: {
        ...state.lastEmitted,
        desiredLoaded: [...state.lastEmitted.desiredLoaded, "narr-old-sha"],
      },
    };
    ({ state, commands } = step(state, w, {
      type: "heartbeat",
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));
    expect(
      commands.some((c) => c.type === "unload" && c.sha === "narr-old-sha"),
    ).toBe(true);

    // Suspended: no load
    ({ state, commands } = step(state, w, {
      type: "interruption",
      phase: "began",
      audioSec: 3,
      wallAtMs: T0 + 3000,
    }));
    expect(commands.some((c) => c.type === "load")).toBe(false);
    void narrLoads;
  });
});

describe("11. resume mid-Hush", () => {
  it("serialize mid-Hush and continue identically", () => {
    const { state: s0, world: w } = boot();
    let { state } = step(s0, w, {
      type: "heartbeat",
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    const due = state.hush.nextHushAt!;
    ({ state } = step(state, w, {
      type: "heartbeat",
      audioSec: (due - T0) / 1000,
      wallAtMs: due,
    }));
    expect(state.hush.phase).toBe("fadingOut");

    const restored = parseDirectorState(serializeDirectorState(state));
    const a = step(state, w, {
      type: "heartbeat",
      audioSec: (due - T0) / 1000 + 1,
      wallAtMs: due + 1000,
    });
    const b = step(restored, w, {
      type: "heartbeat",
      audioSec: (due - T0) / 1000 + 1,
      wallAtMs: due + 1000,
    });
    expect(a.commands).toEqual(b.commands);
    expect(a.state.hush.phase).toBe(b.state.hush.phase);
  });
});

describe("directorStep (smoke retained)", () => {
  it("ducks music under narration and holds afterglow", () => {
    const { state: s0, world: w } = boot();
    let { state } = step(s0, w, {
      type: "sessionEffect",
      effect: {
        type: "play",
        fragmentId: "frag-root",
        revisionNo: 1,
        sha: "narr-root-sha",
        breathPointsMs: [1000],
      },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(state.lastEmitted.busDb.music).toBeLessThan(-8);

    ({ state } = step(state, w, {
      type: "sessionEffect",
      effect: {
        type: "startAfterglow",
        endsAt: T0 + 1000 + AFTERGLOW_MS,
        fragmentId: "frag-root",
        tier: "root",
      },
      audioSec: 2,
      wallAtMs: T0 + 2000,
    }));
    expect(state.afterglowEndsAtMs).toBe(T0 + 1000 + AFTERGLOW_MS);
    expect(state.pendingGrowthCueId).toBe("cue-growth");
  });

  it("plays motif once on groveEntered at depth", () => {
    const { state: s0, world: w } = boot();
    const first = step(s0, w, {
      type: "sessionEffect",
      effect: { type: "groveEntered", groveId: "grove-1" },
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(momentSha(first.commands, first.state)).toBe("motif-sha");
    const second = step(first.state, w, {
      type: "sessionEffect",
      effect: { type: "groveEntered", groveId: "grove-1" },
      audioSec: 2,
      wallAtMs: T0 + 2000,
    });
    expect(second.state.motif.played).toBe(true);
  });

  it("assetFailed marks sha unusable and continues", () => {
    const { state: s0, world: w } = boot();
    const { state } = step(s0, w, {
      type: "assetFailed",
      sha: "bed-sha",
      audioSec: 1,
      wallAtMs: T0 + 1000,
    });
    expect(state.failedShas).toContain("bed-sha");
  });

  it("is deterministic for the same seed and inputs", () => {
    const run = () => {
      const { state: s0, world: w } = boot();
      const steps = [];
      let state = s0;
      for (let i = 1; i <= 5; i++) {
        const r = step(state, w, {
          type: "heartbeat",
          audioSec: i * 5,
          wallAtMs: T0 + i * 5000,
        });
        state = r.state;
        steps.push(r.commands);
      }
      return steps;
    };
    expect(run()).toEqual(run());
  });
});
