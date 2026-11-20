import {
  type AudioEngine,
  type AudioRoute,
  type BufferHandle,
  type BusId,
  type EngineDiagnostics,
  type LoopGroupHandle,
  type NowPlayingMeta,
  type VoiceHandle,
  DuckingPolicy,
  dbToGain,
  equalPowerCrossfade,
} from "@intell/shared";
import {
  AudioContext,
  AudioManager,
  PlaybackNotificationManager,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type AudioEventSubscription,
  type GainNode,
} from "react-native-audio-api";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { BufferLruCache } from "./lruCache";
import { classifyRoute, isSpeakerLike } from "./routeMap";

type RouteChangeEvent = {
  reason:
    | "Unknown"
    | "Override"
    | "CategoryChange"
    | "WakeFromSleep"
    | "NewDeviceAvailable"
    | "OldDeviceUnavailable"
    | "ConfigurationChange"
    | "NoSuitableRouteForCategory";
};

type Unsubscribe = () => void;

interface InternalBuffer extends BufferHandle {
  buffer: AudioBuffer;
}

interface VoiceState {
  id: string;
  kind: "narration" | "oneshot" | "bed";
  bus: BusId;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAtContextTime: number;
  offsetSec: number;
  durationMs: number;
  paused: boolean;
  pauseOffsetSec: number;
  buffer: AudioBuffer;
  meta?: NowPlayingMeta;
  loopStartSec: number;
  loopEndSec: number;
  looping: boolean;
}

interface LoopGroupState {
  id: string;
  bus: BusId;
  stemCount: number;
  stems: {
    source: AudioBufferSourceNode;
    gain: GainNode;
    buffer: AudioBuffer;
    loopStartSec: number;
    loopEndSec: number;
  }[];
  startedAtContextTime: number;
}

let nextId = 1;
function id(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function rampGain(
  param: GainNode["gain"],
  context: AudioContext,
  target: number,
  rampMs: number,
): void {
  const now = context.currentTime;
  const safe = Math.max(target, 0.0001);
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(param.value, 0.0001), now);
  if (rampMs <= 0) {
    param.setValueAtTime(safe, now);
    return;
  }
  param.linearRampToValueAtTime(safe, now + rampMs / 1000);
}

/**
 * Mobile AudioEngine backed by react-native-audio-api (M1 spike).
 * UI code must import this only through the AudioEngine interface.
 */
