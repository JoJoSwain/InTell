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
  VoiceLedger,
  type VoiceLedgerStats,
  dbToGain,
  equalPowerCrossfade,
} from "@intell/shared";
import {
  AudioContext,
  AudioManager,
  decodeAudioData,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
  type StereoPannerNode,
} from "react-native-audio-api";
import { AppState, type AppStateStatus } from "react-native";
import { BufferLruCache } from "./lruCache";
import { equalPowerCurve, rampGainHeld } from "./gainAutomation";
import {
  AudioSessionController,
  shouldDemoteSessionOnSuspend,
  type FocusEffect,
  type SessionBusyState,
} from "../session";

type Unsubscribe = () => void;

type VoiceKind = "narration" | "oneshot" | "bed" | "stem" | "heartbeat";

interface InternalBuffer extends BufferHandle {
  buffer: AudioBuffer;
}

interface VoiceState {
  id: string;
  kind: VoiceKind;
  bus: BusId;
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner?: StereoPannerNode;
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
  playbackRate: number;
  /** Fade stop scheduled; release on natural or faded onEnded. */
  pendingReleaseReason?: "ended" | "cancelled";
}

interface LoopGroupState {
  id: string;
  bus: BusId;
  stemCount: number;
  stemVoiceIds: string[];
  startedAtContextTime: number;
}

const MIN_AUDIBLE_FADE_MS = 20;
const HEARTBEAT_LEAD_SEC = 5;
const HEARTBEAT_COUNT = 2;
const DEFAULT_VOICE_BUDGET = 12;
const TOUR_NARRATION_PERIOD_SEC = 180;
const CLOCK_WINDOW_MS = 120_000;

