/**
 * B8: ExploringRuntime with fake engine + fake location (not the shared-machine harness).
 */
import type { GeoJsonMultiPolygon, SessionWorld } from "@intell/shared";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import {
  insertCompletionIgnore,
  listCompletions,
  setKv,
  upsertUnlock,
} from "../db/repos";
import type { LocationService } from "../location/LocationService";
import { ExploringRuntime } from "./ExploringRuntime";
import { FakeExploringEngine } from "./fakeExploringEngine";
import {
  DIRECTOR_KV_KEY,
  SESSION_KV_KEY,
  directorJsonForDisk,
  sessionJsonForDisk,
} from "./persist";
import {
  ACCESSIBLE_TRIGGER_KEY,
  LOCATION_AVAILABLE_KEY,
} from "./settingsKeys";
import type { PackedSession } from "./sessionWorld";
import { useSessionStore } from "./SessionStore";
import { strings } from "../ui/strings";
import {
  clearAudioBreadcrumbs,
  getAudioBreadcrumbs,
} from "../audio/session/audioBreadcrumbs";

const GROVE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SHA1 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA2 = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const LAT = 40.9612;
const LNG = -111.929;

function squareAround(lat: number, lng: number, delta = 0.002): GeoJsonMultiPolygon {
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

class FakeLocation {
  mode: "idle" | "foreground" | "balanced" | "high" = "idle";
  private onFix: ((f: {
    at: number;
    lat: number;
    lng: number;
    accuracyM: number;
  }) => void) | null = null;
  private onStop: (() => void) | null = null;
  modeHistory: string[] = [];

  setFixListener(
    listener: ((f: {
      at: number;
      lat: number;
      lng: number;
      accuracyM: number;
    }) => void) | null,
  ): void {
    this.onFix = listener;
  }

  setStopRequestListener(listener: (() => void) | null): void {
    this.onStop = listener;
  }

  async setMode(mode: "idle" | "foreground" | "balanced" | "high"): Promise<void> {
    const next = mode === "balanced" ? "high" : mode;
    this.mode = next;
    this.modeHistory.push(next);
  }

  async onAppBecameActive(): Promise<void> {
    // no-op
  }

  isAppActive(): boolean {
    return true;
  }

  getMode(): "idle" | "foreground" | "balanced" | "high" {
    return this.mode;
  }

  emit(fix: { at: number; lat: number; lng: number; accuracyM: number }): void {
    this.onFix?.(fix);
  }

  requestStop(): void {
    this.onStop?.();
  }
}

function buildPacked(overrides?: {
  world?: Partial<SessionWorld>;
  meta?: PackedSession["meta"];
}): PackedSession {
  const f1 = {
    id: "f1",
    groveId: GROVE_ID,
    tier: "root" as const,
    visibility: "standard" as const,
    retired: false,
    lat: LAT,
    lng: LNG,
    radiusM: 40,
    requires: [] as string[][],
    threadIds: [] as string[],
    contingencyRevisionNo: 1,
    versions: [
      { lang: "en" as const, timeWindow: "day" as const },
      { lang: "en" as const, timeWindow: "night" as const },
    ],
  };
  const f2 = {
    id: "f2",
    groveId: GROVE_ID,
    tier: "branch" as const,
    visibility: "standard" as const,
    retired: false,
    lat: LAT + 0.00005,
    lng: LNG,
    radiusM: 40,
    requires: [["f1"]],
    threadIds: [] as string[],
    contingencyRevisionNo: 1,
    versions: [
      { lang: "en" as const, timeWindow: "day" as const },
      { lang: "en" as const, timeWindow: "night" as const },
    ],
  };
  const physical = {
    id: "phys",
    groveId: GROVE_ID,
    tier: "leaf" as const,
    visibility: "physical" as const,
    retired: false,
    lat: LAT + 0.001,
    lng: LNG,
    requires: [] as string[][],
    threadIds: [] as string[],
    contingencyRevisionNo: 1,
    versions: [{ lang: "en" as const, timeWindow: "day" as const }],
  };
  const fContingency = {
    id: "f10",
    groveId: GROVE_ID,
    tier: "leaf" as const,
    visibility: "standard" as const,
    retired: false,
    lat: LAT + 0.0002,
    lng: LNG + 0.0002,
    radiusM: 40,
    requires: [] as string[][],
    threadIds: [] as string[],
    contingencyRevisionNo: 2,
    versions: [
      { lang: "en" as const, timeWindow: "day" as const },
      { lang: "en" as const, timeWindow: "night" as const },
    ],
  };
  const fCorrection = {
    id: "f4",
    groveId: GROVE_ID,
    tier: "branch" as const,
    visibility: "standard" as const,
    retired: false,
    lat: LAT - 0.0002,
    lng: LNG - 0.0002,
    radiusM: 40,
    requires: [] as string[][],
    threadIds: [] as string[],
    contingencyRevisionNo: 1,
    versions: [
      { lang: "en" as const, timeWindow: "day" as const },
      { lang: "en" as const, timeWindow: "night" as const },
    ],
  };

  const world: SessionWorld = {
    groves: [{ id: GROVE_ID, boundary: squareAround(LAT, LNG) }],
    fragments: [f1, f2, physical, fContingency, fCorrection],
    fragmentMeta: {
      f1: { revisionNo: 1, teaser: "t1" },
      f2: { revisionNo: 1, teaser: "t2" },
      phys: { revisionNo: 1, teaser: "tp" },
      f10: { revisionNo: 2, teaser: "contingency" },
      f4: { revisionNo: 2, teaser: "correction", changeTeaser: "fixed" },
    },
    externalPrerequisites: [],
    markers: { "marker-hash-phys": "phys" },
    completions: [],
    unlocks: [],
    timeWindow: "day",
    lang: "en",
    settings: {
      accessibleTrigger: false,
      locationAvailable: true,
      accuracyToleranceM: 25,
    },
    ...overrides?.world,
  };

  const meta: PackedSession["meta"] = {
    f1: {
      teaser: "t1",
      characterIds: [],
      revisionNo: 1,
      narrationByWindow: {
        day: {
          sha: SHA1,
          durationMs: 2_000,
          breathPointsMs: [],
          title: "Root story",
        },
        night: {
          sha: SHA1,
          durationMs: 2_000,
          breathPointsMs: [],
          title: "Root story night",
        },
      },
    },
    f2: {
      teaser: "t2",
      characterIds: [],
      revisionNo: 1,
      narrationByWindow: {
        day: {
          sha: SHA2,
          durationMs: 2_000,
          breathPointsMs: [],
          title: "Branch story",
        },
      },
    },
    phys: {
      teaser: "tp",
      characterIds: [],
      revisionNo: 1,
      narrationByWindow: {
        day: {
          sha: SHA1,
          durationMs: 2_000,
          breathPointsMs: [],
          title: "Physical",
        },
      },
    },
    f10: {
      teaser: "contingency",
      characterIds: [],
      revisionNo: 2,
      narrationByWindow: {
        day: {
          sha: SHA2,
          durationMs: 2_000,
          breathPointsMs: [],
          title: "Contingency",
        },
      },
    },
    f4: {
      teaser: "correction",
      changeTeaser: "fixed",
      characterIds: [],
      revisionNo: 2,
      narrationByWindow: {
        day: {
          sha: SHA1,
          durationMs: 2_000,
          breathPointsMs: [],
          title: "Correction",
        },
      },
    },
    ...overrides?.meta,
  };

  return {
    world,
    meta,
    markers: world.markers,
    motifDaySha: null,
    motifNightSha: null,
    allowsSpeakerWildlife: false,
    depthBloomTextureM: 10,
    timeZone: null,
    sunReference: null,
    assetUris: {
      [SHA1]: "file:///tmp/a.m4a",
      [SHA2]: "file:///tmp/b.m4a",
    },
  };
}

async function setup(opts?: {
  accessible?: boolean;
  locationAvailable?: boolean;
  packed?: PackedSession;
}) {
  const db = openNodeSqlite();
  await migrate(db);
  if (opts?.accessible) await setKv(db, ACCESSIBLE_TRIGGER_KEY, "1");
  if (opts?.locationAvailable === false) {
    await setKv(db, LOCATION_AVAILABLE_KEY, "0");
  }
  const engine = new FakeExploringEngine();
  const location = new FakeLocation();
  const packed = opts?.packed ?? buildPacked();
  const runtime = new ExploringRuntime({
    db,
    location: location as unknown as LocationService,
    engine,
    packedForTest: packed,
  });
  useSessionStore.getState().resetUi();
  await runtime.start();
  return { db, engine, location, runtime, packed };
}

async function twoFixes(
  runtime: ExploringRuntime,
  at: number,
  lat = LAT,
  lng = LNG,
): Promise<void> {
  await runtime.injectFix({ at, lat, lng, accuracyM: 5 });
  await runtime.injectFix({ at: at + 1_000, lat, lng, accuracyM: 5 });
}

/** Wall-clock base: session timeouts compare event.at to lastInsideGroveAt. */
function nowBase(): number {
  return Date.now();
}

async function flush(): Promise<void> {
  // Microtasks only — works under jest fake timers (no setImmediate).
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ExploringRuntime (B8)", () => {
  it("fix → play → voiceEnded → completion → afterglow → queued fragment", async () => {
    const packed = buildPacked();
    const f1 = packed.world.fragments.find((f) => f.id === "f1")!;
    const f2 = packed.world.fragments.find((f) => f.id === "f2")!;
    packed.world = {
      ...packed.world,
      fragments: [f1, f2],
      fragmentMeta: {
        f1: packed.world.fragmentMeta.f1!,
        f2: packed.world.fragmentMeta.f2!,
      },
    };
    const { db, engine, runtime } = await setup({ packed });
    const t0 = nowBase();
    await twoFixes(runtime, t0);
    expect(runtime.getSession().phase).toBe("exploring");
    expect(runtime.getSession().playing?.fragmentId).toBe("f1");
    expect(engine.playedNarration.some((p) => p.title === "Root story")).toBe(true);

    // Queue f2 while f1 plays (unlocked after f1 completes)
    await twoFixes(runtime, t0 + 3_000, LAT + 0.00005, LNG);

    await engine.emitVoiceEnded({ kind: "narration", reason: "ended" });

    const completions = await listCompletions(db);
    expect(completions.some((c) => c.fragment_id === "f1")).toBe(true);
    expect(runtime.getSession().afterglowEndsAt).not.toBeNull();
    expect(useSessionStore.getState().afterglow).not.toBeNull();

    const afterAt = (runtime.getSession().afterglowEndsAt ?? t0) + 1;
    await runtime.dispatch({ type: "afterglowElapsed", at: afterAt });
    await twoFixes(runtime, afterAt + 1_000, LAT + 0.00005, LNG);
    expect(runtime.getSession().playing?.fragmentId).toBe("f2");
    expect(engine.playedNarration.some((p) => p.title === "Branch story")).toBe(true);

    runtime.dispose();
  });

  it("interruption pauses and resumes when something is playing", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    expect(runtime.getSession().playing?.pausedAt).toBeNull();

    engine.emitInterruption("began");
    await flush();
    expect(runtime.getSession().playing?.pausedAt).not.toBeNull();

    engine.emitInterruption("ended");
    await flush();
    expect(runtime.getSession().playing?.pausedAt).toBeNull();

    runtime.dispose();
  });

  it("does not pause when nothing is playing (B3 guard)", async () => {
    const { engine, runtime } = await setup();
    await runtime.injectFix({
      at: nowBase(),
      lat: LAT,
      lng: LNG,
      accuracyM: 5,
    });
    expect(runtime.getSession().playing).toBeNull();
    engine.emitInterruption("began");
    await flush();
    expect(runtime.getSession().playing).toBeNull();
    runtime.dispose();
  });

  it("location denied: scans still play", async () => {
    const { engine, runtime } = await setup({ locationAvailable: false });
    await runtime.dispatch({
      type: "scan",
      at: nowBase(),
      markerHash: "marker-hash-phys",
    });
    expect(runtime.getSession().phase).toBe("exploring");
    expect(runtime.getSession().playing?.fragmentId).toBe("phys");
    expect(engine.playedNarration.length).toBeGreaterThan(0);
    runtime.dispose();
  });

  it("accessible trigger within 35 ft with one accurate fix", async () => {
    // Proximity radius 5 m; stand ~8 m away → accessible only (35 ft ≈ 10.67 m)
    const packed = buildPacked();
    packed.world = {
      ...packed.world,
      fragments: packed.world.fragments.map((f) =>
        f.id === "f1" ? { ...f, radiusM: 5 } : f,
      ),
    };
    const { runtime } = await setup({ accessible: true, packed });
    const offsetLat = LAT + 8 / 111_320;
    await runtime.injectFix({
      at: nowBase(),
      lat: offsetLat,
      lng: LNG,
      accuracyM: 5,
    });
    expect(runtime.getSession().phase).toBe("exploring");
    expect(runtime.getSession().playing?.fragmentId).toBe("f1");
    runtime.dispose();
  });

  it("session end: stopAll + media session stop + location stops", async () => {
    const { engine, location, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    expect(location.mode).toBe("high");

    await runtime.stopExploring();
    await flush();

    expect(runtime.getSession().phase).toBe("idle");
    expect(engine.stopAllCalls.length).toBeGreaterThan(0);
    expect(engine.session.stopped).toBe(true);
    expect(location.modeHistory).toContain("idle");
    expect(location.mode).toBe("foreground");
    runtime.dispose();
  });

  it("engine audio clock drives tick while exploring (B4)", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    expect(engine.isSessionClockRunning()).toBe(true);
    engine.emitTick(5);
    await flush();
    expect(runtime.getSession().phase).toBe("exploring");
    runtime.dispose();
  });
});

