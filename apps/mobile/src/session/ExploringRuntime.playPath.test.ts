/**
 * M6 reset Step 1: end-to-end play path through real buildPackedSession,
 * ExploringRuntime, applyDirectorCommands, and the strict fake engine.
 */
import { GrovePack } from "@intell/shared";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { listCompletions, upsertAsset, upsertPack } from "../db/repos";
import type { LocationService } from "../location/LocationService";
import { buildDemo, fixtureId } from "../map/fixtures";
import {
  clearAudioBreadcrumbs,
  getAudioBreadcrumbs,
} from "../audio/session/audioBreadcrumbs";
import { ExploringRuntime } from "./ExploringRuntime";
import { FakeExploringEngine } from "./fakeExploringEngine";
import { useSessionStore } from "./SessionStore";

const MARKER_HASH = "aa".repeat(32);
const NARR_SHA = "ab".repeat(32);
const BARE_ASSET_PATH = `/data/user/0/org.replaceplace.intell/files/assets/${NARR_SHA}.m4a`;

class FakeLocation {
  mode: "idle" | "foreground" | "balanced" | "high" = "idle";
  private onFix: ((f: {
    at: number;
    lat: number;
    lng: number;
    accuracyM: number;
  }) => void) | null = null;
  private onStop: (() => void) | null = null;

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
    this.mode = mode === "balanced" ? "high" : mode;
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

  requestStop(): void {
    this.onStop?.();
  }
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function demoGroveWithPhysicalScanTarget() {
  const demo = buildDemo();
  const targetId = fixtureId(10);
  const fragments = demo.grove.fragments.map((fragment) => {
    if (fragment.id !== targetId) return fragment;
    const { radiusM: _radius, ...rest } = fragment;
    return {
      ...rest,
      visibility: "physical" as const,
      markerHash: MARKER_HASH,
    };
  });
  return GrovePack.parse({ ...demo.grove, fragments });
}

describe("ExploringRuntime play path (M6 reset Step 1)", () => {
  it("scan → file:// load @ 24 kHz → playNarration → natural end → completion", async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const demo = buildDemo();
    const grove = demoGroveWithPhysicalScanTarget();
    const now = new Date().toISOString();
    await upsertPack(db, {
      scope: "grove",
      id: grove.groveId,
      version: grove.packVersion,
      manifest_json: JSON.stringify(grove),
      installed_at: now,
    });
    await upsertPack(db, {
      scope: "region",
      id: demo.region.regionId,
      version: demo.region.packVersion,
      manifest_json: JSON.stringify(demo.region),
      installed_at: now,
    });
    await upsertAsset(db, {
      sha: NARR_SHA,
      ext: "m4a",
      bytes: 1,
      local_uri: BARE_ASSET_PATH,
      last_used_at: now,
    });

    const engine = new FakeExploringEngine();
    const location = new FakeLocation();
    clearAudioBreadcrumbs();
    useSessionStore.getState().resetUi();

    const runtime = new ExploringRuntime({
      db,
      location: location as unknown as LocationService,
      engine,
      // No packedForTest — real reloadPacks → buildPackedSession + file:// prefix.
    });
    await runtime.start();
    await flush();

    expect(runtime.getSession().phase).toBe("idle");
    const playsBefore = engine.playedNarration.length;
    clearAudioBreadcrumbs();

    await runtime.dispatch({
      type: "scan",
      at: Date.now(),
      markerHash: MARKER_HASH,
    });
    await flush();

    expect(runtime.getSession().playing?.fragmentId).toBe(fixtureId(10));
    expect(engine.playedNarration.length).toBe(playsBefore + 1);
    expect(engine.getNarrationDiag()?.id).toBeTruthy();
    expect(engine.getNarrationDiag()?.paused).toBe(false);
    expect(engine.masterLinear).toBe(1);

    const narrLoad = engine.loadCalls.find((c) => c.sha === NARR_SHA);
    expect(narrLoad).toBeTruthy();
    expect(narrLoad!.uri).toBe(`file://${BARE_ASSET_PATH}`);
    expect(narrLoad!.sampleRate).toBe(24_000);

    const fragTail = fixtureId(10).slice(-8);
    const crumbs = getAudioBreadcrumbs().map((c) => c.message);
    expect(crumbs.some((m) => m.includes("cmd-fail"))).toBe(false);
    expect(crumbs.some((m) => m.includes("cmd playNarration"))).toBe(true);
    expect(crumbs).toContain("sessionStarted");
    expect(crumbs.some((m) => m.startsWith("groveEntered "))).toBe(true);
    expect(crumbs.some((m) => m.startsWith(`play ${fragTail} `))).toBe(true);
    expect(
      crumbs.some(
        (m) =>
          m.startsWith("diag ctx=") &&
          m.includes("started=") &&
          m.includes("narr=") &&
          !m.includes(" lat=") &&
          !m.includes("lng="),
      ),
    ).toBe(true);
    // load may arrive via an explicit `load` command or via playNarration's own load.
    expect(
      crumbs.some((m) => m.includes(`cmd load ${NARR_SHA.slice(0, 8)}`)) ||
        narrLoad != null,
    ).toBe(true);
    const noCoordPair = (m: string) =>
      !/-?\d{1,3}\.\d+[,\s]+-?\d{1,3}\.\d+/.test(m);
    expect(crumbs.every(noCoordPair)).toBe(true);

    clearAudioBreadcrumbs();
    await runtime.injectFix({
      at: Date.now(),
      lat: 40.76,
      lng: -111.891,
      accuracyM: 12.4,
    });
    await flush();
    const afterFix = getAudioBreadcrumbs().map((c) => c.message);
    expect(afterFix.some((m) => m === "fix acc=12")).toBe(true);
    expect(afterFix.every(noCoordPair)).toBe(true);

    const voiceId = engine.getNarrationDiag()!.id;
    await engine.emitVoiceEnded({
      voiceId,
      kind: "narration",
      reason: "ended",
    });
    await flush();
    await runtime.whenIdle();
    await flush();

    expect(runtime.getSession().playing).toBeNull();
    const completions = await listCompletions(db);
    expect(completions.some((c) => c.fragment_id === fixtureId(10))).toBe(true);
    expect(runtime.getSession().afterglowEndsAt).not.toBeNull();
    expect(useSessionStore.getState().afterglow).not.toBeNull();
    const endCrumbs = getAudioBreadcrumbs().map((c) => c.message);
    expect(endCrumbs).toContain("narrationEnded natural");
    expect(endCrumbs).toContain(`completed ${fragTail}`);
    expect(endCrumbs.some((m) => m.startsWith("unlocked "))).toBe(true);
    expect(endCrumbs.every(noCoordPair)).toBe(true);

    clearAudioBreadcrumbs();
    await runtime.stopExploring();
    await flush();
    await runtime.whenIdle();
    const stopCrumbs = getAudioBreadcrumbs().map((c) => c.message);
    expect(stopCrumbs).toContain("sessionEnded");
    expect(stopCrumbs.every(noCoordPair)).toBe(true);

    runtime.dispose();
  });

  it("reloadPacks after late install makes a scan find the marker", async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const demo = buildDemo();
    const grove = demoGroveWithPhysicalScanTarget();
    const now = new Date().toISOString();
    // Region only at start — mirrors install after the runtime already built its world.
    await upsertPack(db, {
      scope: "region",
      id: demo.region.regionId,
      version: demo.region.packVersion,
      manifest_json: JSON.stringify(demo.region),
      installed_at: now,
    });

    const engine = new FakeExploringEngine();
    const location = new FakeLocation();
    clearAudioBreadcrumbs();
    useSessionStore.getState().resetUi();

    const runtime = new ExploringRuntime({
      db,
      location: location as unknown as LocationService,
      engine,
    });
    await runtime.start();
    await flush();

    await runtime.dispatch({
      type: "scan",
      at: Date.now(),
      markerHash: MARKER_HASH,
    });
    await flush();
    expect(runtime.getSession().playing).toBeNull();
    expect(engine.playedNarration.length).toBe(0);

    await upsertPack(db, {
      scope: "grove",
      id: grove.groveId,
      version: grove.packVersion,
      manifest_json: JSON.stringify(grove),
      installed_at: now,
    });
    await upsertAsset(db, {
      sha: NARR_SHA,
      ext: "m4a",
      bytes: 1,
      local_uri: BARE_ASSET_PATH,
      last_used_at: now,
    });
    await runtime.reloadPacks();

    clearAudioBreadcrumbs();
    await runtime.dispatch({
      type: "scan",
      at: Date.now(),
      markerHash: MARKER_HASH,
    });
    await flush();

    expect(runtime.getSession().playing?.fragmentId).toBe(fixtureId(10));
    expect(engine.playedNarration.length).toBe(1);
    expect(
      getAudioBreadcrumbs().some((c) =>
        c.message.startsWith(`play ${fixtureId(10).slice(-8)} `),
      ),
    ).toBe(true);
    expect(getAudioBreadcrumbs().map((c) => c.message)).toContain(
      "sessionStarted",
    );

    runtime.dispose();
  });