export class RNAudioApiEngine implements AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<BusId, GainNode>> = {};
  private cache: BufferLruCache | null = null;
  private voices = new Map<string, VoiceState>();
  private loops = new Map<string, LoopGroupState>();
  private buffers = new Map<string, InternalBuffer>();

  private route: AudioRoute = "unknown";
  private appState: AppStateStatus =
    (AppState.currentState as AppStateStatus | null) ?? "active";
  private notificationVisible = false;
  private narrationActive = false;
  private mixWallStartMs: number | null = null;
  private mixContextStartSec: number | null = null;
  private initWallMs = 0;

  private routeSubs = new Set<(r: AudioRoute) => void>();
  private interruptionSubs = new Set<(e: "began" | "ended") => void>();
  private progressSubs = new Set<
    (p: { positionMs: number; durationMs: number }) => void
  >();
  private remoteSubs = new Set<
    (c: "play" | "pause" | "skipForward" | "skipBackward" | "next") => void
  >();
  private appStateSubs = new Set<(state: AppStateStatus) => void>();
  private notificationSubs = new Set<(visible: boolean) => void>();
  private voiceEndedSubs = new Set<
    (e: {
      voiceId: string;
      kind: VoiceState["kind"];
      appState: string;
      reason: "ended" | "cancelled";
    }) => void
  >();
  /** Voice ids stopped via stop() / cancelScheduledOneShots (not natural end). */
  private cancelledVoiceIds = new Set<string>();

  private systemSubs: AudioEventSubscription[] = [];
  private notifSubs: AudioEventSubscription[] = [];
  private appStateSub: { remove: () => void } | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  /** Last raw getDevicesInfo payload (logged on routeChange). */
  lastDevicesInfo: unknown = null;

  async init(opts: { mixWithOthers: false }): Promise<void> {
    void opts;
    if (this.context) return;

    AudioManager.setSystemOptions({
      ios: { category: "playback", mode: "default" },
    });
    AudioManager.observeAudioInterruptions("gain");

    if (Platform.OS === "android") {
      try {
        await AudioManager.requestNotificationPermissions();
      } catch {
        // permission prompt may fail on older APIs; continue
      }
    }

    const context = new AudioContext({ latencyHint: "playback" });
    await context.resume();

    const master = context.createGain();
    master.gain.value = 1;
    master.connect(context.destination);

    const busIds: BusId[] = ["story", "music", "surroundings", "ui"];
    const buses: Partial<Record<BusId, GainNode>> = {};
    for (const bus of busIds) {
      const g = context.createGain();
      g.gain.value = dbToGain(DuckingPolicy.BUS_DEFAULT_DB[bus]);
      g.connect(master);
      buses[bus] = g;
    }

    this.context = context;
    this.master = master;
    this.buses = buses;
    this.cache = new BufferLruCache(context.sampleRate);
    this.initWallMs = Date.now();
    this.disposed = false;

    await this.refreshRoute({ logRaw: true });

    this.systemSubs.push(
      AudioManager.addSystemEventListener("routeChange", (e) => {
        void this.onRouteChangeEvent(e);
      })!,
    );
    this.systemSubs.push(
      AudioManager.addSystemEventListener("interruption", (e) => {
        void this.onInterruptionEvent(e);
      })!,
    );

    this.wireRemoteCommands();

    this.appStateSub = AppState.addEventListener("change", (next) => {
      this.appState = next;
      for (const cb of this.appStateSubs) cb(next);
    });

    this.progressTimer = setInterval(() => this.emitNarrationProgress(), 500);
  }

  /**
   * Call once at the start of a full-mix run: resume if suspended, then reset
   * the wall/context clock baseline so clockGapMs is not carried over.
   */
  async prepareMixStart(): Promise<void> {
    const ctx = this.requireContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    this.mixWallStartMs = Date.now();
    this.mixContextStartSec = ctx.currentTime;
  }

  onAppStateChange(cb: (state: AppStateStatus) => void): Unsubscribe {
    this.appStateSubs.add(cb);
    return () => this.appStateSubs.delete(cb);
  }

  onNotificationVisibilityChange(cb: (visible: boolean) => void): Unsubscribe {
    this.notificationSubs.add(cb);
    return () => this.notificationSubs.delete(cb);
  }

  /** Fires when a BufferSource ends — including while the screen is locked. */
  onVoiceEnded(
    cb: (e: {
      voiceId: string;
      kind: VoiceState["kind"];
      appState: string;
      reason: "ended" | "cancelled";
    }) => void,
  ): Unsubscribe {
    this.voiceEndedSubs.add(cb);
    return () => this.voiceEndedSubs.delete(cb);
  }

  getContextCurrentTime(): number {
    return this.requireContext().currentTime;
  }

  getAppState(): AppStateStatus {
    return this.appState;
  }

  /** Stop every one-shot voice (pending future starts and in-flight). */
  cancelScheduledOneShots(): void {
    for (const voice of [...this.voices.values()]) {
      if (voice.kind !== "oneshot") continue;
      this.cancelledVoiceIds.add(voice.id);
      try {
        voice.source.stop();
      } catch {
        // Never started or already stopped — emit cancelled immediately.
        this.voices.delete(voice.id);
        this.emitVoiceEnded(voice.id, voice.kind);
      }
    }
  }

  async load(sha: string, uri: string): Promise<BufferHandle> {
    this.requireContext();
    const cache = this.requireCache();
    const cached = cache.get(sha);
    if (cached) {
      const handle: InternalBuffer = {
        sha,
        durationMs: cached.duration * 1000,
        buffer: cached,
      };
      this.buffers.set(sha, handle);
      return { sha, durationMs: handle.durationMs };
    }

    // uri may be a file path, remote URL, or Metro asset module id (number as string).
    const input: string | number = /^\d+$/.test(uri) ? Number(uri) : uri;
    const buffer = await this.context!.decodeAudioData(input);
    cache.set(sha, buffer);
    const handle: InternalBuffer = {
      sha,
      durationMs: buffer.duration * 1000,
      buffer,
    };
    this.buffers.set(sha, handle);
    return { sha, durationMs: handle.durationMs };
  }

  playNarration(
    h: BufferHandle,
    meta: NowPlayingMeta,
    startAtMs?: number,
  ): VoiceHandle {
    const ctx = this.requireContext();
    const internal = this.requireBuffer(h.sha);
    this.stopNarrationInternal(0);

    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.buses.story!);

    const source = ctx.createBufferSource();
    source.buffer = internal.buffer;
    source.connect(gain);

    const offsetSec = Math.max(0, (startAtMs ?? 0) / 1000);
    const when = ctx.currentTime;
    source.start(when, offsetSec);

    const voice: VoiceState = {
      id: id("narration"),
      kind: "narration",
      bus: "story",
      source,
      gain,
      startedAtContextTime: when,
      offsetSec,
      durationMs: internal.durationMs,
      paused: false,
      pauseOffsetSec: offsetSec,
      buffer: internal.buffer,
      meta,
      loopStartSec: 0,
      loopEndSec: internal.buffer.duration,
      looping: false,
    };
    this.voices.set(voice.id, voice);
    this.narrationActive = true;
    this.applyDucking(DuckingPolicy.DUCK_ATTACK_MS);
    void this.showNotification(meta, "playing", offsetSec * 1000, internal.durationMs);

    source.onended = () => {
      this.voices.delete(voice.id);
      this.emitVoiceEnded(voice.id, voice.kind);
      if (![...this.voices.values()].some((v) => v.kind === "narration")) {
        this.narrationActive = false;
        this.applyDucking(DuckingPolicy.DUCK_RELEASE_MS);
      }
    };

    return { id: voice.id };
  }

  pauseNarration(): void {
    // Lock-screen / API pause suspends the whole AudioContext (review §6.5).
    void this.suspendMix("pause");
  }

  resumeNarration(): void {
    void this.resumeMix("play");
  }

  playOneShot(
    h: BufferHandle,
    p: {
      bus: BusId;
      gainDb: number;
      pan: number;
      rate: number;
      whenSec?: number;
    },
  ): VoiceHandle {
    const ctx = this.requireContext();
    const internal = this.requireBuffer(h.sha);
    const bus = this.buses[p.bus];
    if (!bus) throw new Error(`Unknown bus ${p.bus}`);

    const gain = ctx.createGain();
    gain.gain.value = dbToGain(p.gainDb);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, p.pan));
    gain.connect(panner);
    panner.connect(bus);

    const source = ctx.createBufferSource();
    source.buffer = internal.buffer;
    source.playbackRate.value = p.rate;
    source.connect(gain);

    const when =
      p.whenSec != null ? Math.max(p.whenSec, ctx.currentTime) : ctx.currentTime;
    source.start(when);

    const voice: VoiceState = {
      id: id("oneshot"),
      kind: "oneshot",
      bus: p.bus,
      source,
      gain,
      startedAtContextTime: when,
      offsetSec: 0,
      durationMs: internal.durationMs / Math.max(p.rate, 0.01),
      paused: false,
      pauseOffsetSec: 0,
      buffer: internal.buffer,
      loopStartSec: 0,
      loopEndSec: internal.buffer.duration,
      looping: false,
    };
    this.voices.set(voice.id, voice);
    source.onended = () => {
      this.voices.delete(voice.id);
      this.emitVoiceEnded(voice.id, voice.kind);
    };
    return { id: voice.id };
  }

  startLoopGroup(
    bus: BusId,
    stems: {
      h: BufferHandle;
      gainDb: number;
      loopStartMs: number;
      loopEndMs: number;
    }[],
  ): LoopGroupHandle {
    const ctx = this.requireContext();
    const busNode = this.buses[bus];
    if (!busNode) throw new Error(`Unknown bus ${bus}`);

    const when = ctx.currentTime + 0.05;
    const groupId = id("loop");
    const stemStates: LoopGroupState["stems"] = [];

    for (const stem of stems) {
      const internal = this.requireBuffer(stem.h.sha);
      const gain = ctx.createGain();
      gain.gain.value = dbToGain(stem.gainDb);
      gain.connect(busNode);

      const source = ctx.createBufferSource();
      source.buffer = internal.buffer;
      source.loop = true;
      source.loopStart = stem.loopStartMs / 1000;
      source.loopEnd = stem.loopEndMs / 1000;
      source.connect(gain);
      // Shared startTime keeps stems sample-aligned.
      source.start(when, stem.loopStartMs / 1000);

      stemStates.push({
        source,
        gain,
        buffer: internal.buffer,
        loopStartSec: stem.loopStartMs / 1000,
        loopEndSec: stem.loopEndMs / 1000,
      });
    }

    const group: LoopGroupState = {
      id: groupId,
      bus,
      stemCount: stemStates.length,
      stems: stemStates,
      startedAtContextTime: when,
    };
    this.loops.set(groupId, group);
    return { id: groupId, stemCount: stemStates.length };
  }

  crossfadeBed(
    bus: BusId,
    from: VoiceHandle | null,
    to: BufferHandle,
    p: {
      gainDb: number;
      fadeMs: number;
      loopStartMs: number;
      loopEndMs: number;
    },
  ): VoiceHandle {
    const ctx = this.requireContext();
    const busNode = this.buses[bus];
    if (!busNode) throw new Error(`Unknown bus ${bus}`);
    const internal = this.requireBuffer(to.sha);

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(busNode);

    const source = ctx.createBufferSource();
    source.buffer = internal.buffer;
    source.loop = true;
    source.loopStart = p.loopStartMs / 1000;
    source.loopEnd = p.loopEndMs / 1000;
    source.connect(gain);

    const when = ctx.currentTime;
    source.start(when, p.loopStartMs / 1000);

    const fadeSec = Math.max(p.fadeMs, 1) / 1000;
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { fromGain, toGain } = equalPowerCrossfade(t);
      const at = when + fadeSec * t;
      gain.gain.linearRampToValueAtTime(
        Math.max(0.0001, toGain * dbToGain(p.gainDb)),
        at,
      );
      if (from) {
        const fromVoice = this.voices.get(from.id);
        if (fromVoice) {
          fromVoice.gain.gain.linearRampToValueAtTime(
            Math.max(0.0001, fromGain * fromVoice.gain.gain.value),
            at,
          );
        }
      }
    }

    if (from) {
      const fromVoice = this.voices.get(from.id);
      if (fromVoice) {
        const stopAt = when + fadeSec + 0.05;
        try {
          fromVoice.source.stop(stopAt);
        } catch {
          // already stopped
        }
        setTimeout(
          () => this.voices.delete(from.id),
          p.fadeMs + 100,
        );
      }
    }

    const voice: VoiceState = {
      id: id("bed"),
      kind: "bed",
      bus,
      source,
      gain,
      startedAtContextTime: when,
      offsetSec: p.loopStartMs / 1000,
      durationMs: internal.durationMs,
      paused: false,
      pauseOffsetSec: 0,
      buffer: internal.buffer,
      loopStartSec: p.loopStartMs / 1000,
      loopEndSec: p.loopEndMs / 1000,
      looping: true,
    };
    this.voices.set(voice.id, voice);
    return { id: voice.id };
  }

  setGain(
    target: VoiceHandle | LoopGroupHandle | BusId,
    gainDb: number,
    rampMs: number,
  ): void {
    const ctx = this.requireContext();
    const linear = dbToGain(gainDb);

    if (typeof target === "string") {
      const bus = this.buses[target];
      if (!bus) throw new Error(`Unknown bus ${target}`);
      rampGain(bus.gain, ctx, linear, rampMs);
      return;
    }

    if ("stemCount" in target) {
      const group = this.loops.get(target.id);
      if (!group) return;
      for (const stem of group.stems) {
        rampGain(stem.gain.gain, ctx, linear, rampMs);
      }
      return;
    }

    const voice = this.voices.get(target.id);
    if (!voice) return;
    rampGain(voice.gain.gain, ctx, linear, rampMs);
  }

  setStemGain(
    group: LoopGroupHandle,
    index: number,
    gainDb: number,
    rampMs: number,
  ): void {
    const ctx = this.requireContext();
    const g = this.loops.get(group.id);
    if (!g) return;
    const stem = g.stems[index];
    if (!stem) return;
    rampGain(stem.gain.gain, ctx, dbToGain(gainDb), rampMs);
  }

  stop(target: VoiceHandle | LoopGroupHandle, fadeMs: number): void {
    const ctx = this.requireContext();
    if ("stemCount" in target) {
      const group = this.loops.get(target.id);
      if (!group) return;
      const when = ctx.currentTime;
      for (const stem of group.stems) {
        rampGain(stem.gain.gain, ctx, 0, fadeMs);
        try {
          stem.source.stop(when + fadeMs / 1000 + 0.05);
        } catch {
          // ignore
        }
      }
      setTimeout(() => this.loops.delete(target.id), fadeMs + 100);
      return;
    }

    const voice = this.voices.get(target.id);
    if (!voice) return;
    this.cancelledVoiceIds.add(voice.id);
    rampGain(voice.gain.gain, ctx, 0, fadeMs);
    try {
      voice.source.stop(ctx.currentTime + fadeMs / 1000 + 0.05);
    } catch {
      this.voices.delete(voice.id);
      this.emitVoiceEnded(voice.id, voice.kind);
    }
    if (voice.kind === "narration") {
      this.narrationActive = false;
      this.applyDucking(DuckingPolicy.DUCK_RELEASE_MS);
    }
    setTimeout(() => this.voices.delete(target.id), fadeMs + 100);
  }

  onRouteChange(cb: (route: AudioRoute) => void): Unsubscribe {
    this.routeSubs.add(cb);
    return () => this.routeSubs.delete(cb);
  }

  onInterruption(cb: (e: "began" | "ended") => void): Unsubscribe {
    this.interruptionSubs.add(cb);
    return () => this.interruptionSubs.delete(cb);
  }

  onNarrationProgress(
    cb: (p: { positionMs: number; durationMs: number }) => void,
  ): Unsubscribe {
    this.progressSubs.add(cb);
    return () => this.progressSubs.delete(cb);
  }

  onRemoteCommand(
    cb: (
      c: "play" | "pause" | "skipForward" | "skipBackward" | "next",
    ) => void,
  ): Unsubscribe {
    this.remoteSubs.add(cb);
    return () => this.remoteSubs.delete(cb);
  }

  getDiagnostics(): EngineDiagnostics {
    const ctx = this.context;
    const uptimeMs = Date.now() - this.initWallMs;
    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );

    let narrationPositionMs: number | undefined;
    if (narration && ctx) {
      if (narration.paused) {
        narrationPositionMs = narration.pauseOffsetSec * 1000;
      } else {
        narrationPositionMs =
          (narration.offsetSec +
            (ctx.currentTime - narration.startedAtContextTime)) *
          1000;
      }
    }

    const loopGroups = [...this.loops.values()].map((g) => {
      const stemPositionsMs = g.stems.map((stem) => {
        if (!ctx) return 0;
        const elapsed = Math.max(0, ctx.currentTime - g.startedAtContextTime);
        const loopLen = Math.max(
          0.001,
          stem.loopEndSec - stem.loopStartSec,
        );
        const pos =
          stem.loopStartSec + (elapsed % loopLen);
        return pos * 1000;
      });
      return {
        id: g.id,
        stemPositionsMs,
        // Web Audio has no per-source playback position — not measurable.
        maxStemDriftMs: null as number | null,
      };
    });

    let contextTimeMs: number | undefined;
    let wallElapsedMs: number | undefined;
    let clockGapMs: number | undefined;
    if (ctx && this.mixWallStartMs != null && this.mixContextStartSec != null) {
      contextTimeMs = ctx.currentTime * 1000;
      wallElapsedMs = Date.now() - this.mixWallStartMs;
      const contextElapsedMs =
        (ctx.currentTime - this.mixContextStartSec) * 1000;
      clockGapMs = wallElapsedMs - contextElapsedMs;
    }

    return {
      uptimeMs,
      activeVoices: this.voices.size + [...this.loops.values()].reduce(
        (n, g) => n + g.stemCount,
        0,
      ),
      loopGroups,
      narrationPositionMs,
      // underruns: library exposes no signal (review §6.8)
      route: this.route,
      decodedBytes: this.cache?.decodedBytes ?? 0,
      cacheEvictions: this.cache?.cacheEvictions ?? 0,
      contextTimeMs,
      wallElapsedMs,
      clockGapMs,
      contextState: ctx?.state,
      appState: this.appState,
      notificationVisible: this.notificationVisible,
      scheduledAheadMs: this.computeScheduledAheadMs(ctx),
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    this.appStateSub?.remove();
    this.appStateSub = null;
    for (const sub of this.systemSubs) sub.remove();
    this.systemSubs = [];
    for (const sub of this.notifSubs) sub.remove();
    this.notifSubs = [];
    try {
      await PlaybackNotificationManager.hide();
    } catch {
      // ignore
    }
    this.setNotificationVisible(false);

    for (const voice of this.voices.values()) {
      try {
        voice.source.stop();
      } catch {
        // ignore
      }
    }
    this.voices.clear();
    for (const group of this.loops.values()) {
      for (const stem of group.stems) {
        try {
          stem.source.stop();
        } catch {
          // ignore
        }
      }
    }
    this.loops.clear();
    this.cache?.clear();
    this.cache = null;
    this.buffers.clear();

    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // ignore
      }
    }
    this.context = null;
    this.master = null;
    this.buses = {};
  }

  // --- internals -----------------------------------------------------------

  private requireContext(): AudioContext {
    if (!this.context || this.disposed) {
      throw new Error("AudioEngine not initialized");
    }
    return this.context;
  }

  private requireCache(): BufferLruCache {
    if (!this.cache) {
      throw new Error("AudioEngine not initialized");
    }
    return this.cache;
  }

  private requireBuffer(sha: string): InternalBuffer {
    const b = this.buffers.get(sha) ?? (() => {
      const cached = this.requireCache().get(sha);
      if (!cached) return undefined;
      const handle: InternalBuffer = {
        sha,
        durationMs: cached.duration * 1000,
        buffer: cached,
      };
      this.buffers.set(sha, handle);
      return handle;
    })();
    if (!b) throw new Error(`Buffer not loaded: ${sha}`);
    return b;
  }

  private setNotificationVisible(visible: boolean): void {
    if (this.notificationVisible === visible) return;
    this.notificationVisible = visible;
    for (const cb of this.notificationSubs) cb(visible);
  }

  private emitVoiceEnded(voiceId: string, kind: VoiceState["kind"]): void {
    const reason = this.cancelledVoiceIds.has(voiceId) ? "cancelled" : "ended";
    this.cancelledVoiceIds.delete(voiceId);
    const payload = {
      voiceId,
      kind,
      appState: this.appState,
      reason: reason as "ended" | "cancelled",
    };
    for (const cb of this.voiceEndedSubs) cb(payload);
  }

  private computeScheduledAheadMs(ctx: AudioContext | null): number {
    if (!ctx) return 0;
    let maxWhen = 0;
    for (const voice of this.voices.values()) {
      if (voice.kind !== "oneshot") continue;
      if (voice.startedAtContextTime > ctx.currentTime) {
        maxWhen = Math.max(maxWhen, voice.startedAtContextTime);
      }
    }
    if (maxWhen <= 0) return 0;
    return Math.max(0, (maxWhen - ctx.currentTime) * 1000);
  }

  private applyDucking(rampMs: number): void {
    if (!this.context) return;
    const levels = DuckingPolicy.computeDuckingLevels({
      narrationActive: this.narrationActive,
      route: this.route,
    });
    for (const bus of Object.keys(levels.busDb) as BusId[]) {
      const node = this.buses[bus];
      if (!node) continue;
      rampGain(node.gain, this.context, dbToGain(levels.busDb[bus]), rampMs);
    }
  }

  private stopNarrationInternal(fadeMs: number): void {
    for (const voice of [...this.voices.values()]) {
      if (voice.kind !== "narration") continue;
      this.stop({ id: voice.id }, fadeMs);
    }
  }

  private async refreshRoute(opts: { logRaw: boolean }): Promise<AudioRoute> {
    try {
      const info = await AudioManager.getDevicesInfo();
      this.lastDevicesInfo = info;
      if (opts.logRaw) {
        console.log("[audio-spike] getDevicesInfo", JSON.stringify(info));
      }
      this.route = classifyRoute(info);
    } catch (err) {
      console.warn("[audio-spike] getDevicesInfo failed", err);
      this.route = "unknown";
    }
    return this.route;
  }

  private async onRouteChangeEvent(e: RouteChangeEvent): Promise<void> {
    const prev = this.route;
    const next = await this.refreshRoute({ logRaw: true });
    console.log("[audio-spike] routeChange", {
      reason: e.reason,
      prev,
      next,
      raw: this.lastDevicesInfo,
    });

    // Wildlife-safety / platform norm: pause on headphone/BT unplug (review §6.6).
    const lostExternal =
      e.reason === "OldDeviceUnavailable" ||
      (prev !== "speaker" &&
        prev !== "unknown" &&
        isSpeakerLike(next));
    if (lostExternal && (next === "speaker" || next === "unknown")) {
      await this.suspendMix("route-unplug");
    }

    this.applyDucking(300);
    for (const cb of this.routeSubs) cb(next);
  }

  private async onInterruptionEvent(e: {
    type: "began" | "ended";
    shouldResume: boolean;
  }): Promise<void> {
    console.log("[audio-spike] interruption", e);
    for (const cb of this.interruptionSubs) cb(e.type);
    if (e.type === "began") {
      await this.suspendMix("interruption");
      return;
    }
    if (e.shouldResume) {
      setTimeout(() => {
        void this.resumeMix("interruption-ended");
      }, 1000);
    }
  }

  private async suspendMix(reason: string): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;
    console.log("[audio-spike] suspend", reason);
    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );
    if (narration && !narration.paused) {
      narration.pauseOffsetSec =
        narration.offsetSec +
        (ctx.currentTime - narration.startedAtContextTime);
      narration.paused = true;
    }
    try {
      await ctx.suspend();
    } catch (err) {
      console.warn("[audio-spike] suspend failed", err);
    }
    const positionMs = narration
      ? narration.pauseOffsetSec * 1000
      : this.getDiagnostics().narrationPositionMs ?? 0;
    await this.showNotification(
      narration?.meta ?? { title: "InTell audio spike", artist: "Test" },
      "paused",
      positionMs,
      narration?.durationMs ?? 0,
    );
  }

  private async resumeMix(reason: string): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;
    console.log("[audio-spike] resume", reason);
    try {
      await ctx.resume();
    } catch (err) {
      console.warn("[audio-spike] resume failed", err);
    }
    // Suspend/resume keeps scheduled sources; do not recreate nodes.
    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );
    if (narration?.paused) {
      narration.startedAtContextTime = ctx.currentTime;
      narration.offsetSec = narration.pauseOffsetSec;
      narration.paused = false;
    }
    await this.showNotification(
      narration?.meta ?? { title: "InTell audio spike", artist: "Test" },
      "playing",
      (narration?.pauseOffsetSec ?? 0) * 1000,
      narration?.durationMs ?? 0,
    );
  }

  private wireRemoteCommands(): void {
    const map: {
      event:
        | "playbackNotificationPlay"
        | "playbackNotificationPause"
        | "playbackNotificationSkipForward"
        | "playbackNotificationSkipBackward"
        | "playbackNotificationNextTrack";
      cmd: "play" | "pause" | "skipForward" | "skipBackward" | "next";
    }[] = [
      { event: "playbackNotificationPlay", cmd: "play" },
      { event: "playbackNotificationPause", cmd: "pause" },
      { event: "playbackNotificationSkipForward", cmd: "skipForward" },
      { event: "playbackNotificationSkipBackward", cmd: "skipBackward" },
      { event: "playbackNotificationNextTrack", cmd: "next" },
    ];

    for (const { event, cmd } of map) {
      const sub = PlaybackNotificationManager.addEventListener(event, () => {
        if (cmd === "play") void this.resumeMix("remote");
        if (cmd === "pause") void this.suspendMix("remote");
        for (const cb of this.remoteSubs) cb(cmd);
      });
      this.notifSubs.push(sub);
    }
  }

  private async showNotification(
    meta: NowPlayingMeta,
    state: "playing" | "paused",
    elapsedMs: number,
    durationMs: number,
  ): Promise<void> {
    try {
      await PlaybackNotificationManager.show({
        title: meta.title,
        artist: meta.artist,
        artwork: meta.artworkUri,
        duration: durationMs / 1000,
        elapsedTime: elapsedMs / 1000,
        state,
        skipInterval: 10,
      });
      this.setNotificationVisible(true);
    } catch (err) {
      console.warn("[audio-spike] notification show failed", err);
      this.setNotificationVisible(false);
    }
  }

  private emitNarrationProgress(): void {
    const d = this.getDiagnostics();
    if (d.narrationPositionMs == null) return;
    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );
    if (!narration) return;
    for (const cb of this.progressSubs) {
      cb({
        positionMs: d.narrationPositionMs,
        durationMs: narration.durationMs,
      });
    }
    if (this.notificationVisible && narration.meta) {
      void PlaybackNotificationManager.show({
        elapsedTime: d.narrationPositionMs / 1000,
        state: this.context?.state === "running" ? "playing" : "paused",
      });
    }
  }
}