describe("ExploringRuntime session clock (C1)", () => {
  it("emitTick is ignored until startSessionClock; stops after session end", async () => {
    const { engine, runtime } = await setup();
    engine.emitTick(1);
    expect(engine.tickNotifyCount).toBe(0);

    await twoFixes(runtime, nowBase());
    expect(engine.isSessionClockRunning()).toBe(true);
    engine.emitTick(2);
    expect(engine.tickNotifyCount).toBe(1);

    await runtime.stopExploring();
    await flush();
    expect(engine.isSessionClockRunning()).toBe(false);
    const n = engine.tickNotifyCount;
    engine.emitTick(3);
    expect(engine.tickNotifyCount).toBe(n);
    runtime.dispose();
  });

  it("afterglow → queued play is driven by session-clock ticks only", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T17:00:00.000Z"));
    let runtime: ExploringRuntime | undefined;
    try {
      const packed = buildPacked();
      const f1 = packed.world.fragments.find((f) => f.id === "f1")!;
      const f2 = packed.world.fragments.find((f) => f.id === "f2")!;
      packed.world = {
        ...packed.world,
        fragments: [f1, f2],
        fragmentMeta: {
          f1: packed.world.fragmentMeta.f1!,
          f2: packed.world.fragmentMeta.f2!,
        },
      };
      const setupResult = await setup({ packed });
      runtime = setupResult.runtime;
      const { engine } = setupResult;
      const t0 = Date.now();
      await twoFixes(runtime, t0);
      expect(engine.isSessionClockRunning()).toBe(true);
      await twoFixes(runtime, t0 + 2_000, LAT + 0.00005, LNG);

      await engine.emitVoiceEnded({ kind: "narration", reason: "ended" });
      expect(runtime.getSession().afterglowEndsAt).not.toBeNull();
      const endsAt = runtime.getSession().afterglowEndsAt!;

      // Still in afterglow — clock tick must not drain yet
      engine.emitTick(5);
      await flush();
      expect(runtime.getSession().playing).toBeNull();
      expect(runtime.getSession().afterglowEndsAt).not.toBeNull();

      // Advance wall clock past afterglow; session-clock tick drains and may play f2
      jest.setSystemTime(endsAt + 50);
      engine.emitTick(10);
      await flush();
      expect(runtime.getSession().afterglowEndsAt).toBeNull();
      // If queue didn't auto-play, a fix after afterglow starts f2
      if (runtime.getSession().playing?.fragmentId !== "f2") {
        await twoFixes(runtime, endsAt + 1_000, LAT + 0.00005, LNG);
      }
      expect(runtime.getSession().playing?.fragmentId).toBe("f2");
      expect(engine.playedNarration.some((p) => p.title === "Branch story")).toBe(
        true,
      );
    } finally {
      runtime?.dispose();
      jest.useRealTimers();
    }
  });
});

