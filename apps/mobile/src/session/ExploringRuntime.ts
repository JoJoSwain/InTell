/**
 * Wires session shell, effects, location, director, and audio-session (M6 steps 1–6).
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Haptics from "expo-haptics";
import { randomUUID } from "expo-crypto";
import {
  DIRECTOR_HEARTBEAT_SEC,
  backSkipMs,
  directorStep,
  initialDirectorState,
  localDayKey,
  type DirectorSessionEffect,
  type DirectorState,
  type SessionEvent,
  type SessionState,
  type StoryState,
} from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import { getKv, listAssets, listCompletions, listPacks, listUnlocks, setKv } from "../db/repos";
import type { LocationService } from "../location/LocationService";
import type { AudioSessionController } from "../audio/session/AudioSessionController";
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

function newSessionId(): string {
  return randomUUID();
}

export type ExploringRuntimeDeps = {
  db: SqlDriver;
  location: LocationService;
  audioSession: AudioSessionController;
  /** Optional engine; when absent, play effects still update UI / director state. */
  engine?: Parameters<typeof applyDirectorCommands>[1]["engine"];
};

export class ExploringRuntime {
  private session: SessionState = loadSessionState(null);
  private director: DirectorState;
  private packed: PackedSession | null = null;
  private settings: ExploringSettings = { ...DEFAULT_EXPLORING_SETTINGS };
  private appSub: { remove: () => void } | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private voices = new Map();
  private disposed = false;

  constructor(private readonly deps: ExploringRuntimeDeps) {
    this.director = initialDirectorState({
      seed: 1,
      wallAtMs: Date.now(),
      dayKey: localDayKey(new Date(), "UTC"),
    });
    this.director = { ...this.director, settings: m6DirectorSettings() };
  }

