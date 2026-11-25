/**
 * Wires session shell, effects, location, director, engine, and audio-session (M6 review 1).
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Haptics from "expo-haptics";
import { randomUUID } from "expo-crypto";
import {
  backSkipMs,
  currentTimeWindow,
  directorStep,
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
import { getKv, listAssets, listCompletions, listPacks, listUnlocks, setKv } from "../db/repos";
import type { LocationService } from "../location/LocationService";
import { applyDirectorCommands } from "../audio/director/applyDirectorCommands";
import {
  buildM6DirectorWorld,
  m6DirectorSettings,
} from "../audio/director/m6World";
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

function newSessionId(): string {
  return randomUUID();
}

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

export class ExploringRuntime {
  private session: SessionState = loadSessionState(null);
  private director: DirectorState;
  private packed: PackedSession | null = null;
  private settings: ExploringSettings = { ...DEFAULT_EXPLORING_SETTINGS };
  private appSub: { remove: () => void } | null = null;
  private unsubs: (() => void)[] = [];
  private voices = new Map();
  private disposed = false;
  private narrationVoiceId: string | null = null;
  private lastWindow: TimeWindow | null = null;
  private lastHeartbeatAudioSec = 0;
  private endingSession = false;
  /** Prevents window sync from re-entering dispatch (C2). */
  private inWindowSync = false;

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

  async start(): Promise<void> {
    await this.deps.engine.init({ mixWithOthers: false });
    await this.reloadSettings();
    await this.reloadPacks();
    const sessionRaw = await getKv(this.deps.db, SESSION_KV_KEY);
    const directorRaw = await getKv(this.deps.db, DIRECTOR_KV_KEY);
    this.session = loadSessionState(sessionRaw);
    this.director = loadDirectorState(directorRaw, {
      seed: 1,
      wallAtMs: Date.now(),
      dayKey: localDayKey(new Date(), this.packed?.timeZone ?? "UTC"),
    });
    this.director = { ...this.director, settings: m6DirectorSettings() };
    useSessionStore.getState().setSession(this.session, null);

    this.wireLocation();
    this.wireEngine();
    this.wireAudioSessionRemotes();

    this.appSub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void this.deps.location.onAppBecameActive();
    });

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
  }

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
      void this.dispatch({
        type: "fix",
        at: fix.at,
        lat: fix.lat,
        lng: fix.lng,
        accuracyM: fix.accuracyM,
      });
    });
    this.deps.location.setStopRequestListener(() => {
      void this.dispatch({ type: "stop", at: Date.now() });
    });
  }

  private wireEngine(): void {
    const { engine } = this.deps;
    this.unsubs.push(
      engine.onTick((audioSec) => {
        void this.onAudioClock(audioSec);
      }),
    );
    this.unsubs.push(
      engine.onVoiceEnded((e) => {
        // Return the promise so fake engines can await the full chain in tests.
        return this.onVoiceEnded(e);
      }),
    );
    this.unsubs.push(
      engine.onNarrationProgress((p) => {
        void this.onNarrationProgress(p);
      }),
    );
    this.unsubs.push(
      engine.onInterruption((phase) => {
        void this.onInterruption(phase);
      }),
    );
    this.unsubs.push(
      engine.onRouteChange((route) => {
        void this.onRoute(route);
      }),
    );
  }

  private wireAudioSessionRemotes(): void {
    const session = this.deps.engine.getSession();
    session.setRemoteHandler(async (command) => {
      if (command === "stopExploring") {
        await this.dispatch({ type: "stop", at: Date.now() });
        return;
      }
      if (!this.session.playing) return;
      if (command === "pause") {
        await this.dispatch({ type: "narrationPaused", at: Date.now() });
        const overlay = useSessionStore.getState().overlay;
        if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: true });
        return;
      }
      if (command === "play") {
        await this.dispatch({ type: "narrationResumed", at: Date.now() });
        const overlay = useSessionStore.getState().overlay;
        if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: false });
        return;
      }
      if (command === "skipBack") {
        this.skipBack();
      }
    });
  }

  async reloadSettings(): Promise<void> {
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
    for (const asset of assets) assetUris[asset.sha] = asset.local_uri;
    this.packed = buildPackedSession({
      packs,
      completions,
      unlocks,
      settings: this.settings,
      assetUris,
    });
  }

  async scanCode(code: string): Promise<void> {
    const markerHash = await hashMarkerCode(code);
    await this.dispatch({ type: "scan", at: Date.now(), markerHash });
  }

  async stopExploring(): Promise<void> {
    await this.dispatch({ type: "stop", at: Date.now() });
  }

  async togglePause(): Promise<void> {
    const overlay = useSessionStore.getState().overlay;
    if (!overlay || !this.session.playing) return;
    const session = this.deps.engine.getSession();
    if (overlay.paused) {
      await this.dispatch({ type: "narrationResumed", at: Date.now() });
      await session.userPlay();
      useSessionStore.getState().setOverlay({ ...overlay, paused: false });
    } else {
      await this.dispatch({ type: "narrationPaused", at: Date.now() });
      await session.userPause();
      useSessionStore.getState().setOverlay({ ...overlay, paused: true });
    }
  }

  skipBack(): void {
    const position = this.director.narration.positionMs;
    const next = backSkipMs(position);
    this.deps.engine.seekNarration?.(next);
  }

  /** Inject a location fix (tests / mock GPX). */
  async injectFix(fix: {
    at: number;
    lat: number;
    lng: number;
    accuracyM: number;
  }): Promise<void> {
    await this.dispatch({
      type: "fix",
      at: fix.at,
      lat: fix.lat,
      lng: fix.lng,
      accuracyM: fix.accuracyM,
    });
  }

  /** Simulate engine narration end (tests). */
  async injectNarrationEnded(
    reason: "natural" | "stopped" | "interrupted",
    playedMs: number,
  ): Promise<void> {
    await this.dispatch({
      type: "narrationEnded",
      at: Date.now(),
      reason,
      playedMs,
    });
  }

  async dispatch(event: SessionEvent): Promise<void> {
    if (this.disposed) return;
    if (!this.packed) await this.reloadPacks();
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
        await this.handlePlay(play, result.story);
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
      await this.reloadPacks();
    }
  }

  private async onSessionEnded(story: StoryState): Promise<void> {
    if (this.endingSession) return;
    this.endingSession = true;
    try {
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

  private async handlePlay(play: PlayRequest, story: StoryState): Promise<void> {
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

    const audioSession = this.deps.engine.getSession();
    if (!audioSession.isStarted()) {
      await audioSession.start({ title, artist: "InTell" });
    } else {
      await audioSession.update({ title, artist: "InTell" }, "playing");
      await audioSession.userPlay();
    }

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
    let next = directorStep(
      this.director,
      { type: "story", story, audioSec, wallAtMs },
      world,
    );
    this.director = next.state;
    next = directorStep(
      this.director,
      { type: "sessionEffect", effect, audioSec, wallAtMs },
      world,
    );
    this.director = next.state;
    await this.applyCommands(next.commands);
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
          engine: this.deps.engine,
          resolveUri: (sha) => this.packed?.assetUris[sha] ?? null,
          setNowPlaying: (title) => {
            void this.deps.engine.getSession().update({ title, artist: "InTell" }, "playing");
          },
          onHapticTrigger: undefined,
        },
        this.voices,
      );
      const playCmd = [...commands].reverse().find((c) => c.type === "playNarration");
      if (playCmd && playCmd.type === "playNarration") {
        this.narrationVoiceId = playCmd.id;
      }
    } catch (e) {
      const sha =
        e && typeof e === "object" && "sha" in e
          ? String((e as { sha: string }).sha)
          : null;
      if (sha) await this.reportAssetFailed(sha);
      console.info("director command apply failed");
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
    await this.dispatch({ type: "tick", at });
    if (
      this.session.afterglowEndsAt !== null &&
      at >= this.session.afterglowEndsAt
    ) {
      await this.dispatch({ type: "afterglowElapsed", at });
      useSessionStore.getState().setAfterglow(null);
      useSessionStore.getState().setUnlockBanner(false);
    }
  }

  /** B4 / C1: engine audio-clock tick — session tick + director heartbeat while exploring. */
  private async onAudioClock(audioSec: number): Promise<void> {
    if (this.disposed || this.session.phase !== "exploring") return;
    this.lastHeartbeatAudioSec = audioSec;
    const at = Date.now();

    await this.runSessionTimers(at);

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

  private async onVoiceEnded(e: {
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

    if (e.kind === "narration" && this.session.playing) {
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
      await this.dispatch({
        type: "narrationEnded",
        at: Date.now(),
        reason,
        playedMs,
      });
    }
  }

  private async onNarrationProgress(p: {
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
    const overlay = useSessionStore.getState().overlay;
    if (overlay && p.durationMs > 0) {
      useSessionStore.getState().setOverlay({
        ...overlay,
        progress: Math.min(1, p.positionMs / p.durationMs),
      });
    }
  }

  private async onInterruption(phase: "began" | "ended"): Promise<void> {
    if (!this.packed) return;
    const playing = this.session.playing != null && this.session.playing.pausedAt === null;
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const audioSec = this.safeAudioSec();
    const wallAtMs = Date.now();

    if (phase === "began") {
      // B3 guard: only pause session when something is playing
      if (this.session.playing && this.session.playing.pausedAt === null) {
        await this.dispatch({ type: "narrationPaused", at: Date.now() });
        const overlay = useSessionStore.getState().overlay;
        if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: true });
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
    await this.applyCommands(
      result.commands.filter((c) => c.type !== "suspend"),
    );
    if (this.session.playing && this.session.playing.pausedAt !== null) {
      await this.dispatch({ type: "narrationResumed", at: Date.now() });
      const overlay = useSessionStore.getState().overlay;
      if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: false });
    }
    void playing;
  }

  private async onRoute(route: AudioRoute): Promise<void> {
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
      await this.dispatch({ type: "windowChanged", at, timeWindow: window });
    }
  }
}