describe("ExploringRuntime second session after Stop (C4)", () => {
  it("session 1 → Stop → session 2 clock ticks and narration plays", async () => {
    const { engine, runtime } = await setup();
    const t0 = nowBase();

    // Session 1: exploring + narration
    await twoFixes(runtime, t0);
    expect(runtime.getSession().phase).toBe("exploring");
    expect(engine.playedNarration.length).toBeGreaterThan(0);
    expect(engine.isSessionClockRunning()).toBe(true);
    engine.emitTick(1);
    expect(engine.tickNotifyCount).toBe(1);
    const playsAfterSession1 = engine.playedNarration.length;
    const focusAfterSession1 = engine.session.focusRequests;

    // Stop exploring → stopAll suspends context and mutes master
    await runtime.stopExploring();
    await flush();
    expect(runtime.getSession().phase).toBe("idle");
    expect(engine.isSessionClockRunning()).toBe(false);
    expect(engine.isContextSuspended()).toBe(true);
    expect(engine.masterLinear).toBeLessThan(0.5);
    expect(
      engine.playNarrationWhileSuspended(
        { sha: SHA1, durationMs: 2_000 },
        { title: "should-refuse", artist: "test" },
      ),
    ).toBeNull();
    expect(engine.refusedNarration).toBe(1);
    const ticksAtStop = engine.tickNotifyCount;
    engine.emitTick(2);
    expect(engine.tickNotifyCount).toBe(ticksAtStop);

    // Session 2: new exploring session
    const t1 = nowBase() + 60_000;
    await twoFixes(runtime, t1);
    expect(runtime.getSession().phase).toBe("exploring");
    expect(engine.isSessionClockRunning()).toBe(true);
    expect(engine.isContextSuspended()).toBe(false);

    // Clock ticks again after resume
    engine.emitTick(3);
    expect(engine.tickNotifyCount).toBe(ticksAtStop + 1);

    // Narration audible: master restored, focus requested, another play recorded
    expect(engine.masterLinear).toBe(1);
    expect(engine.session.focusRequests).toBeGreaterThan(focusAfterSession1);
    expect(engine.playedNarration.length).toBeGreaterThan(playsAfterSession1);
    expect(engine.getDiagnostics().contextState).toBe("running");

    runtime.dispose();
  });
});