  async start(): Promise<void> {
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

    this.deps.audioSession.setRemoteHandler(async (command) => {
      if (command === "pause") {
        await this.dispatch({ type: "narrationPaused", at: Date.now() });
        await this.deps.audioSession.userPause();
        const overlay = useSessionStore.getState().overlay;
        if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: true });
        return;
      }
      if (command === "play") {
        await this.dispatch({ type: "narrationResumed", at: Date.now() });
        await this.deps.audioSession.userPlay();
        const overlay = useSessionStore.getState().overlay;
        if (overlay) useSessionStore.getState().setOverlay({ ...overlay, paused: false });
        return;
      }
      if (command === "skipBack") {
        this.skipBack();
      }
    });

    this.appSub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void this.deps.location.onAppBecameActive();
    });

    // Foreground watch when idle (puck / grove entry)
    if (this.session.phase === "idle") {
      await this.deps.location.setMode("foreground");
    } else if (this.isAppActive()) {
      await this.deps.location.setMode("balanced");
    } else {
      // R2: exploring after background restart — wait for active; ticks still end session
      await this.deps.location.setMode("foreground");
    }

    this.heartbeat = setInterval(() => {
      void this.onHeartbeat();
    }, DIRECTOR_HEARTBEAT_SEC * 1000);
  }

  dispose(): void {
    this.disposed = true;
    this.appSub?.remove();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.deps.location.setFixListener(null);
  }

  private isAppActive(): boolean {
    return AppState.currentState === "active";
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
    const packs = await listPacks(this.deps.db);
    const completions = (await listCompletions(this.deps.db)).map((row) => ({
      fragmentId: row.fragment_id,
      revisionNo: row.revision_no,
      timeWindow: row.time_window as "day" | "night",
      onSite: row.on_site === 1,
    }));
    const unlocks = (await listUnlocks(this.deps.db)).map((row) => ({
      fragmentId: row.fragment_id,
    }));
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
    if (!overlay) return;
    if (overlay.paused) {
      await this.dispatch({ type: "narrationResumed", at: Date.now() });
      await this.deps.audioSession.userPlay();
      useSessionStore.getState().setOverlay({ ...overlay, paused: false });
    } else {
      await this.dispatch({ type: "narrationPaused", at: Date.now() });
      await this.deps.audioSession.userPause();
      useSessionStore.getState().setOverlay({ ...overlay, paused: true });
    }
  }

  skipBack(): void {
    const position = this.director.narration.positionMs;
    const next = backSkipMs(position);
    // Engine seek if available; director progress updates on next narrationProgress.
    const engine = this.deps.engine as
      | { seekNarration?: (ms: number) => void }
      | undefined;
    engine?.seekNarration?.(next);
  }

  async dispatch(event: SessionEvent): Promise<void> {
    if (this.disposed) return;
    if (!this.packed) await this.reloadPacks();
    if (!this.packed) return;

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

    await applySessionEffects(result.effects, {
      db: this.deps.db,
      nowIso: () => new Date().toISOString(),
      setLocationMode: async (mode) => {
        useSessionStore.getState().setLocationMode(mode);
        await this.deps.location.setMode(mode);
      },
      onPlay: async (play) => {
        await this.handlePlay(play, result.story);
      },
      onStopNarration: async () => {
        useSessionStore.getState().setOverlay(null);
        await this.deps.audioSession.userPause();
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

    // Forward session effects the director cares about
    for (const effect of result.effects) {
      if (
        effect.type === "play" ||
        effect.type === "stopNarration" ||
        effect.type === "startAfterglow" ||
        effect.type === "groveEntered" ||
        effect.type === "showTeaser" ||
        effect.type === "sessionEnded"
      ) {
        // play handled in onPlay with enrichment
        if (effect.type === "play") continue;
        await this.directorSessionEffect(effect as DirectorSessionEffect, result.story);
      }
    }

    await setKv(this.deps.db, SESSION_KV_KEY, sessionJsonForDisk(this.session));
    await setKv(this.deps.db, DIRECTOR_KV_KEY, directorJsonForDisk(this.director));

    // Refresh pack-derived completions after writes
    if (result.effects.some((e) => e.type === "recordCompletion" || e.type === "writeUnlocks")) {
      await this.reloadPacks();
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
      // G3: haptic best-effort
    }

    if (!this.deps.audioSession.isStarted()) {
      await this.deps.audioSession.start({ title, artist: "InTell" });
    } else {
      await this.deps.audioSession.update({ title, artist: "InTell" }, "playing");
      await this.deps.audioSession.userPlay();
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
    const audioSec = this.director.audioClockSec;
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
    if (this.deps.engine) {
      this.voices = await applyDirectorCommands(
        next.commands,
        {
          engine: this.deps.engine,
          resolveUri: (sha) => this.packed?.assetUris[sha] ?? null,
          setNowPlaying: (title) => {
            void this.deps.audioSession.update({ title, artist: "InTell" }, "playing");
          },
        },
        this.voices,
      );
    }
    await setKv(this.deps.db, DIRECTOR_KV_KEY, directorJsonForDisk(this.director));
  }

  private async onHeartbeat(): Promise<void> {
    if (!this.packed) return;
    await this.dispatch({ type: "tick", at: Date.now() });
    if (this.session.afterglowEndsAt && Date.now() >= this.session.afterglowEndsAt) {
      await this.dispatch({ type: "afterglowElapsed", at: Date.now() });
      useSessionStore.getState().setAfterglow(null);
      useSessionStore.getState().setUnlockBanner(false);
    }
    const groveId =
      this.session.currentGroveId ?? this.packed.world.groves[0]?.id ?? "unknown";
    const world = buildM6DirectorWorld(this.packed, groveId);
    const result = directorStep(
      this.director,
      {
        type: "heartbeat",
        audioSec: this.director.audioClockSec + DIRECTOR_HEARTBEAT_SEC,
        wallAtMs: Date.now(),
      },
      world,
    );
    this.director = result.state;
    if (this.deps.engine) {
      this.voices = await applyDirectorCommands(
        result.commands,
        {
          engine: this.deps.engine,
          resolveUri: (sha) => this.packed?.assetUris[sha] ?? null,
        },
        this.voices,
      );
    }
  }
}