  it("emits a periodic diag breadcrumb every 5 s while exploring", async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const demo = buildDemo();
    const grove = demoGroveWithPhysicalScanTarget();
    const now = new Date().toISOString();
    await upsertPack(db, {
      scope: "grove",
      id: grove.groveId,
      version: grove.packVersion,
      manifest_json: JSON.stringify(grove),
      installed_at: now,
    });
    await upsertPack(db, {
      scope: "region",
      id: demo.region.regionId,
      version: demo.region.packVersion,
      manifest_json: JSON.stringify(demo.region),
      installed_at: now,
    });
    await upsertAsset(db, {
      sha: NARR_SHA,
      ext: "m4a",
      bytes: 1,
      local_uri: BARE_ASSET_PATH,
      last_used_at: now,
    });

    const engine = new FakeExploringEngine();
    const location = new FakeLocation();
    clearAudioBreadcrumbs();
    useSessionStore.getState().resetUi();

    const runtime = new ExploringRuntime({
      db,
      location: location as unknown as LocationService,
      engine,
    });
    await runtime.start();
    await flush();

    let wall = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, "now").mockImplementation(() => wall);

    await runtime.dispatch({
      type: "scan",
      at: wall,
      markerHash: MARKER_HASH,
    });
    await flush();
    expect(runtime.getSession().phase).toBe("exploring");

    expect(engine.isSessionClockRunning()).toBe(true);

    clearAudioBreadcrumbs();
    wall += 5_000;
    engine.emitTick(1);
    await flush();
    await runtime.whenIdle();
    await flush();
    expect(engine.tickNotifyCount).toBeGreaterThan(0);
    expect(
      getAudioBreadcrumbs().some((c) => c.message.startsWith("diag ctx=")),
    ).toBe(true);

    clearAudioBreadcrumbs();
    wall += 4_999;
    engine.emitTick(2);
    await flush();
    await runtime.whenIdle();
    await flush();
    expect(
      getAudioBreadcrumbs().some((c) => c.message.startsWith("diag ctx=")),
    ).toBe(false);

    wall += 1;
    engine.emitTick(3);
    await flush();
    await runtime.whenIdle();
    await flush();
    expect(
      getAudioBreadcrumbs().some((c) => c.message.startsWith("diag ctx=")),
    ).toBe(true);

    nowSpy.mockRestore();
    runtime.dispose();
  });
});