describe("ExploringRuntime contingency / correction (B8)", () => {
  it("contingency: older completion of f10 plays again", async () => {
    const packed = buildPacked();
    // Only f10 so root f1 cannot win chooseTrigger
    const f10 = packed.world.fragments.find((f) => f.id === "f10")!;
    packed.world = {
      ...packed.world,
      fragments: [f10],
      fragmentMeta: { f10: packed.world.fragmentMeta.f10! },
      groves: [{ id: GROVE_ID, boundary: squareAround(f10.lat, f10.lng) }],
    };
    const { db, engine, runtime } = await setup({ packed });
    await insertCompletionIgnore(db, {
      fragment_id: "f10",
      revision_no: 1,
      time_window: "day",
      completed_at: "2026-01-01T00:00:00.000Z",
      on_site: 1,
      trigger: "proximity",
      session_id: "old",
    });
    await upsertUnlock(db, "f10", "2026-01-01T00:00:00.000Z");
    await runtime.reloadPacks();

    await twoFixes(runtime, nowBase(), f10.lat, f10.lng);
    expect(runtime.getSession().playing?.fragmentId).toBe("f10");
    expect(engine.playedNarration.some((p) => p.title === "Contingency")).toBe(
      true,
    );
    runtime.dispose();
  });

  it("correction: f4 completed at r1 does not play at correction revision", async () => {
    const packed = buildPacked();
    const f4 = packed.world.fragments.find((f) => f.id === "f4")!;
    packed.world = {
      ...packed.world,
      fragments: [f4],
      fragmentMeta: { f4: packed.world.fragmentMeta.f4! },
      groves: [{ id: GROVE_ID, boundary: squareAround(f4.lat, f4.lng) }],
    };
    const { db, engine, runtime } = await setup({ packed });
    await insertCompletionIgnore(db, {
      fragment_id: "f4",
      revision_no: 1,
      time_window: "day",
      completed_at: "2026-01-01T00:00:00.000Z",
      on_site: 1,
      trigger: "proximity",
      session_id: "old",
    });
    await upsertUnlock(db, "f4", "2026-01-01T00:00:00.000Z");
    await runtime.reloadPacks();

    await twoFixes(runtime, nowBase(), f4.lat, f4.lng);
    expect(runtime.getSession().playing?.fragmentId).not.toBe("f4");
    expect(engine.playedNarration.some((p) => p.title === "Correction")).toBe(
      false,
    );
    runtime.dispose();
  });
});

