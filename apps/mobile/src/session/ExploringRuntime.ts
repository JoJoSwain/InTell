/**
 * Wires session shell, effects, location, director, engine, and audio-session (M6 review 1).
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Haptics from "expo-haptics";
import { randomUUID } from "expo-crypto";
import {
  backSkipMs,
  computedPlayedMs,
  currentTimeWindow,
  directorStep,
  emptyTargetMix,
  initialDirectorState,
  localDayKey,
  type AudioRoute,
  type DirectorSessionEffect,
  type DirectorState,
  type SessionEvent,
  type SessionState,
  type StoryState,
  type TimeWindow,
} from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import {
  deleteKv,
  getKv,
  listAssets,
  listCompletions,
  listPacks,
  listUnlocks,
  setKv,
} from "../db/repos";
import type { LocationService } from "../location/LocationService";
import { applyDirectorCommands } from "../audio/director/applyDirectorCommands";
import {
  buildM6DirectorWorld,
  m6DirectorSettings,
} from "../audio/director/m6World";
import {
  getAudioBreadcrumbs,
  pushAudioBreadcrumb,
} from "../audio/session/audioBreadcrumbs";
import { applySessionEffects, type PlayRequest } from "./applySessionEffects";
import {
  DIRECTOR_KV_KEY,
  SESSION_KV_KEY,
  directorJsonForDisk,
  loadDirectorState,
  loadSessionState,
  sessionJsonForDisk,
} from "./persist";
import { stepSession, withSessionId } from "./sessionShell";
import {
  ACCESSIBLE_TRIGGER_KEY,
  BEACONS_ENABLED_KEY,
  DEFAULT_EXPLORING_SETTINGS,
  LOCATION_AVAILABLE_KEY,
  parseBoolKv,
  type ExploringSettings,
} from "./settingsKeys";
import { buildPackedSession, type PackedSession } from "./sessionWorld";
import { useSessionStore } from "./SessionStore";
import { hashMarkerCode } from "./markerCode";
import type { ExploringEngine } from "./enginePort";
import { strings } from "../ui/strings";

function newSessionId(): string {
  return randomUUID();
}

/** Last 8 chars of a UUID — walk pack ids share a "cccccccc" prefix. */
const tail8 = (id: string) => id.slice(-8);

export type ExploringRuntimeDeps = {
  db: SqlDriver;
  location: LocationService;
  /** Required — one RNAudioApiEngine (or a fake in tests). */
  engine: ExploringEngine;
  /**
   * B8 tests: prebuilt packed world. Completions/unlocks still refresh from db
   * on reloadPacks so recordCompletion is exercised.
   */
  packedForTest?: PackedSession;
};

/** Listener (overlay / lock screen / headset / becoming-noisy) vs system (focus loss). */
type PauseOwner = "listener" | "system";

/** Process-wide runtime+engine: React remounts must not create a second pair (A10). */
let exploringRuntimeSingleton: ExploringRuntime | null = null;

/**
 * One ExploringRuntime per JS process. First call constructs; later calls return
 * the same instance (deps ignored). Tests that need a fresh instance use
 * `new ExploringRuntime` and/or `resetExploringRuntimeSingletonForTests`.
 */
export function getExploringRuntime(deps: ExploringRuntimeDeps): ExploringRuntime {
  if (!exploringRuntimeSingleton) {
    exploringRuntimeSingleton = new ExploringRuntime(deps);
  }
  return exploringRuntimeSingleton;
}

/** Clears the process singleton after `dispose()` in tests. */
export function resetExploringRuntimeSingletonForTests(): void {
  exploringRuntimeSingleton = null;
}

export class ExploringRuntime {
  private session: SessionState = loadSessionState(null);
  private director: DirectorState;
  private packed: PackedSession | null = null;
  private settings: ExploringSettings = { ...DEFAULT_EXPLORING_SETTINGS };
  private appSub: { remove: () => void } | null = null;
  private unsubs: (() => void)[] = [];
  private voices = new Map();
  private disposed = false;
  private bootstrapped = false;
  private narrationVoiceId: string | null = null;
  private lastWindow: TimeWindow | null = null;
  private lastHeartbeatAudioSec = 0;
  private endingSession = false;
  /** Prevents window sync from re-entering dispatch (C2). */
  private inWindowSync = false;
  /** Last wall time we emitted a periodic `diag` breadcrumb (M6 step 4b). */
  private lastDiagBreadcrumbAt = 0;
  /** Last wall time we emitted a throttled `fix acc=` breadcrumb. */
  private lastFixAccBreadcrumbAt = 0;
  /** Serialises every public entry and engine callback (MOB-1). */
  private chain: Promise<void> = Promise.resolve();
  /** Who owns the current pause; memory only (no kv). */
  private pauseOwner: PauseOwner | null = null;
  /**
   * Listener-owned pause: defer interruption-ended director step until resume
   * so a remount cannot start audio while still paused.
   */
  private deferredInterruptionEnded = false;

  constructor(private readonly deps: ExploringRuntimeDeps) {
    this.director = initialDirectorState({
      seed: 1,
      wallAtMs: Date.now(),
      dayKey: localDayKey(new Date(), "UTC"),
    });
    this.director = { ...this.director, settings: m6DirectorSettings() };
  }

  getSession(): SessionState {
    return this.session;
  }

  getAudioSession() {
    return this.deps.engine.getSession();
  }

  /** Engine held by this runtime (tests: singleton remount). */
  getEngine(): ExploringEngine {
    return this.deps.engine;
  }

  /** Who owns the current pause (`null` when not paused by ownership). Tests. */
  getPauseOwnerForTest(): PauseOwner | null {
    return this.pauseOwner;
  }