let nextId = 1;
function id(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function enforceMinFade(fadeMs: number): number {
  return Math.max(fadeMs, MIN_AUDIBLE_FADE_MS);
}

/**
 * Mobile AudioEngine backed by react-native-audio-api (M1 spike, B·S2/B·S3).
 * Platform session owned by `audio-session` (not the library).
 * UI code must import this only through the AudioEngine interface (plus spike helpers).
 */
export class RNAudioApiEngine implements AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<BusId, GainNode>> = {};
  private cache: BufferLruCache | null = null;
  private voices = new Map<string, VoiceState>();
  private loops = new Map<string, LoopGroupState>();
  private buffers = new Map<string, InternalBuffer>();
  private readonly ledger = new VoiceLedger();
  private readonly session = new AudioSessionController();

  private route: AudioRoute = "unknown";
  private appState: AppStateStatus =
    (AppState.currentState as AppStateStatus | null) ?? "active";
  private notificationVisible = false;
  private narrationActive = false;
  private mixWallStartMs: number | null = null;
  private mixContextStartSec: number | null = null;
  private initWallMs = 0;
  private mixActive = false;
  /** Linear master multiplier while ducked (1 = unducked). */
  private duckFactor = 1;
  private unduckedMasterLinear = 1;
  private sessionBusy: SessionBusyState = "ok";

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
  private busySubs = new Set<(state: SessionBusyState) => void>();
  private voiceEndedSubs = new Set<
    (e: {
      voiceId: string;
      kind: VoiceKind;
      appState: string;
      reason: "ended" | "cancelled";
    }) => void
  >();
  private tickSubs = new Set<(ctxTimeSec: number) => void>();

  private appStateSub: { remove: () => void } | null = null;
  private disposed = false;

  private silentBuffer: AudioBuffer | null = null;
  private heartbeatIds = new Set<string>();
  private voiceBudget = DEFAULT_VOICE_BUDGET;
  private oneshotDropped = 0;
  private focusHeld = false;

  private suspendPending = false;
  /** After Stop all: emit one settled diag once only heartbeats remain. */
  private settledPending = false;
  private settledEmitted = false;
  private settledSubs = new Set<
    (d: ReturnType<RNAudioApiEngine["getDiagnostics"]>) => void
  >();

  private tourNarrationTemplate: {
    h: BufferHandle;
    meta: NowPlayingMeta;
  } | null = null;
  private lastTourNarrationStartSec = 0;

  private clockWindowWallStartMs: number | null = null;
  private clockWindowContextStartSec: number | null = null;
  private clockRate: number | undefined;
  private clockRateLowWindows = 0;
  private audioHealth: "ok" | "degraded" = "ok";

  private ticking = false;

  /** Last raw getDevicesInfo payload (logged on routeChange). */
  lastDevicesInfo: unknown = null;

  async init(opts: { mixWithOthers: false }): Promise<void> {
    void opts;
    if (this.context) return;

    // B·S3: library no longer owns focus / notification / routes.
    AudioManager.disableSessionManagement();
    console.log("[audio-spike] sessionOwner=audio-session");

    AudioManager.setSystemOptions({
      ios: { category: "playback", mode: "default" },
    });

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

    const silent = context.createBuffer(
      1,
      Math.max(1, Math.floor(context.sampleRate * 0.05)),
      context.sampleRate,
    );

    this.context = context;
    this.master = master;
    this.buses = buses;
    this.cache = new BufferLruCache(context.sampleRate);
    this.silentBuffer = silent;
    this.initWallMs = Date.now();
    this.disposed = false;
    this.route = "unknown";

    this.wireSessionController();

    this.appStateSub = AppState.addEventListener("change", (next) => {
      this.appState = next;
      for (const cb of this.appStateSubs) cb(next);
      this.tick();
    });
  }

  /** Expose session for spike Start (notification permission + start). */
  getSession(): AudioSessionController {
    return this.session;
  }

  getSessionBusy(): SessionBusyState {
    return this.sessionBusy;
  }

  onSessionBusy(cb: (state: SessionBusyState) => void): Unsubscribe {
    this.busySubs.add(cb);
    return () => this.busySubs.delete(cb);
  }

  /**
   * Ask notification permission (from Start), then start the MediaSession.
   * Returns false if focus was denied ("audio busy").
   */
  async beginMixSession(meta: {
    title: string;
    artist: string;
  }): Promise<boolean> {
    await this.session.requestNotificationPermission();
    const ok = await this.session.start(meta);
    this.focusHeld = ok;
    this.setNotificationVisible(ok || this.session.isStarted());
    return ok;
  }

  async endMixSession(): Promise<void> {
    await this.session.stop();
    this.focusHeld = false;
    this.setNotificationVisible(false);
  }

  /**
   * Call once at the start of a full-mix run: wait out any pending suspend,
   * resume if needed, restore master gain (stop-all leaves it near zero),
   * then reset the wall/context clock baseline so clockGapMs is not carried over.
   */
  async prepareMixStart(): Promise<void> {
    const ctx = this.requireContext();
    const master = this.master;
    // stop-all schedules suspend on a silent source's onended; don't race it.
    const deadline = Date.now() + 2000;
    while (this.suspendPending && Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, 20));
    }
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn("[audio-spike] prepareMixStart resume failed", err);
      }
    }
    // fadeMasterAndSuspend ramps master to ~0; resume alone leaves that mute.
    if (master) {
      const now = ctx.currentTime;
      rampGainHeld(master.gain, now, 1, 0);
    }
    this.mixWallStartMs = Date.now();
    this.mixContextStartSec = ctx.currentTime;
    this.mixActive = true;
    this.clockWindowWallStartMs = Date.now();
    this.clockWindowContextStartSec = ctx.currentTime;
    this.clockRateLowWindows = 0;
    this.audioHealth = "ok";
    this.requestFocus();
    this.ensureHeartbeats();
    this.tick();
  }

  startHeartbeats(): void {
    this.ensureHeartbeats();
  }

  ensureHeartbeats(): void {
    const ctx = this.context;
    if (!ctx || !this.master || !this.silentBuffer) return;
    const now = ctx.currentTime;
    while (this.heartbeatIds.size < HEARTBEAT_COUNT) {
      const slot =
        this.heartbeatIds.size === 0 ? HEARTBEAT_LEAD_SEC : HEARTBEAT_LEAD_SEC * 2;
      const endSec = now + slot;
      this.scheduleHeartbeat(endSec);
    }
  }

  onTick(cb: (ctxTimeSec: number) => void): Unsubscribe {
    this.tickSubs.add(cb);
    return () => this.tickSubs.delete(cb);
  }

  setVoiceBudget(n: number): void {
    this.voiceBudget = Math.max(1, Math.floor(n));
  }

  getVoiceBudget(): number {
    return this.voiceBudget;
  }

  canAcceptOneShot(): boolean {
    const ctx = this.context;
    if (!ctx) return false;
    return (
      this.ledger.liveOrPendingSources(ctx.currentTime, true) < this.voiceBudget
    );
  }

  getLedgerStats(): VoiceLedgerStats {
    return this.ledger.getStats();
  }

  requestFocus(): void {
    void this.session.requestFocus().then((ok) => {
      this.focusHeld = ok;
    });
  }

  /**
   * Skip narration back by `ms`. No-op when no narration is active (never seeks beds).
   */
  skipNarrationBack(ms = 10_000): void {
    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );
    if (!narration?.meta) {
      console.log("[audio-spike] skipBack no-op (no narration)");
      return;
    }
    const ctx = this.context;
    if (!ctx) return;
    const currentSec = narration.paused
      ? narration.pauseOffsetSec
      : narration.offsetSec +
        (ctx.currentTime - narration.startedAtContextTime);
    const nextMs = Math.max(0, currentSec * 1000 - ms);
    const meta = narration.meta;
    const sha = [...this.buffers.entries()].find(
      ([, b]) => b.buffer === narration.buffer,
    )?.[0];
    if (!sha) return;
    this.playNarration(
      { sha, durationMs: narration.durationMs },
      meta,
      nextMs,
    );
  }

  async stopAllMix(fadeMs = 500): Promise<void> {
    this.mixActive = false;
    this.settledEmitted = false;
    this.settledPending = true;
    const ctx = this.context;
    if (!ctx || !this.master) return;

    const fade = enforceMinFade(fadeMs);
    for (const voice of [...this.voices.values()]) {
      if (voice.kind === "heartbeat") continue;
      this.stop({ id: voice.id }, fade);
    }
    for (const group of [...this.loops.values()]) {
      this.stop({ id: group.id, stemCount: group.stemCount }, fade);
    }
    this.cancelScheduledOneShots();
    // Keep heartbeats through the fade so tick() can emit "settled"
    // once only heartbeats remain, then suspend.
    this.ensureHeartbeats();
    await this.fadeMasterAndSuspend(fade, "stop-all");
    await this.endMixSession();
  }

  /** Alias for ExploringRuntime session end (B7). */
  async stopAll(fadeMs = 500): Promise<void> {
    await this.stopAllMix(fadeMs);
  }

  /**
   * Seek narration to an absolute position (R5 skip-back). No-op without narration.
   */
  seekNarration(positionMs: number): void {
    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );
    if (!narration?.meta) return;
    const sha = [...this.buffers.entries()].find(
      ([, b]) => b.buffer === narration.buffer,
    )?.[0];
    if (!sha) return;
    this.playNarration(
      { sha, durationMs: narration.durationMs },
      narration.meta,
      Math.max(0, positionMs),
    );
  }

  onSettled(
    cb: (d: ReturnType<RNAudioApiEngine["getDiagnostics"]>) => void,
  ): Unsubscribe {
    this.settledSubs.add(cb);
    return () => this.settledSubs.delete(cb);
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
      kind: VoiceKind;
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
    const ctx = this.requireContext();
    const now = ctx.currentTime;
    for (const voice of [...this.voices.values()]) {
      if (voice.kind !== "oneshot") continue;
      const start = voice.startedAtContextTime;
      if (start > now + 0.001) {
        try {
          voice.source.stop();
        } catch {
          // never started
        }
        this.releaseVoice(voice.id, "cancelled", { missedSweep: false });
        continue;
      }
      const fadeMs = enforceMinFade(20);
      rampGainHeld(voice.gain.gain, now, 0.0001, fadeMs);
      voice.pendingReleaseReason = "cancelled";
      const stopAt = now + fadeMs / 1000 + 0.02;
      this.ledger.setExpectedEnd(voice.id, stopAt);
      try {
        voice.source.stop(stopAt);
      } catch {
        this.releaseVoice(voice.id, "cancelled", { missedSweep: false });
      }
    }
    this.tick();
  }

  /** Drop a cached decode so the next `load` re-decodes. */
  invalidateBuffer(sha: string): void {
    this.cache?.delete(sha);
    this.buffers.delete(sha);
  }

  /**
   * Decode and cache a buffer. Pass `sampleRate` to resample on decode
   * (e.g. 24000 for T1 narration). Call `invalidateBuffer` before toggling
   * rates so a file-rate reload does not hit a prior 24 kHz entry.
   */
  async load(
    sha: string,
    uri: string,
    sampleRate?: number,
  ): Promise<BufferHandle> {
    this.requireContext();
    const cache = this.requireCache();

    const cached = cache.get(sha);
    if (cached && sampleRate == null) {
      const handle: InternalBuffer = {
        sha,
        durationMs: cached.duration * 1000,
        buffer: cached,
      };
      this.buffers.set(sha, handle);
      return { sha, durationMs: handle.durationMs };
    }
    if (sampleRate != null) {
      cache.delete(sha);
      this.buffers.delete(sha);
    }

    const input: string | number = /^\d+$/.test(uri) ? Number(uri) : uri;
    // Standalone decodeAudioData accepts an optional sampleRate; context.decode
    // always uses context.sampleRate.
    const buffer = await decodeAudioData(input, sampleRate);
    cache.set(sha, buffer);
    const handle: InternalBuffer = {
      sha,
      durationMs: buffer.duration * 1000,
      buffer,
    };
    this.buffers.set(sha, handle);
    return { sha, durationMs: handle.durationMs };
  }

  /** Native AudioContext for spike helpers (MediaElement bed). */
  getNativeContext(): AudioContext {
    return this.requireContext();
  }

  /** Bus gain node for attaching external sources (MediaElement). */
  getBusNode(bus: BusId): GainNode {
    const node = this.buses[bus];
    if (!node) throw new Error(`bus ${bus} missing`);
    return node;
  }

  playNarration(
    h: BufferHandle,
    meta: NowPlayingMeta,
    startAtMs?: number,
  ): VoiceHandle {
    const ctx = this.requireContext();
    const internal = this.requireBuffer(h.sha);
    this.stopNarrationInternal(enforceMinFade(0));

    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.buses.story!);

    const source = ctx.createBufferSource();
    source.buffer = internal.buffer;
    source.connect(gain);

    const offsetSec = Math.max(0, (startAtMs ?? 0) / 1000);
    const when = ctx.currentTime;
    const durationSec = internal.buffer.duration / Math.max(source.playbackRate.value, 0.01);
    const expectedEnd = when + durationSec - offsetSec;

    source.start(when, offsetSec);

    const voiceId = id("narration");
    const voice: VoiceState = {
      id: voiceId,
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
      playbackRate: 1,
    };
    this.voices.set(voiceId, voice);
    this.ledger.create(voiceId, "narration", expectedEnd);
    this.ledger.markStarted(voiceId, when);

    this.narrationActive = true;
    this.applyDucking(DuckingPolicy.DUCK_ATTACK_MS);
    void this.showNotification(meta, "playing", offsetSec * 1000, internal.durationMs);
    this.requestFocus();

    if (this.mixActive) {
      this.tourNarrationTemplate = { h, meta };
      this.lastTourNarrationStartSec = when;
      console.log("[audio-spike] tourNarrationStart", { whenSec: when });
    }

    source.onended = () => {
      this.releaseVoice(voiceId, "ended", { missedSweep: false });
      if (![...this.voices.values()].some((v) => v.kind === "narration")) {
        this.narrationActive = false;
        this.applyDucking(DuckingPolicy.DUCK_RELEASE_MS);
      }
      this.tick();
    };

    this.tick();
    return { id: voiceId };
  }

  pauseNarration(): void {
    void this.fadeMasterAndSuspend(250, "pause");
  }

  resumeNarration(): void {
    void this.resumeAfterFade(300, "play");
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
    if (!this.canAcceptOneShot()) {
      this.oneshotDropped += 1;
      console.warn("[audio-spike] oneshotDropped", {
        n: this.oneshotDropped,
        budget: this.voiceBudget,
      });
      return { id: `dropped-${this.oneshotDropped}` };
    }

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
    const rate = Math.max(p.rate, 0.01);
    const durationSec = internal.buffer.duration / rate;
    const expectedEnd = when + durationSec;

    source.start(when);

    const voiceId = id("oneshot");
    const voice: VoiceState = {
      id: voiceId,
      kind: "oneshot",
      bus: p.bus,
      source,
      gain,
      panner,
      startedAtContextTime: when,
      offsetSec: 0,
      durationMs: internal.durationMs / rate,
      paused: false,
      pauseOffsetSec: 0,
      buffer: internal.buffer,
      loopStartSec: 0,
      loopEndSec: internal.buffer.duration,
      looping: false,
      playbackRate: rate,
    };
    this.voices.set(voiceId, voice);
    this.ledger.create(voiceId, "oneshot", expectedEnd);
    this.ledger.markStarted(voiceId, when);

    source.onended = () => {
      const reason = voice.pendingReleaseReason ?? "ended";
      this.releaseVoice(voiceId, reason, { missedSweep: false });
      this.tick();
    };

    this.tick();
    return { id: voiceId };
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
    const stemVoiceIds: string[] = [];

    for (let i = 0; i < stems.length; i += 1) {
      const stem = stems[i]!;
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
      source.start(when, stem.loopStartMs / 1000);

      const voiceId = `${groupId}-stem-${i}`;
      const voice: VoiceState = {
        id: voiceId,
        kind: "stem",
        bus,
        source,
        gain,
        startedAtContextTime: when,
        offsetSec: stem.loopStartMs / 1000,
        durationMs: internal.durationMs,
        paused: false,
        pauseOffsetSec: 0,
        buffer: internal.buffer,
        loopStartSec: stem.loopStartMs / 1000,
        loopEndSec: stem.loopEndMs / 1000,
        looping: true,
        playbackRate: 1,
      };
      this.voices.set(voiceId, voice);
      stemVoiceIds.push(voiceId);
      this.ledger.create(voiceId, "stem", null);
      this.ledger.markStarted(voiceId, when);

      source.onended = () => {
        const reason = voice.pendingReleaseReason ?? "ended";
        this.releaseVoice(voiceId, reason, { missedSweep: false });
        this.tick();
      };
    }

    const group: LoopGroupState = {
      id: groupId,
      bus,
      stemCount: stemVoiceIds.length,
      stemVoiceIds,
      startedAtContextTime: when,
    };
    this.loops.set(groupId, group);
    this.tick();
    return { id: groupId, stemCount: stemVoiceIds.length };
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
    const toLinear = dbToGain(p.gainDb);
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

    const fadeSec = Math.max(enforceMinFade(p.fadeMs), 1) / 1000;
    const gainParam = gain.gain;
    if (typeof gainParam.setValueCurveAtTime === "function") {
      if (typeof gainParam.cancelAndHoldAtTime === "function") {
        gainParam.cancelAndHoldAtTime(when);
      } else {
        gainParam.cancelScheduledValues(when);
      }
      gainParam.setValueCurveAtTime(
        equalPowerCurve(0.0001, toLinear),
        when,
        fadeSec,
      );
    } else {
      const steps = 32;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const { toGain } = equalPowerCrossfade(t);
        const at = when + fadeSec * t;
        rampGainHeld(gainParam, at, Math.max(0.0001, toGain * toLinear), 0);
      }
    }

    if (from) {
      const fromVoice = this.voices.get(from.id);
      if (fromVoice) {
        const fromLinear = Math.max(0.0001, fromVoice.gain.gain.value);
        const fromParam = fromVoice.gain.gain;
        if (typeof fromParam.setValueCurveAtTime === "function") {
          if (typeof fromParam.cancelAndHoldAtTime === "function") {
            fromParam.cancelAndHoldAtTime(when);
          } else {
            fromParam.cancelScheduledValues(when);
          }
          fromParam.setValueCurveAtTime(
            equalPowerCurve(fromLinear, 0.0001),
            when,
            fadeSec,
          );
        } else {
          const steps = 32;
          for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const { fromGain } = equalPowerCrossfade(t);
            rampGainHeld(
              fromParam,
              when + fadeSec * t,
              Math.max(0.0001, fromGain * fromLinear),
              0,
            );
          }
        }
        const stopAt = when + fadeSec + 0.05;
        fromVoice.pendingReleaseReason = "ended";
        this.ledger.setExpectedEnd(from.id, stopAt);
        try {
          fromVoice.source.stop(stopAt);
        } catch {
          this.releaseVoice(from.id, "ended", { missedSweep: false });
        }
      }
    }

    const voiceId = id("bed");
    const voice: VoiceState = {
      id: voiceId,
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
      playbackRate: 1,
    };
    this.voices.set(voiceId, voice);
    this.ledger.create(voiceId, "bed", null);
    this.ledger.markStarted(voiceId, when);

    source.onended = () => {
      const reason = voice.pendingReleaseReason ?? "ended";
      this.releaseVoice(voiceId, reason, { missedSweep: false });
      this.tick();
    };

    this.tick();
    return { id: voiceId };
  }

  setGain(
    target: VoiceHandle | LoopGroupHandle | BusId,
    gainDb: number,
    rampMs: number,
  ): void {
    const ctx = this.requireContext();
    const linear = dbToGain(gainDb);
    const ramp = enforceMinFade(rampMs);

    if (typeof target === "string") {
      const bus = this.buses[target];
      if (!bus) throw new Error(`Unknown bus ${target}`);
      rampGainHeld(bus.gain, ctx.currentTime, linear, ramp);
      return;
    }

    if ("stemCount" in target) {
      const group = this.loops.get(target.id);
      if (!group) return;
      for (const stemId of group.stemVoiceIds) {
        const voice = this.voices.get(stemId);
        if (voice) {
          rampGainHeld(voice.gain.gain, ctx.currentTime, linear, ramp);
        }
      }
      return;
    }

    const voice = this.voices.get(target.id);
    if (!voice) return;
    rampGainHeld(voice.gain.gain, ctx.currentTime, linear, ramp);
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
    const stemId = g.stemVoiceIds[index];
    if (!stemId) return;
    const voice = this.voices.get(stemId);
    if (!voice) return;
    rampGainHeld(
      voice.gain.gain,
      ctx.currentTime,
      dbToGain(gainDb),
      enforceMinFade(rampMs),
    );
  }

  stop(target: VoiceHandle | LoopGroupHandle, fadeMs: number): void {
    const ctx = this.requireContext();
    const fade = enforceMinFade(fadeMs);

    if ("stemCount" in target) {
      const group = this.loops.get(target.id);
      if (!group) return;
      const when = ctx.currentTime;
      const stopAt = when + fade / 1000 + 0.05;
      for (const stemId of group.stemVoiceIds) {
        const voice = this.voices.get(stemId);
        if (!voice) continue;
        rampGainHeld(voice.gain.gain, when, 0.0001, fade);
        voice.pendingReleaseReason = "cancelled";
        this.ledger.setExpectedEnd(stemId, stopAt);
        try {
          voice.source.stop(stopAt);
        } catch {
          this.releaseVoice(stemId, "cancelled", { missedSweep: false });
        }
      }
      const pending = group.stemVoiceIds.filter((sid) => this.voices.has(sid));
      if (pending.length === 0) {
        this.loops.delete(target.id);
      } else {
        const lastStem = pending[pending.length - 1];
        const v = lastStem ? this.voices.get(lastStem) : undefined;
        if (v) {
          const prevOnEnded = v.source.onended;
          v.source.onended = (ev) => {
            prevOnEnded?.(ev);
            if (!group.stemVoiceIds.some((sid) => this.voices.has(sid))) {
              this.loops.delete(target.id);
            }
          };
        }
      }
      this.tick();
      return;
    }

    const voice = this.voices.get(target.id);
    if (!voice) return;
    const reason = voice.kind === "oneshot" ? "cancelled" : "cancelled";
    rampGainHeld(voice.gain.gain, ctx.currentTime, 0.0001, fade);
    voice.pendingReleaseReason = reason;
    const stopAt = ctx.currentTime + fade / 1000 + 0.05;
    this.ledger.setExpectedEnd(target.id, stopAt);
    try {
      voice.source.stop(stopAt);
    } catch {
      this.releaseVoice(target.id, reason, { missedSweep: false });
    }
    if (voice.kind === "narration") {
      this.narrationActive = false;
      this.applyDucking(DuckingPolicy.DUCK_RELEASE_MS);
    }
    this.tick();
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
      const stemPositionsMs = g.stemVoiceIds.map((stemId) => {
        const stem = this.voices.get(stemId);
        if (!stem || !ctx) return 0;
        const elapsed = Math.max(0, ctx.currentTime - g.startedAtContextTime);
        const loopLen = Math.max(
          0.001,
          stem.loopEndSec - stem.loopStartSec,
        );
        const pos = stem.loopStartSec + (elapsed % loopLen);
        return pos * 1000;
      });
      return {
        id: g.id,
        stemPositionsMs,
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

    const stats = this.ledger.getStats();
    const pendingOneShots = ctx
      ? this.ledger.pendingOneShotCount(ctx.currentTime)
      : 0;

    return {
      uptimeMs,
      activeVoices: this.countActiveVoices(),
      loopGroups,
      narrationPositionMs,
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
      pendingOneShots,
      nodesCreated: stats.created,
      nodesReleased: stats.released,
      missedEnded: stats.missedEnded,
      oneshotDropped: this.oneshotDropped,
      clockRate: this.clockRate,
      focusHeld: this.focusHeld,
      audioHealth: this.audioHealth,
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.mixActive = false;
    this.appStateSub?.remove();
    this.appStateSub = null;
    await this.endMixSession();
    this.setNotificationVisible(false);

    for (const voiceId of [...this.voices.keys()]) {
      this.releaseVoice(voiceId, "cancelled", { missedSweep: false });
    }
    this.loops.clear();
    this.heartbeatIds.clear();
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
    this.silentBuffer = null;
  }

  // --- internals -----------------------------------------------------------

  private countActiveVoices(): number {
    let n = 0;
    for (const v of this.voices.values()) {
      if (v.kind !== "heartbeat") n += 1;
    }
    return n;
  }

  private scheduleHeartbeat(endSec: number): void {
    const ctx = this.requireContext();
    const master = this.master!;
    const buffer = this.silentBuffer!;
    const dur = buffer.duration;
    const startSec = Math.max(ctx.currentTime, endSec - dur);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(startSec, 0, dur);

    const voiceId = id("hb");
    const voice: VoiceState = {
      id: voiceId,
      kind: "heartbeat",
      bus: "ui",
      source,
      gain,
      startedAtContextTime: startSec,
      offsetSec: 0,
      durationMs: dur * 1000,
      paused: false,
      pauseOffsetSec: 0,
      buffer,
      loopStartSec: 0,
      loopEndSec: dur,
      looping: false,
      playbackRate: 1,
    };
    this.voices.set(voiceId, voice);
    this.heartbeatIds.add(voiceId);
    this.ledger.create(voiceId, "heartbeat", endSec);
    this.ledger.markStarted(voiceId, startSec);

    source.onended = () => {
      this.heartbeatIds.delete(voiceId);
      this.releaseVoice(voiceId, "ended", { missedSweep: false });
      this.tick();
    };
  }

  private tick(): void {
    if (this.ticking || this.disposed) return;
    this.ticking = true;
    try {
      const ctx = this.context;
      if (!ctx) return;
      const now = ctx.currentTime;

      const stale = this.ledger.releaseIfPast(now, 0.5);
      for (const voiceId of stale) {
        this.releaseVoice(voiceId, "ended", { missedSweep: true });
      }

      this.emitNarrationProgress();
      this.updateClockDiagnostics(now);
      this.maybeRunTourLoop(now);
      this.maybeEmitSettled();

      for (const cb of this.tickSubs) cb(now);

      if (this.mixActive || this.settledPending) {
        this.ensureHeartbeats();
      }
    } finally {
      this.ticking = false;
    }
  }

  /** Non-heartbeat live voices remaining (audible mix). */
  private nonHeartbeatLiveCount(): number {
    let n = 0;
    for (const v of this.voices.values()) {
      if (v.kind !== "heartbeat") n += 1;
    }
    return n;
  }

  private maybeEmitSettled(): void {
    if (!this.settledPending || this.settledEmitted) return;
    if (this.nonHeartbeatLiveCount() > 0) return;
    this.settledEmitted = true;
    this.settledPending = false;
    const d = this.getDiagnostics();
    console.log("[audio-spike] settled", {
      activeVoices: d.activeVoices,
      nodesCreated: d.nodesCreated,
      nodesReleased: d.nodesReleased,
      heartbeats: this.heartbeatIds.size,
    });
    for (const cb of this.settledSubs) cb(d);
  }

  private maybeRunTourLoop(nowSec: number): void {
    if (!this.mixActive || !this.tourNarrationTemplate) return;
    if (nowSec - this.lastTourNarrationStartSec < TOUR_NARRATION_PERIOD_SEC) {
      return;
    }
    const template = this.tourNarrationTemplate;
    console.log("[audio-spike] tourNarrationRestart", { atSec: nowSec });
    this.playNarration(template.h, template.meta, 0);
  }

  private updateClockDiagnostics(nowSec: number): void {
    const wallNow = Date.now();
    if (
      this.clockWindowWallStartMs == null ||
      this.clockWindowContextStartSec == null
    ) {
      this.clockWindowWallStartMs = wallNow;
      this.clockWindowContextStartSec = nowSec;
      return;
    }
    const wallDelta = wallNow - this.clockWindowWallStartMs;
    if (wallDelta < CLOCK_WINDOW_MS) return;

    const ctxDelta = nowSec - this.clockWindowContextStartSec;
    if (wallDelta > 0 && ctxDelta >= 0) {
      const rate = (ctxDelta * 1000) / wallDelta;
      this.clockRate = rate;
      if (rate < 0.98) {
        this.clockRateLowWindows += 1;
      } else {
        this.clockRateLowWindows = 0;
      }
      if (this.clockRateLowWindows >= 2) {
        this.audioHealth = "degraded";
        console.warn("[audio-spike] audioHealth: degraded", { clockRate: rate });
      } else {
        this.audioHealth = "ok";
      }
    }
    this.clockWindowWallStartMs = wallNow;
    this.clockWindowContextStartSec = nowSec;
  }

  /**
   * Idempotent voice teardown: disconnect nodes, ledger release, single voiceEnded.
   * M6: delay disconnect until onEnded, or ≥1 quantum after stop.
   */
  private releaseVoice(
    voiceId: string,
    reason: "ended" | "cancelled",
    opts: { missedSweep: boolean },
  ): void {
    const voice = this.voices.get(voiceId);
    if (!voice) {
      this.ledger.markReleased(voiceId);
      return;
    }

    const marked = this.ledger.markReleased(voiceId);
    if (!marked) {
      return;
    }
    if (opts.missedSweep) {
      this.ledger.recordMissedEnded(1);
    }

    voice.source.onended = null;
    try {
      voice.source.stop();
    } catch {
      // already stopped / never started
    }

    this.voices.delete(voiceId);
    if (voice.kind === "heartbeat") {
      this.heartbeatIds.delete(voiceId);
    }

    const sampleRate = this.context?.sampleRate ?? 48_000;
    const quantumMs = Math.max(5, Math.ceil((1000 * 128) / sampleRate));
    const delayMs = reason === "ended" ? 0 : quantumMs;
    const disconnect = () => {
      try {
        voice.source.disconnect();
      } catch {
        // ignore
      }
      try {
        voice.gain.disconnect();
      } catch {
        // ignore
      }
      if (voice.panner) {
        try {
          voice.panner.disconnect();
        } catch {
          // ignore
        }
      }
    };
    if (delayMs <= 0) disconnect();
    else setTimeout(disconnect, delayMs);

    const emitReason = reason === "cancelled" ? "cancelled" : "ended";
    const payload = {
      voiceId,
      kind: voice.kind,
      appState: this.appState,
      reason: emitReason as "ended" | "cancelled",
    };
    for (const cb of this.voiceEndedSubs) cb(payload);
  }

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
    const ramp = enforceMinFade(rampMs);
    const now = this.context.currentTime;
    for (const bus of Object.keys(levels.busDb) as BusId[]) {
      const node = this.buses[bus];
      if (!node) continue;
      rampGainHeld(node.gain, now, dbToGain(levels.busDb[bus]), ramp);
    }
  }

  private stopNarrationInternal(fadeMs: number): void {
    for (const voice of [...this.voices.values()]) {
      if (voice.kind !== "narration") continue;
      this.stop({ id: voice.id }, fadeMs);
    }
  }

  private wireSessionController(): void {
    this.session.setEffectHandler((effect) => {
      void this.applyFocusEffect(effect);
    });
    // Play/pause audio work is done by the focus effect from userPlay/userPause.
    this.session.setRemoteHandler(async (command) => {
      if (command === "play") {
        for (const cb of this.remoteSubs) cb("play");
        return;
      }
      if (command === "pause") {
        for (const cb of this.remoteSubs) cb("pause");
        return;
      }
      if (command === "skipBack") {
        this.skipNarrationBack(10_000);
        for (const cb of this.remoteSubs) cb("skipBackward");
      }
    });
    this.session.setBusyHandler((state) => {
      this.sessionBusy = state;
      for (const cb of this.busySubs) cb(state);
    });
    this.session.setRouteHandler((e) => {
      const next = (e.route === "headphones" ||
      e.route === "bluetooth" ||
      e.route === "speaker"
        ? e.route
        : "unknown") as AudioRoute;
      this.route = next;
      this.lastDevicesInfo = e;
      console.log("[audio-spike] route", e);
      this.applyDucking(300);
      for (const cb of this.routeSubs) cb(next);
      this.tick();
    });
  }

  private async applyFocusEffect(effect: FocusEffect): Promise<void> {
    console.log("[audio-spike] focusEffect", effect, {
      mode: this.session.getMode(),
    });
    switch (effect.type) {
      case "fadeSuspend": {
        for (const cb of this.interruptionSubs) cb("began");
        // Keep Media3 FGS through suspendedTransient (call / LOSS_TRANSIENT).
        // Hard LOSS / user pause / noisy demote via update("paused").
        const demoteSession = shouldDemoteSessionOnSuspend(
          this.session.getMode(),
        );
        await this.fadeMasterAndSuspend(250, "focus-suspend", {
          demoteSession,
        });
        break;
      }
      case "resumeFadeIn":
        for (const cb of this.interruptionSubs) cb("ended");
        await this.resumeAfterFade(effect.ms, "focus-gain");
        break;
      case "duck":
        this.applyMasterDuck(effect.db);
        break;
      case "unduck":
        this.applyMasterDuck(0);
        break;
      case "denyPlay":
        this.sessionBusy = "audioBusy";
        for (const cb of this.busySubs) cb("audioBusy");
        break;
      case "noop":
        break;
    }
    this.tick();
  }

  private applyMasterDuck(db: number): void {
    const master = this.master;
    const ctx = this.context;
    if (!master || !ctx) return;
    this.duckFactor = db === 0 ? 1 : dbToGain(db);
    const target = Math.max(0.0001, this.unduckedMasterLinear * this.duckFactor);
    rampGainHeld(master.gain, ctx.currentTime, target, 80);
  }

  private async fadeMasterAndSuspend(
    fadeMs: number,
    reason: string,
    opts: { demoteSession?: boolean } = {},
  ): Promise<void> {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master || this.suspendPending) return;
    this.suspendPending = true;
    const demoteSession = opts.demoteSession !== false;

    console.log("[audio-spike] fadeMasterAndSuspend", {
      reason,
      fadeMs,
      demoteSession,
    });
    const fade = enforceMinFade(fadeMs);
    const now = ctx.currentTime;
    const end = now + fade / 1000;

    const narration = [...this.voices.values()].find(
      (v) => v.kind === "narration",
    );
    if (narration && !narration.paused) {
      narration.pauseOffsetSec =
        narration.offsetSec +
        (ctx.currentTime - narration.startedAtContextTime);
      narration.paused = true;
    }

    rampGainHeld(master.gain, now, 0.0001, fade);
    this.scheduleSuspendAt(end);
    const positionMs = narration
      ? narration.pauseOffsetSec * 1000
      : this.getDiagnostics().narrationPositionMs ?? 0;
    // Transient interruptions keep playWhenReady so Media3 does not demote FGS.
    if (demoteSession) {
      await this.showNotification(
        narration?.meta ?? { title: "InTell audio spike", artist: "Test" },
        "paused",
        positionMs,
        narration?.durationMs ?? 0,
      );
    }
  }

  private scheduleSuspendAt(endSec: number): void {
    const ctx = this.context;
    const master = this.master;
    const buffer = this.silentBuffer;
    if (!ctx || !master || !buffer) return;

    const dur = buffer.duration;
    const startSec = Math.max(ctx.currentTime, endSec - dur);
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(startSec, 0, dur);

    source.onended = () => {
      try {
        gain.disconnect();
        source.disconnect();
      } catch {
        // ignore
      }
      // Fades should have finished with this silent source. Release any
      // non-heartbeat that missed onEnded before we freeze the clock.
      if (this.settledPending) {
        for (const voice of [...this.voices.values()]) {
          if (voice.kind === "heartbeat") continue;
          this.releaseVoice(voice.id, "ended", { missedSweep: true });
        }
        this.maybeEmitSettled();
      }
      void ctx.suspend().finally(() => {
        this.suspendPending = false;
        this.tick();
      });
    };
  }

  private async resumeAfterFade(
    fadeMs: number,
    reason: string,
  ): Promise<void> {
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master) return;

    console.log("[audio-spike] resumeAfterFade", { reason, fadeMs });
    const focused = await this.session.requestFocus();
    if (!focused) {
      this.focusHeld = false;
      this.sessionBusy = "audioBusy";
      for (const cb of this.busySubs) cb("audioBusy");
      console.warn("[audio-spike] resume denied — audio busy");
      return;
    }
    this.focusHeld = true;

    try {
      await ctx.resume();
    } catch (err) {
      console.warn("[audio-spike] resume failed", err);
    }
    // Native Log.i survives release stripping of console.log (review 3).
    await this.session.logContextState(ctx.state);

    const now = ctx.currentTime;
    this.unduckedMasterLinear = 1;
    this.duckFactor = 1;
    rampGainHeld(master.gain, now, 0.0001, 0);

    const fade = enforceMinFade(fadeMs);
    rampGainHeld(master.gain, now, 1, fade);

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
    this.tick();
  }

  private async showNotification(
    meta: NowPlayingMeta,
    state: "playing" | "paused",
    _elapsedMs: number,
    _durationMs: number,
  ): Promise<void> {
    try {
      if (!this.session.isStarted()) {
        // Session not yet started (pre-mix); nothing to update.
        return;
      }
      await this.session.update(
        { title: meta.title, artist: meta.artist },
        state,
      );
      this.setNotificationVisible(true);
    } catch (err) {
      console.warn("[audio-spike] session update failed", err);
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
  }
}