describe("ExploringRuntime restart clean start (F1)", () => {
  it("clears stale playing/overlay and a new scan plays narration", async () => {
    const { db, engine, runtime, packed } = await setup();
    await twoFixes(runtime, nowBase());
    expect(runtime.getSession().playing).not.toBeNull();
    expect(engine.playedNarration.length).toBeGreaterThan(0);

    await setKv(db, SESSION_KV_KEY, sessionJsonForDisk(runtime.getSession()));
    await setKv(
      db,
      DIRECTOR_KV_KEY,
      directorJsonForDisk(runtime.getDirector()),
    );
    runtime.dispose();

    const engine2 = new FakeExploringEngine();
    const location2 = new FakeLocation();
    const runtime2 = new ExploringRuntime({
      db,
      location: location2 as unknown as LocationService,
      engine: engine2,
      packedForTest: packed,
    });
    useSessionStore.getState().resetUi();
    useSessionStore.getState().setOverlay({
      title: "stale",
      tier: "root",
      progress: 1,
      paused: true,
      fragmentId: "f1",
    });
    await runtime2.start();
    await flush();

    expect(useSessionStore.getState().overlay).toBeNull();
    expect(runtime2.getSession().playing).toBeNull();
    expect(runtime2.getDirector().suspended).toBe(false);
    expect(runtime2.getDirector().lastEmitted.narration).toBeNull();

    const playsBefore = engine2.playedNarration.length;
    await runtime2.dispatch({
      type: "scan",
      at: nowBase() + 60_000,
      markerHash: "marker-hash-phys",
    });
    await flush();
    expect(runtime2.getSession().playing?.fragmentId).toBe("phys");
    expect(engine2.playedNarration.length).toBeGreaterThan(playsBefore);
    runtime2.dispose();
  });
});