  /**
   * Resolves when the serial queue is idle. Engine callbacks enqueue and return
   * at once — tests await this after `emitVoiceEnded` / `stopAll` / remotes.
   */
  whenIdle(): Promise<void> {
    return this.chain;
  }

  private serial(task: () => Promise<void>): Promise<void> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async start(): Promise<void> {
    await this.serial(() => this.startNow());
  }

  private async startNow(): Promise<void> {
    if (this.disposed || this.bootstrapped) return;
    await this.deps.engine.init({ mixWithOthers: false });
    await this.reloadSettingsNow();
    await this.reloadPacksNow();
    const sessionRaw = await getKv(this.deps.db, SESSION_KV_KEY);
    const directorRaw = await getKv(this.deps.db, DIRECTOR_KV_KEY);
    this.session = loadSessionState(sessionRaw);
    this.director = loadDirectorState(directorRaw, {
      seed: 1,
      wallAtMs: Date.now(),
      dayKey: localDayKey(new Date(), this.packed?.timeZone ?? "UTC"),
    });
    const settings = m6DirectorSettings(this.director.settings.route);
    // F1: engine is empty after a real process restart — reset emitted mix so
    // the next step re-emits playNarration; clear suspended so loads aren't blocked.
    this.director = {
      ...this.director,
      settings,
      lastEmitted: emptyTargetMix(settings.route),
      suspended: false,
    };
    useSessionStore.getState().setSession(this.session, null);
    // F1: no stale overlay from a previous process.
    useSessionStore.getState().setOverlay(null);

    // F1: restored `playing` has no voice in this process — end as interrupted.
    // Also clear director.narration so a later story step cannot remount an
    // orphan playNarration with no session behind it (A10).
    if (this.session.playing) {
      const at = Date.now();
      const playedMs = computedPlayedMs(this.session.playing, at);
      pushAudioBreadcrumb(`start:interrupt-stale playedMs=${playedMs}`);
      await this.dispatchNow({
        type: "narrationEnded",
        at,
        reason: "interrupted",
        playedMs,
      });
      this.director = {
        ...this.director,
        narration: {
          playing: false,
          fragmentId: null,
          sha: null,
          startedAtSec: null,
          endsAtSec: null,
          positionMs: 0,
          breathPointsMs: [],
          meta: null,
        },
        lastEmitted: emptyTargetMix(this.director.settings.route),
        suspended: false,
      };
      this.pauseOwner = null;
      this.deferredInterruptionEnded = false;
    }

    await this.dispatchWindowIfNeeded(Date.now(), true);

    // C1: resume while exploring — restart the session clock
    if (this.session.phase === "exploring") {
      this.deps.engine.startSessionClock();
    }

    if (this.session.phase === "idle") {
      await this.deps.location.setMode("foreground");
    } else if (this.deps.location.isAppActive()) {
      await this.deps.location.setMode("high");
    } else {
      await this.deps.location.setMode("foreground");
    }

    // Wire last so ticks/fixes cannot interleave with bootstrap.
    this.wireLocation();
    this.wireEngine();
    this.wireAudioSessionRemotes();

    this.appSub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void this.deps.location.onAppBecameActive();
    });

    this.bootstrapped = true;
  }

  getDirector(): DirectorState {
    return this.director;
  }

  /** Live snapshot for the Data screen (release-visible). */
  getAudioDiagnosticsSnapshot(): {
    contextState: string;
    masterGain: number;
    focusMode: string;
    busy: string;
    sessionStarted: boolean;
    narration: { id: string; paused: boolean; positionMs: number } | null;
    directorSuspended: boolean;
    sessionPhase: SessionState["phase"];
    playing: boolean;
    /** Master-bus RMS in dBFS; null if analyser unavailable. */
    outDb: number | null;
    breadcrumbs: readonly { at: number; message: string }[];
  } {
    const audioSession = this.deps.engine.getSession();
    const diag = this.deps.engine.getDiagnostics();
    return {
      contextState: diag.contextState ?? "unknown",
      masterGain: this.deps.engine.getMasterGainLinear?.() ?? 1,
      focusMode: audioSession.getMode(),
      busy: audioSession.getBusy(),
      sessionStarted: audioSession.isStarted(),
      narration: this.deps.engine.getNarrationDiag?.() ?? null,
      directorSuspended: this.director.suspended,
      sessionPhase: this.session.phase,
      playing: this.session.playing != null && this.session.playing.pausedAt === null,
      outDb: this.deps.engine.getOutputLevelDb?.() ?? null,
      breadcrumbs: getAudioBreadcrumbs(),
    };
  }

  /**
   * Step 4b: release-visible one-liner for logcat (no coordinates / marker codes).
   * `diag ctx=… master=… started=… narr=<id8>|none paused=… pos=… out=… phase=… playing=…`
   */
  private pushDiagBreadcrumb(): void {
    const s = this.getAudioDiagnosticsSnapshot();
    const narr =
      s.narration?.id != null && s.narration.id.length > 0
        ? s.narration.id.slice(0, 8)
        : "none";
    const paused = s.narration != null ? String(s.narration.paused) : "false";
    const pos =
      s.narration != null ? Math.round(s.narration.positionMs) : 0;
    const out =
      s.outDb != null && Number.isFinite(s.outDb)
        ? String(Math.round(s.outDb))
        : "n/a";
    pushAudioBreadcrumb(
      `diag ctx=${s.contextState} master=${s.masterGain.toFixed(3)} started=${s.sessionStarted} narr=${narr} paused=${paused} pos=${pos} out=${out} phase=${s.sessionPhase} playing=${s.playing}`,
    );
  }

  /**
   * F5: stop audio + location, clear session/director kv. Packs stay installed.
   */
  async resetSessionKeepPacks(): Promise<void> {
    await this.serial(() => this.resetSessionKeepPacksNow());
  }

  private async resetSessionKeepPacksNow(): Promise<void> {
    pushAudioBreadcrumb("resetSessionKeepPacks");
    try {
      await this.stopExploringNow();
    } catch {
      // may already be idle
    }
    await this.deps.location.setMode("idle");
    await this.deps.location.setMode("foreground");
    await deleteKv(this.deps.db, SESSION_KV_KEY);
    await deleteKv(this.deps.db, DIRECTOR_KV_KEY);
    this.session = loadSessionState(null);
    this.director = initialDirectorState({
      seed: 1,
      wallAtMs: Date.now(),
      dayKey: localDayKey(new Date(), this.packed?.timeZone ?? "UTC"),
    });
    this.director = { ...this.director, settings: m6DirectorSettings() };
    this.narrationVoiceId = null;
    this.pauseOwner = null;
    this.deferredInterruptionEnded = false;
    useSessionStore.getState().setSession(this.session, null);
    useSessionStore.getState().resetUi();
  }

  /** Tests only — production Provider never disposes the process singleton. */
  dispose(): void {
    this.disposed = true;
    this.deps.engine.stopSessionClock();
    this.appSub?.remove();
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.deps.location.setFixListener(null);
  }

  private wireLocation(): void {
    this.deps.location.setFixListener((fix) => {
      void this.serial(() =>
        this.dispatchNow({
          type: "fix",
          at: fix.at,
          lat: fix.lat,
          lng: fix.lng,
          accuracyM: fix.accuracyM,
        }),
      );
    });
    this.deps.location.setStopRequestListener(() => {
      void this.serial(() => this.dispatchNow({ type: "stop", at: Date.now() }));
    });
  }

  private wireEngine(): void {
    const { engine } = this.deps;
    this.unsubs.push(
      engine.onTick((audioSec) => {
        void this.serial(() => this.onAudioClockNow(audioSec));
      }),
    );
    this.unsubs.push(
      engine.onVoiceEnded((e) => {
        // Enqueue and return at once — never await from the engine (deadlock).
        void this.serial(() => this.onVoiceEndedNow(e));
      }),
    );
    this.unsubs.push(
      engine.onNarrationProgress((p) => {
        void this.serial(() => this.onNarrationProgressNow(p));
      }),
    );
    this.unsubs.push(
      engine.onInterruption((phase) => {
        void this.serial(() => this.onInterruptionNow(phase));
      }),
    );
    this.unsubs.push(
      engine.onRouteChange((route) => {
        void this.serial(() => this.onRouteNow(route));
      }),
    );
  }

  /** F6: subscribe via engine so we don't overwrite its remote handler / skip-back. */
  private wireAudioSessionRemotes(): void {
    this.unsubs.push(
      this.deps.engine.onRemoteCommand((command) => {
        void this.serial(() => this.handleRemoteNow(command));
      }),
    );
  }

  private async handleRemoteNow(command: string): Promise<void> {
    if (this.disposed) return;
    if (command === "stopExploring") {
      pushAudioBreadcrumb("remote:stopExploring");
      await this.dispatchNow({ type: "stop", at: Date.now() });
      return;
    }
    if (!this.session.playing) return;
    if (command === "pause") {
      pushAudioBreadcrumb("remote:pause");
      this.pauseOwner = "listener";
      await this.dispatchNow({ type: "narrationPaused", at: Date.now() });
      const overlay = useSessionStore.getState().overlay;
      if (overlay) {
        useSessionStore.getState().setOverlay({ ...overlay, paused: true });
      }
      return;
    }
    if (command === "play") {
      pushAudioBreadcrumb("remote:play");
      await this.applyDeferredInterruptionEndedIfNeeded();
      await this.dispatchNow({ type: "narrationResumed", at: Date.now() });
      this.pauseOwner = null;
      const overlay = useSessionStore.getState().overlay;
      if (overlay) {
        useSessionStore.getState().setOverlay({
          ...overlay,
          paused: false,
          busyHint: undefined,
        });
      }
      return;
    }
    // skipBackward: engine already sought; sync engine voice id (RC6).
    if (command === "skipBackward") {
      this.syncNarrationVoiceIdFromEngine();
    }
  }

  async reloadSettings(): Promise<void> {
    await this.serial(() => this.reloadSettingsNow());
  }

  private async reloadSettingsNow(): Promise<void> {
    const accessible = parseBoolKv(
      await getKv(this.deps.db, ACCESSIBLE_TRIGGER_KEY),
      DEFAULT_EXPLORING_SETTINGS.accessibleTrigger,
    );
    const locationAvailable = parseBoolKv(
      await getKv(this.deps.db, LOCATION_AVAILABLE_KEY),
      DEFAULT_EXPLORING_SETTINGS.locationAvailable,
    );
    const beaconsEnabled = parseBoolKv(
      await getKv(this.deps.db, BEACONS_ENABLED_KEY),
      false,
    );
    this.settings = {
      ...DEFAULT_EXPLORING_SETTINGS,
      accessibleTrigger: accessible,
      locationAvailable,
      beaconsEnabled,
    };
  }

  async reloadPacks(): Promise<void> {
    await this.serial(() => this.reloadPacksNow());
  }

  private async reloadPacksNow(): Promise<void> {
    const completions = (await listCompletions(this.deps.db)).map((row) => ({
      fragmentId: row.fragment_id,
      revisionNo: row.revision_no,
      timeWindow: row.time_window as "day" | "night",
      onSite: row.on_site === 1,
    }));
    const unlocks = (await listUnlocks(this.deps.db)).map((row) => ({
      fragmentId: row.fragment_id,
    }));

    if (this.deps.packedForTest) {
      const base = this.deps.packedForTest;
      this.packed = {
        ...base,
        world: {
          ...base.world,
          completions,
          unlocks,
          settings: {
            accessibleTrigger: this.settings.accessibleTrigger,
            locationAvailable: this.settings.locationAvailable,
            accuracyToleranceM: this.settings.accuracyToleranceM,
          },
        },
      };
      return;
    }

    const packs = await listPacks(this.deps.db);
    const assets = await listAssets(this.deps.db);
    const assetUris: Record<string, string> = {};
    for (const asset of assets) {
      const u = asset.local_uri;
      assetUris[asset.sha] =
        u.startsWith("file:") || u.startsWith("content:") || u.startsWith("http")
          ? u
          : u.startsWith("/")
            ? `file://${u}`
            : `file:///${u}`;
    }
    this.packed = buildPackedSession({
      packs,
      completions,
      unlocks,
      settings: this.settings,
      assetUris,
    });
  }

  async scanCode(code: string): Promise<void> {
    await this.serial(() => this.scanCodeNow(code));
  }

  private async scanCodeNow(code: string): Promise<void> {
    const markerHash = await hashMarkerCode(code);
    // Hash only — never log the raw code (AGENTS.md).
    pushAudioBreadcrumb(`scan hash=${markerHash.slice(0, 8)}`);
    await this.dispatchNow({ type: "scan", at: Date.now(), markerHash });
  }

  async stopExploring(): Promise<void> {
    await this.serial(() => this.stopExploringNow());
  }

  private async stopExploringNow(): Promise<void> {
    await this.dispatchNow({ type: "stop", at: Date.now() });
  }

  async togglePause(): Promise<void> {
    await this.serial(() => this.togglePauseNow());
  }

  private async togglePauseNow(): Promise<void> {
    const overlay = useSessionStore.getState().overlay;
    if (!overlay) return;
    // Natural end clears playing but used to leave the overlay up — dismiss
    // instead of a dead Pause control (A2).
    if (!this.session.playing) {
      pushAudioBreadcrumb("togglePause:noop no-playing");
      useSessionStore.getState().setOverlay(null);
      return;
    }
    const audioSession = this.deps.engine.getSession();
    if (overlay.paused) {
      pushAudioBreadcrumb("togglePause:resume");
      // Apply deferred / pending interruption-ended before audio so remount
      // lands on the resume path, not while still listener-paused.
      await this.applyDeferredInterruptionEndedIfNeeded();
      // F2: focus-denied start never opened the native session — retry start.
      if (!audioSession.isStarted()) {
        const ok = await audioSession.start({
          title: overlay.title,
          artist: "InTell",
        });
        pushAudioBreadcrumb(`resume:start ok=${ok}`);
        if (!ok) {
          useSessionStore.getState().setOverlay({
            ...overlay,
            paused: true,
            busyHint: strings.audioBusyTap,
          });
          return;
        }
        const play = useSessionStore.getState().playRequest;
        const story = useSessionStore.getState().story;
        if (play && story) {
          const asset =
            this.packed?.meta[play.fragmentId]?.narrationByWindow[
              play.version.timeWindow
            ];
          await this.directorSessionEffect(
            {
              type: "play",
              fragmentId: play.fragmentId,
              revisionNo: play.revisionNo,
              sha: asset?.sha,
              title: asset?.title ?? overlay.title,
              breathPointsMs: asset?.breathPointsMs,
              durationMs: asset?.durationMs,
            },
            story,
          );
        }
      } else {
        await audioSession.userPlay();
      }
      await this.dispatchNow({ type: "narrationResumed", at: Date.now() });
      this.pauseOwner = null;
      useSessionStore.getState().setOverlay({
        ...overlay,
        paused: false,
        busyHint: undefined,
      });
    } else {
      // Optimistic UI before await — keeps Pause→Resume snappy if focus work lags.
      pushAudioBreadcrumb("togglePause:pause");
      this.pauseOwner = "listener";
      useSessionStore.getState().setOverlay({ ...overlay, paused: true });
      await this.dispatchNow({ type: "narrationPaused", at: Date.now() });
      await audioSession.userPause();
    }
  }

  skipBack(): void {
    void this.serial(() => this.skipBackNow());
  }

  private async skipBackNow(): Promise<void> {
    const position = this.director.narration.positionMs;
    const next = backSkipMs(position);
    this.deps.engine.seekNarration?.(next);
    this.syncNarrationVoiceIdFromEngine();
  }

  /** RC6: keep narrationVoiceId aligned after seek / remount outside applyCommands. */
  private syncNarrationVoiceIdFromEngine(): void {
    const diag = this.deps.engine.getNarrationDiag?.();
    if (diag?.id) this.narrationVoiceId = diag.id;
  }

  /** Inject a location fix (tests / mock GPX). */
  async injectFix(fix: {
    at: number;
    lat: number;
    lng: number;
    accuracyM: number;
  }): Promise<void> {
    await this.serial(() =>
      this.dispatchNow({
        type: "fix",
        at: fix.at,
        lat: fix.lat,
        lng: fix.lng,
        accuracyM: fix.accuracyM,
      }),
    );
  }

  /** Simulate engine narration end (tests). */
  async injectNarrationEnded(
    reason: "natural" | "stopped" | "interrupted",
    playedMs: number,
  ): Promise<void> {
    await this.serial(() =>
      this.dispatchNow({
        type: "narrationEnded",
        at: Date.now(),
        reason,
        playedMs,
      }),
    );
  }

  async dispatch(event: SessionEvent): Promise<void> {
    await this.serial(() => this.dispatchNow(event));
  }

  private async dispatchNow(event: SessionEvent): Promise<void> {
    if (this.disposed) return;
    if (!this.packed) await this.reloadPacksNow();
    if (!this.packed) return;

    // C2: recompute Day/Night before every step (not only on audio ticks).
    if (!this.inWindowSync && event.type !== "windowChanged") {
      this.inWindowSync = true;
      try {
        await this.dispatchWindowIfNeeded(
          event.at,
          this.lastWindow === null,
        );
      } finally {
        this.inWindowSync = false;
      }
      if (!this.packed) return;
    }

    const wasExploring = this.session.phase === "exploring";
    const queuedBefore = this.session.queued?.fragmentId ?? null;

    if (event.type === "narrationEnded") {
      pushAudioBreadcrumb(`narrationEnded ${event.reason}`);
    }

    const world = {
      ...this.packed.world,
      settings: {
        accessibleTrigger: this.settings.accessibleTrigger,
        locationAvailable: this.settings.locationAvailable,
        accuracyToleranceM: this.settings.accuracyToleranceM,
      },
    };

    const enriched = withSessionId(event, this.session.phase, newSessionId);
    const result = stepSession(this.session, enriched, world);
    this.session = result.state;
    useSessionStore.getState().setSession(this.session, result.story);

    // Shared only emits stopNarration on session end — clear the playing
    // overlay on every narration end so Pause can't linger as a no-op.
    if (event.type === "narrationEnded") {
      useSessionStore.getState().setOverlay(null);
      this.pauseOwner = null;
      this.deferredInterruptionEnded = false;
    }

    for (const effect of result.effects) {
      if (effect.type === "sessionStarted") {
        pushAudioBreadcrumb("sessionStarted");
      } else if (effect.type === "sessionEnded") {
        pushAudioBreadcrumb("sessionEnded");
      } else if (effect.type === "groveEntered") {
        pushAudioBreadcrumb(`groveEntered ${tail8(effect.groveId)}`);
      } else if (effect.type === "play") {
        pushAudioBreadcrumb(
          `play ${tail8(effect.fragmentId)} ${effect.version.timeWindow}`,
        );
      } else if (effect.type === "showTeaser") {
        pushAudioBreadcrumb(
          `showTeaser ${effect.reason} ${tail8(effect.fragmentId)}`,
        );
      } else if (effect.type === "stopNarration") {
        pushAudioBreadcrumb("stopNarration");
      } else if (effect.type === "writeUnlocks") {
        for (const fragmentId of effect.fragmentIds) {
          pushAudioBreadcrumb(`unlocked ${tail8(fragmentId)}`);
        }
      } else if (effect.type === "recordCompletion") {
        pushAudioBreadcrumb(`completed ${tail8(effect.fragmentId)}`);
      }
      // Step 4b: one diag line after every session effect (logcat evidence).
      this.pushDiagBreadcrumb();
    }
    const queuedAfter = result.state.queued?.fragmentId ?? null;
    if (queuedAfter && queuedAfter !== queuedBefore) {
      pushAudioBreadcrumb(`queued ${tail8(queuedAfter)}`);
    }

    if (event.type === "fix") {
      const at = event.at;
      if (at - this.lastFixAccBreadcrumbAt >= 10_000) {
        this.lastFixAccBreadcrumbAt = at;
        const acc = Math.round(event.accuracyM);
        pushAudioBreadcrumb(`fix acc=${acc}`);
      }
    }

    // C1: start silent session clock when we become exploring
    if (this.session.phase === "exploring" && !wasExploring) {
      this.deps.engine.startSessionClock();
    }

    await applySessionEffects(result.effects, {
      db: this.deps.db,
      nowIso: () => new Date().toISOString(),
      setLocationMode: async (mode) => {
        useSessionStore.getState().setLocationMode(mode);
        // B6: balanced collapses to high inside LocationService
        await this.deps.location.setMode(mode);
      },
      onPlay: async (play) => {
        await this.handlePlayNow(play, result.story);
      },
      onStopNarration: async () => {
        useSessionStore.getState().setOverlay(null);
        this.narrationVoiceId = null;
        await this.directorSessionEffect({ type: "stopNarration" }, result.story);
      },
      onTeaser: (teaser) => useSessionStore.getState().setTeaser(teaser),
      onAfterglow: (afterglow) => useSessionStore.getState().setAfterglow(afterglow),
      onUnlockBanner: () => useSessionStore.getState().setUnlockBanner(true),
      resolveTeaserCopy: (fragmentId, reason) => {
        const meta = this.packed?.meta[fragmentId];
        const teaserText = meta?.teaser ?? "";
        const other =
          reason === "wrongTime"
            ? meta?.narrationByWindow.day?.otherTimeHint ??
              meta?.narrationByWindow.night?.otherTimeHint
            : undefined;
        return { teaserText, otherTimeHint: other };
      },
      onAnalytics: () => useSessionStore.getState().bumpAnalytics(),
    });

    for (const effect of result.effects) {
      if (effect.type === "sessionEnded") {
        await this.onSessionEnded(result.story);
      }
      if (
        effect.type === "stopNarration" ||
        effect.type === "startAfterglow" ||
        effect.type === "groveEntered" ||
        effect.type === "showTeaser"
      ) {
        await this.directorSessionEffect(effect as DirectorSessionEffect, result.story);
      }
    }

    // C1 backup: session tick + afterglow on every accepted fix (GPS may outlive silent gaps)
    if (
      event.type === "fix" &&
      this.session.phase === "exploring" &&
      !this.endingSession
    ) {
      await this.runSessionTimers(event.at);
    }

    // B4: only persist while exploring (or right after a transition that wrote effects)
    if (this.session.phase === "exploring" || result.effects.length > 0) {
      await setKv(this.deps.db, SESSION_KV_KEY, sessionJsonForDisk(this.session));
      await setKv(this.deps.db, DIRECTOR_KV_KEY, directorJsonForDisk(this.director));
    }

    if (
      result.effects.some(
        (e) => e.type === "recordCompletion" || e.type === "writeUnlocks",
      )
    ) {
      await this.reloadPacksNow();
    }
  }

  private async onSessionEnded(story: StoryState): Promise<void> {
    if (this.endingSession) return;
    this.endingSession = true;
    try {
      this.pauseOwner = null;
      this.deferredInterruptionEnded = false;
      // C1: stop silent heartbeats
      this.deps.engine.stopSessionClock();
      // B7: fade-stop narration, end media session, stop location ≤ 5 s
      if (this.deps.engine.stopAll) {
        await this.deps.engine.stopAll(400);
      } else {
        this.deps.engine.pauseNarration();
      }
      await this.deps.engine.getSession().stop();
      useSessionStore.getState().setOverlay(null);
      useSessionStore.getState().resetUi();
      this.narrationVoiceId = null;
      await this.directorSessionEffect(
        { type: "sessionEnded", sessionId: this.session.sessionId ?? "", at: Date.now() },
        story,
      );
      await this.deps.location.setMode("idle");
      await this.deps.location.setMode("foreground");
    } finally {
      this.endingSession = false;
    }
  }

  private stillWantPlay(fragmentId: string): boolean {
    return (
      this.session.phase === "exploring" &&
      this.session.playing?.fragmentId === fragmentId
    );
  }

  private async abandonPlay(
    play: PlayRequest,
    focusAcquired: boolean,
  ): Promise<void> {
    pushAudioBreadcrumb(`play-abandoned ${tail8(play.fragmentId)}`);
    const overlay = useSessionStore.getState().overlay;
    if (
      overlay?.fragmentId === play.fragmentId &&
      this.session.playing?.fragmentId !== play.fragmentId
    ) {
      useSessionStore.getState().setOverlay(null);
    }
    // Defense in depth: release focus/notification if start won a race with stop.
    if (focusAcquired && this.session.phase !== "exploring") {
      try {
        await this.deps.engine.getSession().stop();
      } catch {
        // best-effort
      }
    }
  }

  private async handlePlayNow(play: PlayRequest, story: StoryState): Promise<void> {
    const meta = this.packed?.meta[play.fragmentId];
    const asset = meta?.narrationByWindow[play.version.timeWindow];
    const title = asset?.title ?? "";
    const tier =
      this.packed?.world.fragments.find((f) => f.id === play.fragmentId)?.tier ?? "leaf";

    useSessionStore.getState().setPlayRequest(play);
    useSessionStore.getState().setOverlay({
      title,
      tier,
      progress: 0,
      paused: false,
      fragmentId: play.fragmentId,
    });
    useSessionStore.getState().setTeaser(null);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // G3 best-effort
    }
    if (!this.stillWantPlay(play.fragmentId)) {
      await this.abandonPlay(play, false);
      return;
    }

    const audioSession = this.deps.engine.getSession();
    let focusAcquired = audioSession.isStarted();
    if (!audioSession.isStarted()) {
      const ok = await audioSession.start({ title, artist: "InTell" });
      pushAudioBreadcrumb(`handlePlay:start ok=${ok} title=${title}`);
      if (!this.stillWantPlay(play.fragmentId)) {
        await this.abandonPlay(play, ok);
        return;
      }
      // F2: focus denied — pause UI, do not hand the director a playing narration.
      if (!ok) {
        await this.dispatchNow({ type: "narrationPaused", at: Date.now() });
        useSessionStore.getState().setOverlay({
          title,
          tier,
          progress: 0,
          paused: true,
          fragmentId: play.fragmentId,
          busyHint: strings.audioBusyTap,
        });
        return;
      }
      focusAcquired = true;
    } else {
      await audioSession.update({ title, artist: "InTell" }, "playing");
      if (!this.stillWantPlay(play.fragmentId)) {
        await this.abandonPlay(play, true);
        return;
      }
      await audioSession.userPlay();
      if (!this.stillWantPlay(play.fragmentId)) {
        await this.abandonPlay(play, true);
        return;
      }
    }

    pushAudioBreadcrumb(
      `handlePlay:directorPlay fragment=${tail8(play.fragmentId)}`,
    );
    await this.directorSessionEffect(
      {
        type: "play",
        fragmentId: play.fragmentId,
        revisionNo: play.revisionNo,
        sha: asset?.sha,
        title,
        breathPointsMs: asset?.breathPointsMs,
        durationMs: asset?.durationMs,
      },
      story,
    );
    void focusAcquired;
  }

  private async directorSessionEffect(
    effect: DirectorSessionEffect,
    story: StoryState,
  ): Promise<void> {
    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const audioSec = this.safeAudioSec();
    const wallAtMs = Date.now();
    const first = directorStep(
      this.director,
      { type: "story", story, audioSec, wallAtMs },
      world,
    );
    this.director = first.state;
    const second = directorStep(
      this.director,
      { type: "sessionEffect", effect, audioSec, wallAtMs },
      world,
    );
    this.director = second.state;
    // MOB-2: apply every step's commands (matches admin Simulator).
    await this.applyCommands([...first.commands, ...second.commands]);
    if (this.session.phase === "exploring") {
      await setKv(this.deps.db, DIRECTOR_KV_KEY, directorJsonForDisk(this.director));
    }
  }

  private async applyCommands(
    commands: Parameters<typeof applyDirectorCommands>[0],
  ): Promise<void> {
    try {
      this.voices = await applyDirectorCommands(
        commands,
        {
          // ExploringEngine widens onRemoteCommand; director only needs AudioEngine mix APIs.
          engine: this.deps.engine as Parameters<
            typeof applyDirectorCommands
          >[1]["engine"],
          resolveUri: (sha) => this.packed?.assetUris[sha] ?? null,
          setNowPlaying: (title) => {
            void this.deps.engine.getSession().update({ title, artist: "InTell" }, "playing");
          },
          onHapticTrigger: undefined,
          onAssetFailed: (sha) => this.reportAssetFailed(sha),
        },
        this.voices,
      );
      // RC6: track the *engine* voice id (not the director command id).
      const playCmd = [...commands].reverse().find((c) => c.type === "playNarration");
      if (playCmd && playCmd.type === "playNarration") {
        const voice = this.voices.get(playCmd.id) as { id: string } | undefined;
        if (voice?.id) this.narrationVoiceId = voice.id;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed";
      pushAudioBreadcrumb(`applyCommands ${message}`);
      const sha =
        e && typeof e === "object" && "sha" in e
          ? String((e as { sha: string }).sha)
          : null;
      if (sha) await this.reportAssetFailed(sha);
    }
  }

  private async reportAssetFailed(sha: string): Promise<void> {
    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const result = directorStep(
      this.director,
      {
        type: "assetFailed",
        sha,
        audioSec: this.safeAudioSec(),
        wallAtMs: Date.now(),
      },
      world,
    );
    this.director = result.state;
    await this.applyCommands(result.commands);
  }

  private safeAudioSec(): number {
    try {
      return this.deps.engine.getContextCurrentTime();
    } catch {
      return this.lastHeartbeatAudioSec;
    }
  }

  /**
   * Session tick + afterglow drain (C1). Used by the audio clock and as a
   * backup on every accepted location fix.
   */
  private async runSessionTimers(at: number): Promise<void> {
    if (this.disposed || this.session.phase !== "exploring") return;
    await this.dispatchNow({ type: "tick", at });
    if (
      this.session.afterglowEndsAt !== null &&
      at >= this.session.afterglowEndsAt
    ) {
      await this.dispatchNow({ type: "afterglowElapsed", at });
      useSessionStore.getState().setAfterglow(null);
      useSessionStore.getState().setUnlockBanner(false);
    }
  }

  /** B4 / C1: engine audio-clock tick — session tick + director heartbeat while exploring. */
  private async onAudioClockNow(audioSec: number): Promise<void> {
    if (this.disposed || this.session.phase !== "exploring") return;
    this.lastHeartbeatAudioSec = audioSec;
    const at = Date.now();

    await this.runSessionTimers(at);

    // Step 4b: while exploring or narration is live, one `diag` line every 5 s.
    const narrLive =
      this.session.playing != null && this.session.playing.pausedAt === null;
    if (
      (this.session.phase === "exploring" || narrLive) &&
      at - this.lastDiagBreadcrumbAt >= 5_000
    ) {
      this.lastDiagBreadcrumbAt = at;
      this.pushDiagBreadcrumb();
    }

    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const result = directorStep(
      this.director,
      {
        type: "heartbeat",
        audioSec,
        wallAtMs: at,
      },
      world,
    );
    this.director = result.state;
    await this.applyCommands(result.commands);
  }

  private async onVoiceEndedNow(e: {
    voiceId: string;
    kind: string;
    reason: "ended" | "cancelled";
  }): Promise<void> {
    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const audioSec = this.safeAudioSec();
    const wallAtMs = Date.now();

    if (e.kind !== "heartbeat") {
      const voiceKind =
        e.kind === "narration"
          ? ("narration" as const)
          : e.kind === "oneshot"
            ? ("accent" as const)
            : e.kind === "bed"
              ? ("bed" as const)
              : e.kind === "stem"
                ? ("stem" as const)
                : ("moment" as const);
      const dir = directorStep(
        this.director,
        {
          type: "voiceEnded",
          voiceId: e.voiceId,
          kind: voiceKind,
          audioSec,
          wallAtMs,
        },
        world,
      );
      this.director = dir.state;
      await this.applyCommands(dir.commands);
    }

    // RC6: replacements report "cancelled" and must not end the session's
    // narration (unless we are tearing down the exploring session). Natural
    // "ended" completes even if narrationVoiceId lagged the engine (sync
    // onended during playNarration) — the engine contract is that only a true
    // natural end uses "ended".
    if (e.kind !== "narration" || !this.session.playing) return;
    if (e.reason === "cancelled") {
      if (!this.endingSession) return;
      if (
        this.narrationVoiceId != null &&
        e.voiceId !== this.narrationVoiceId
      ) {
        return;
      }
    } else if (
      this.narrationVoiceId != null &&
      e.voiceId !== this.narrationVoiceId
    ) {
      // Stale "ended" from a swept/replaced id — ignore.
      return;
    }

    const playedMs = Math.max(
      0,
      this.director.narration.positionMs ||
        (this.session.playing
          ? Date.now() -
            this.session.playing.startedAt -
            this.session.playing.pausedTotalMs
          : 0),
    );
    const reason =
      e.reason === "ended"
        ? "natural"
        : this.endingSession
          ? "stopped"
          : "interrupted";
    this.narrationVoiceId = null;
    await this.dispatchNow({
      type: "narrationEnded",
      at: Date.now(),
      reason,
      playedMs,
    });
  }

  private async onNarrationProgressNow(p: {
    positionMs: number;
    durationMs: number;
  }): Promise<void> {
    if (!this.packed || this.session.phase !== "exploring") return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const result = directorStep(
      this.director,
      {
        type: "narrationProgress",
        positionMs: p.positionMs,
        durationMs: p.durationMs,
        audioSec: this.safeAudioSec(),
        wallAtMs: Date.now(),
      },
      world,
    );
    this.director = result.state;
    // MOB-2: apply progress-step commands (preloads / M7 stems).
    await this.applyCommands(result.commands);
    if (result.commands.length > 0 && this.session.phase === "exploring") {
      await setKv(this.deps.db, DIRECTOR_KV_KEY, directorJsonForDisk(this.director));
    }
    const overlay = useSessionStore.getState().overlay;
    if (overlay && p.durationMs > 0) {
      useSessionStore.getState().setOverlay({
        ...overlay,
        progress: Math.min(1, p.positionMs / p.durationMs),
      });
    }
  }

  private async onInterruptionNow(phase: "began" | "ended"): Promise<void> {
    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const audioSec = this.safeAudioSec();
    const wallAtMs = Date.now();

    if (phase === "began") {
      // B3 guard: only pause session when something is playing
      if (this.session.playing && this.session.playing.pausedAt === null) {
        await this.dispatchNow({ type: "narrationPaused", at: Date.now() });
        const overlay = useSessionStore.getState().overlay;
        if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: true });
      }
      // Ownership: becoming-noisy / userPaused → listener; focus loss → system.
      // Never overwrite an existing listener pause with system.
      if (this.pauseOwner !== "listener") {
        const mode = this.deps.engine.getSession().getMode();
        if (mode === "noisyPaused" || mode === "userPaused") {
          this.pauseOwner = "listener";
        } else {
          this.pauseOwner = "system";
        }
      }
      const result = directorStep(
        this.director,
        {
          type: "interruption",
          phase: "began",
          shouldResume: true,
          audioSec,
          wallAtMs,
        },
        world,
      );
      this.director = result.state;
      // Focus path already fade-suspended the engine (B·S3); don't double-pause.
      await this.applyCommands(
        result.commands.filter((c) => c.type !== "suspend" && c.type !== "resume"),
      );
      return;
    }

    // ended
    if (this.pauseOwner === "listener") {
      // Defer remount until the listener resumes — remount-while-paused starts audio.
      this.deferredInterruptionEnded = true;
      return;
    }
    // Listener resume may already have applied the director step (userPlay → ended
    // enqueued behind togglePause). Skip a second remount.
    if (!this.director.suspended && !this.deferredInterruptionEnded) {
      return;
    }
    this.deferredInterruptionEnded = false;
    await this.applyInterruptionEndedDirector(world, audioSec, wallAtMs);
    if (this.session.playing && this.session.playing.pausedAt !== null) {
      await this.dispatchNow({ type: "narrationResumed", at: Date.now() });
      const overlay = useSessionStore.getState().overlay;
      if (overlay) {
        useSessionStore.getState().setOverlay({
          ...overlay,
          paused: false,
          busyHint: undefined,
        });
      }
    }
    this.pauseOwner = null;
  }

  private async applyDeferredInterruptionEndedIfNeeded(): Promise<void> {
    if (!this.deferredInterruptionEnded && !this.director.suspended) return;
    this.deferredInterruptionEnded = false;
    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    await this.applyInterruptionEndedDirector(
      world,
      this.safeAudioSec(),
      Date.now(),
    );
  }

  private async applyInterruptionEndedDirector(
    world: ReturnType<typeof buildM6DirectorWorld>,
    audioSec: number,
    wallAtMs: number,
  ): Promise<void> {
    const result = directorStep(
      this.director,
      {
        type: "interruption",
        phase: "ended",
        shouldResume: true,
        audioSec,
        wallAtMs,
      },
      world,
    );
    this.director = result.state;
    // F3: focus path owns resumeAfterFade; filter director resume to avoid a double resume.
    // Keep playNarration remounts (resume at last breath point — R1 tuning later).
    await this.applyCommands(
      result.commands.filter(
        (c) => c.type !== "suspend" && c.type !== "resume",
      ),
    );
  }

  private async onRouteNow(route: AudioRoute): Promise<void> {
    if (!this.packed) return;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const result = directorStep(
      this.director,
      {
        type: "settings",
        settings: { route },
        audioSec: this.safeAudioSec(),
        wallAtMs: Date.now(),
      },
      world,
    );
    this.director = result.state;
    await this.applyCommands(result.commands);
  }

  /** B5: Day/Night from region sun reference. */
  private async dispatchWindowIfNeeded(at: number, force: boolean): Promise<void> {
    if (!this.packed?.sunReference || !this.packed.timeZone) return;
    const window = currentTimeWindow(
      new Date(at),
      this.packed.sunReference,
      this.packed.timeZone,
    );
    if (!force && window === this.lastWindow) return;
    if (window === this.lastWindow && !force) return;
    const prev = this.lastWindow;
    this.lastWindow = window;
    if (this.packed) {
      this.packed = {
        ...this.packed,
        world: { ...this.packed.world, timeWindow: window },
      };
    }
    if (force && prev === null) {
      // First computation — still dispatch so the machine has the window
    }
    if (prev !== null || force) {
      await this.dispatchNow({ type: "windowChanged", at, timeWindow: window });
    }
  }
}