describe("ExploringRuntime focus-denied start (F2)", () => {
  it("denies start, then retry on Resume plays", async () => {
    const { engine, runtime } = await setup();
    engine.session.denyNextStart = true;

    await twoFixes(runtime, nowBase());
    await flush();

    expect(engine.playedNarration.length).toBe(0);
    expect(runtime.getSession().playing?.pausedAt).not.toBeNull();
    const overlay = useSessionStore.getState().overlay;
    expect(overlay?.paused).toBe(true);
    expect(overlay?.busyHint).toBe(strings.audioBusyTap);
    expect(engine.session.isStarted()).toBe(false);

    await runtime.togglePause();
    await flush();

    expect(engine.session.isStarted()).toBe(true);
    expect(engine.playedNarration.length).toBeGreaterThan(0);
    expect(useSessionStore.getState().overlay?.paused).toBe(false);
    expect(useSessionStore.getState().overlay?.busyHint).toBeUndefined();
    runtime.dispose();
  });
});

describe("ExploringRuntime single resume (F3)", () => {
  it("interruption end does not apply a director resume command", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();
    expect(engine.playedNarration.length).toBeGreaterThan(0);

    engine.emitInterruption("began");
    await flush();
    const resumesAtBegan = engine.resumeNarrationCalls;

    engine.emitInterruption("ended");
    await flush();

    // Focus path owns resumeAfterFade; director `resume` is filtered out (F3).
    expect(engine.resumeNarrationCalls).toBe(resumesAtBegan);
    expect(runtime.getSession().playing?.pausedAt).toBeNull();
    runtime.dispose();
  });
});

describe("ExploringRuntime moment bus / apply batch (RC7)", () => {
  it("scan executes playNarration and leaves a live voice", async () => {
    const { engine, runtime } = await setup();
    // Strict fake throws on unknown bus — moment must be known (BUS_DEFAULT_DB).
    expect(() => engine.setGain("moment", 0, 0)).not.toThrow();

    await runtime.dispatch({
      type: "scan",
      at: nowBase(),
      markerHash: "marker-hash-phys",
    });
    await flush();

    expect(runtime.getSession().playing?.fragmentId).toBe("phys");
    expect(engine.playedNarration.length).toBeGreaterThan(0);
    expect(engine.getNarrationDiag()?.id).toBeTruthy();
    runtime.dispose();
  });
});

describe("ExploringRuntime replaced narration voice (RC6)", () => {
  it("interruption remount keeps playing with a new live voice", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();
    const playsBefore = engine.playedNarration.length;
    const voiceBefore = engine.getNarrationDiag()?.id;
    expect(voiceBefore).toBeTruthy();

    engine.emitInterruption("began");
    await flush();
    engine.emitInterruption("ended");
    await flush();

    expect(runtime.getSession().playing).not.toBeNull();
    expect(runtime.getSession().playing?.pausedAt).toBeNull();
    expect(engine.playedNarration.length).toBeGreaterThan(playsBefore);
    const voiceAfter = engine.getNarrationDiag()?.id;
    expect(voiceAfter).toBeTruthy();
    expect(voiceAfter).not.toBe(voiceBefore);
    runtime.dispose();
  });

  it("Back 10 s keeps playing after the remount", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();
    engine.emitProgress(12_000, 60_000);
    await flush();
    const voiceBefore = engine.getNarrationDiag()?.id;
    const playsBefore = engine.playedNarration.length;

    runtime.skipBack();
    await flush();

    expect(runtime.getSession().playing).not.toBeNull();
    expect(runtime.getSession().playing?.pausedAt).toBeNull();
    expect(engine.seekCalls.length).toBeGreaterThan(0);
    expect(engine.playedNarration.length).toBeGreaterThan(playsBefore);
    expect(engine.getNarrationDiag()?.id).not.toBe(voiceBefore);
    runtime.dispose();
  });

  it("user pause/resume keeps playing", async () => {
    const { runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();
    expect(runtime.getSession().playing?.pausedAt).toBeNull();

    await runtime.togglePause();
    await flush();
    expect(runtime.getSession().playing?.pausedAt).not.toBeNull();

    await runtime.togglePause();
    await flush();
    expect(runtime.getSession().playing).not.toBeNull();
    expect(runtime.getSession().playing?.pausedAt).toBeNull();
    runtime.dispose();
  });

  it("remote pause/play keeps playing", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();

    await engine.session.emitRemote("pause");
    await flush();
    expect(runtime.getSession().playing?.pausedAt).not.toBeNull();

    await engine.session.emitRemote("play");
    await flush();
    expect(runtime.getSession().playing).not.toBeNull();
    expect(runtime.getSession().playing?.pausedAt).toBeNull();
    runtime.dispose();
  });

  it("natural end fires narrationEnded once then completion and afterglow", async () => {
    const { db, engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();
    const currentId = engine.getNarrationDiag()?.id;
    expect(currentId).toBeTruthy();
    expect(useSessionStore.getState().overlay).not.toBeNull();

    await engine.emitVoiceEnded({
      voiceId: currentId!,
      kind: "narration",
      reason: "ended",
    });
    await flush();

    expect(runtime.getSession().playing).toBeNull();
    expect(useSessionStore.getState().overlay).toBeNull();
    const completions = await listCompletions(db);
    expect(completions.some((c) => c.fragment_id === "f1")).toBe(true);
    expect(runtime.getSession().afterglowEndsAt).not.toBeNull();

    // A stale cancelled end from a replaced voice must not double-complete.
    const before = completions.length;
    await engine.emitVoiceEnded({
      voiceId: "narr-stale",
      kind: "narration",
      reason: "cancelled",
    });
    await flush();
    const after = await listCompletions(db);
    expect(after.length).toBe(before);
    runtime.dispose();
  });

  it("natural narrationEnded clears the playing overlay", async () => {
    const { engine, runtime } = await setup();
    await twoFixes(runtime, nowBase());
    await flush();
    expect(useSessionStore.getState().overlay?.title).toBe("Root story");
    const currentId = engine.getNarrationDiag()?.id;
    expect(currentId).toBeTruthy();

    await runtime.injectNarrationEnded("natural", 1_500);
    await flush();

    expect(runtime.getSession().playing).toBeNull();
    expect(useSessionStore.getState().overlay).toBeNull();
    runtime.dispose();
  });

  it("togglePause with overlay and nothing playing clears it", async () => {
    const { runtime } = await setup();
    useSessionStore.getState().setOverlay({
      title: "Stale",
      tier: "leaf",
      progress: 0.5,
      paused: false,
      fragmentId: "f1",
    });
    expect(runtime.getSession().playing).toBeNull();
    clearAudioBreadcrumbs();

    await runtime.togglePause();

    expect(useSessionStore.getState().overlay).toBeNull();
    expect(getAudioBreadcrumbs().map((c) => c.message)).toContain(
      "togglePause:noop no-playing",
    );
    runtime.dispose();
  });
});

