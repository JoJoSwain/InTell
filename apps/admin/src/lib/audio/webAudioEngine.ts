/**
 * Admin Web Audio implementation of the shared AudioEngine (A5 P2b).
 * Schedules on the audio clock; fades before every stop; disconnects nodes on release.
 */
import {
  type AudioEngine,
  type AudioRoute,
  type BufferHandle,
  type BusId,
  type EngineDiagnostics,
  type LoopGroupHandle,
  type NowPlayingMeta,
  type VoiceHandle,
  DECODE_CACHE_CAP_BYTES,
  DecodedBufferLruAccounting,
  DuckingPolicy,
  dbToGain,
  equalPowerCrossfade,
  estimateDecodedPcmBytesAtRate,
} from "@intell/shared";

type Unsubscribe = () => void;

interface InternalBuffer extends BufferHandle {
  buffer: AudioBuffer;
  bytes: number;
}

interface VoiceState {
  id: string;
  kind: "narration" | "oneshot" | "bed";
  bus: BusId;
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
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
  ended: boolean;
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
function makeId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

function rampGain(
  param: AudioParam,
  context: BaseAudioContext,
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

export type WebAudioEngineOptions = {
  /** Inject for tests (OfflineAudioContext or mock). */
  createContext?: () => AudioContext;
};

/**
 * Browser AudioEngine. UI must import only through this module / the shared interface.
 */
export class WebAudioEngine implements AudioEngine {
  private readonly createContext: () => AudioContext;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<BusId, GainNode>> = {};
  private accounting = new DecodedBufferLruAccounting(DECODE_CACHE_CAP_BYTES);
  private voices = new Map<string, VoiceState>();
  private loops = new Map<string, LoopGroupState>();
  private buffers = new Map<string, InternalBuffer>();
  private route: AudioRoute = "headphones";
  private mixWallStartMs: number | null = null;
  private mixContextStartSec: number | null = null;
  private initWallMs = 0;
  private disposed = false;
  private cancelledVoiceIds = new Set<string>();
  private progressRaf: number | null = null;

  private routeSubs = new Set<(r: AudioRoute) => void>();
  private interruptionSubs = new Set<(e: "began" | "ended") => void>();
  private progressSubs = new Set<
    (p: { positionMs: number; durationMs: number }) => void
  >();
  private remoteSubs = new Set<
    (c: "play" | "pause" | "skipForward" | "skipBackward" | "next") => void
  >();

  constructor(opts: WebAudioEngineOptions = {}) {
    this.createContext =
      opts.createContext ??
      (() => new AudioContext({ latencyHint: "interactive" }));
  }

  async init(_opts: { mixWithOthers: false }): Promise<void> {
    void _opts;
    if (this.disposed) throw new Error("engine disposed");
    if (this.context) return;
    const ctx = this.createContext();
    this.context = ctx;
    this.initWallMs = Date.now();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const busIds: BusId[] = ["story", "music", "surroundings", "ui", "moment"];
    for (const id of busIds) {
      const g = ctx.createGain();
      g.gain.value = dbToGain(DuckingPolicy.BUS_DEFAULT_DB[id]);
      g.connect(this.master);
      this.buses[id] = g;
    }
    this.mixWallStartMs = Date.now();
    this.mixContextStartSec = ctx.currentTime;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }
    this.startProgressPump();
  }

  async load(sha: string, uri: string): Promise<BufferHandle> {
    this.requireContext();
    const existing = this.buffers.get(sha);
    if (existing) {
      this.accounting.touch(sha);
      return { sha: existing.sha, durationMs: existing.durationMs };
    }
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`load failed ${res.status}`);
    const bytes = await res.arrayBuffer();
    const buffer = await this.context!.decodeAudioData(bytes.slice(0));
    const pcmBytes = estimateDecodedPcmBytesAtRate(
      buffer.duration,
      buffer.sampleRate,
      buffer.numberOfChannels,
    );
    for (const evicted of this.accounting.put(sha, pcmBytes)) {
      this.buffers.delete(evicted);
    }
    const handle: InternalBuffer = {
      sha,
      durationMs: Math.round(buffer.duration * 1000),
      buffer,
      bytes: pcmBytes,
    };
    this.buffers.set(sha, handle);
    return { sha, durationMs: handle.durationMs };
  }

  /** Test helper: load a pre-decoded buffer without fetch. */
  loadDecoded(sha: string, buffer: AudioBuffer): BufferHandle {
    this.requireContext();
    const pcmBytes = estimateDecodedPcmBytesAtRate(
      buffer.duration,
      buffer.sampleRate,
      buffer.numberOfChannels,
    );
    for (const evicted of this.accounting.put(sha, pcmBytes)) {
      this.buffers.delete(evicted);
    }
    const handle: InternalBuffer = {
      sha,
      durationMs: Math.round(buffer.duration * 1000),
      buffer,
      bytes: pcmBytes,
    };
    this.buffers.set(sha, handle);
    return { sha, durationMs: handle.durationMs };
  }

  playNarration(
    h: BufferHandle,
    meta: NowPlayingMeta,
    startAtMs = 0,
  ): VoiceHandle {
    const ctx = this.requireContext();
    this.stopNarrationInternal(0);
    const buf = this.requireBuffer(h.sha);
    const id = makeId("narration");
    const { source, gain, pan } = this.connectVoice(
      buf.buffer,
      "story",
      0,
      0,
      1,
    );
    const offsetSec = Math.max(0, startAtMs / 1000);
    source.start(ctx.currentTime, offsetSec);
    const voice: VoiceState = {
      id,
      kind: "narration",
      bus: "story",
      source,
      gain,
      pan,
      startedAtContextTime: ctx.currentTime,
      offsetSec,
      durationMs: buf.durationMs,
      paused: false,
      pauseOffsetSec: offsetSec,
      buffer: buf.buffer,
      meta,
      loopStartSec: 0,
      loopEndSec: 0,
      looping: false,
      ended: false,
    };
    source.onended = () => this.onVoiceEnded(voice);
    this.voices.set(id, voice);
    this.applyDucking(true);
    return { id };
  }

  pauseNarration(): void {
    const ctx = this.context;
    if (!ctx) return;
    for (const v of this.voices.values()) {
      if (v.kind !== "narration" || v.paused || v.ended) continue;
      const elapsed = ctx.currentTime - v.startedAtContextTime;
      v.pauseOffsetSec = v.offsetSec + elapsed;
      v.paused = true;
      this.cancelledVoiceIds.add(v.id);
      try {
        v.source.stop();
      } catch {
        /* already stopped */
      }
      this.disconnectVoice(v);
    }
  }

  resumeNarration(): void {
    const ctx = this.requireContext();
    for (const v of [...this.voices.values()]) {
      if (v.kind !== "narration" || !v.paused || v.ended) continue;
      const { source, gain, pan } = this.connectVoice(
        v.buffer,
        "story",
        0,
        0,
        1,
      );
      source.start(ctx.currentTime, v.pauseOffsetSec);
      v.source = source;
      v.gain = gain;
      v.pan = pan;
      v.startedAtContextTime = ctx.currentTime;
      v.offsetSec = v.pauseOffsetSec;
      v.paused = false;
      source.onended = () => this.onVoiceEnded(v);
    }
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
    const buf = this.requireBuffer(h.sha);
    const id = makeId("oneshot");
    const when = p.whenSec ?? ctx.currentTime;
    const { source, gain, pan } = this.connectVoice(
      buf.buffer,
      p.bus,
      p.gainDb,
      p.pan,
      p.rate,
    );
    source.start(when);
    const voice: VoiceState = {
      id,
      kind: "oneshot",
      bus: p.bus,
      source,
      gain,
      pan,
      startedAtContextTime: when,
      offsetSec: 0,
      durationMs: buf.durationMs,
      paused: false,
      pauseOffsetSec: 0,
      buffer: buf.buffer,
      loopStartSec: 0,
      loopEndSec: 0,
      looping: false,
      ended: false,
    };
    source.onended = () => this.onVoiceEnded(voice);
    this.voices.set(id, voice);
    return { id };
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
    const id = makeId("loop");
    const busGain = this.buses[bus];
    if (!busGain) throw new Error(`unknown bus ${bus}`);
    const stemNodes = stems.map((s) => {
      const buf = this.requireBuffer(s.h.sha);
      const source = ctx.createBufferSource();
      source.buffer = buf.buffer;
      source.loop = true;
      const loopStartSec = s.loopStartMs / 1000;
      const loopEndSec =
        s.loopEndMs > 0 ? s.loopEndMs / 1000 : buf.buffer.duration;
      source.loopStart = loopStartSec;
      source.loopEnd = loopEndSec;
      const gain = ctx.createGain();
      gain.gain.value = dbToGain(s.gainDb);
      source.connect(gain);
      gain.connect(busGain);
      source.start(ctx.currentTime);
      return {
        source,
        gain,
        buffer: buf.buffer,
        loopStartSec,
        loopEndSec,
      };
    });
    this.loops.set(id, {
      id,
      bus,
      stemCount: stemNodes.length,
      stems: stemNodes,
      startedAtContextTime: ctx.currentTime,
    });
    return { id, stemCount: stemNodes.length };
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
    const buf = this.requireBuffer(to.sha);
    const id = makeId("bed");
    const { source, gain, pan } = this.connectVoice(
      buf.buffer,
      bus,
      -120,
      0,
      1,
    );
    source.loop = true;
    source.loopStart = p.loopStartMs / 1000;
    source.loopEnd =
      p.loopEndMs > 0 ? p.loopEndMs / 1000 : buf.buffer.duration;
    source.start(ctx.currentTime);
    const targetLin = dbToGain(p.gainDb);
    const steps = Math.max(2, Math.ceil(p.fadeMs / 16));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { fromGain, toGain } = equalPowerCrossfade(t);
      const at = ctx.currentTime + (p.fadeMs / 1000) * t;
      gain.gain.linearRampToValueAtTime(Math.max(toGain * targetLin, 0.0001), at);
      if (from) {
        const fv = this.voices.get(from.id);
        if (fv) {
          fv.gain.gain.linearRampToValueAtTime(
            Math.max(fromGain * fv.gain.gain.value, 0.0001),
            at,
          );
        }
      }
    }
    if (from) {
      const stopAt = ctx.currentTime + p.fadeMs / 1000 + 0.02;
      this.scheduleStop(from, p.fadeMs, stopAt);
    }
    const voice: VoiceState = {
      id,
      kind: "bed",
      bus,
      source,
      gain,
      pan,
      startedAtContextTime: ctx.currentTime,
      offsetSec: 0,
      durationMs: buf.durationMs,
      paused: false,
      pauseOffsetSec: 0,
      buffer: buf.buffer,
      loopStartSec: source.loopStart,
      loopEndSec: source.loopEnd,
      looping: true,
      ended: false,
    };
    source.onended = () => this.onVoiceEnded(voice);
    this.voices.set(id, voice);
    return { id };
  }

  setGain(
    target: VoiceHandle | LoopGroupHandle | BusId,
    gainDb: number,
    rampMs: number,
  ): void {
    const ctx = this.requireContext();
    if (typeof target === "string") {
      const bus = this.buses[target];
      if (bus) rampGain(bus.gain, ctx, dbToGain(gainDb), rampMs);
      return;
    }
    if ("stemCount" in target) {
      const group = this.loops.get(target.id);
      if (!group) return;
      for (const stem of group.stems) {
        rampGain(stem.gain.gain, ctx, dbToGain(gainDb), rampMs);
      }
      return;
    }
    const voice = this.voices.get(target.id);
    if (voice) rampGain(voice.gain.gain, ctx, dbToGain(gainDb), rampMs);
  }

  setStemGain(
    group: LoopGroupHandle,
    index: number,
    gainDb: number,
    rampMs: number,
  ): void {
    const ctx = this.requireContext();
    const g = this.loops.get(group.id);
    const stem = g?.stems[index];
    if (!stem) return;
    rampGain(stem.gain.gain, ctx, dbToGain(gainDb), rampMs);
  }

  stop(target: VoiceHandle | LoopGroupHandle, fadeMs: number): void {
    const ctx = this.requireContext();
    if ("stemCount" in target) {
      const group = this.loops.get(target.id);
      if (!group) return;
      for (const stem of group.stems) {
        rampGain(stem.gain.gain, ctx, 0, fadeMs);
      }
      const stopAt = ctx.currentTime + Math.max(fadeMs, 1) / 1000 + 0.02;
      // Schedule stop via audio clock parameter automation end + source.stop(when)
      for (const stem of group.stems) {
        try {
          stem.source.stop(stopAt);
        } catch {
          /* */
        }
      }
      // Cleanup after stop time using audio clock polling via rAF once
      this.releaseLoopAfter(group.id, stopAt);
      return;
    }
    this.scheduleStop(target, fadeMs, ctx.currentTime + Math.max(fadeMs, 1) / 1000 + 0.02);
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

  /** Simulator / tests: set headphone vs speaker route. */
  setRoute(route: AudioRoute): void {
    this.route = route;
    for (const cb of this.routeSubs) cb(route);
    this.applyDucking(this.hasActiveNarration());
  }

  getDiagnostics(): EngineDiagnostics {
    const ctx = this.context;
    const wallElapsedMs =
      this.mixWallStartMs == null ? 0 : Date.now() - this.mixWallStartMs;
    const contextTimeMs = ctx ? ctx.currentTime * 1000 : 0;
    const mixContextMs =
      this.mixContextStartSec != null && ctx
        ? (ctx.currentTime - this.mixContextStartSec) * 1000
        : 0;
    let narrationPositionMs: number | undefined;
    for (const v of this.voices.values()) {
      if (v.kind === "narration" && !v.ended && ctx && !v.paused) {
        narrationPositionMs = Math.round(
          (v.offsetSec + (ctx.currentTime - v.startedAtContextTime)) * 1000,
        );
      }
    }
    let scheduledAheadMs = 0;
    if (ctx) {
      for (const v of this.voices.values()) {
        if (v.kind === "oneshot" && v.startedAtContextTime > ctx.currentTime) {
          scheduledAheadMs = Math.max(
            scheduledAheadMs,
            (v.startedAtContextTime - ctx.currentTime) * 1000,
          );
        }
      }
    }
    return {
      uptimeMs: Date.now() - this.initWallMs,
      activeVoices: [...this.voices.values()].filter((v) => !v.ended).length,
      loopGroups: [...this.loops.values()].map((g) => ({
        id: g.id,
        stemPositionsMs: g.stems.map(() => 0),
        maxStemDriftMs: null,
      })),
      narrationPositionMs,
      route: this.route,
      decodedBytes: this.accounting.decodedBytes,
      cacheEvictions: this.accounting.cacheEvictions,
      contextTimeMs,
      wallElapsedMs,
      clockGapMs: wallElapsedMs - mixContextMs,
      contextState: ctx?.state,
      scheduledAheadMs,
    };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.stopProgressPump();
    for (const v of [...this.voices.values()]) {
      this.cancelledVoiceIds.add(v.id);
      try {
        v.source.stop();
      } catch {
        /* */
      }
      this.disconnectVoice(v);
    }
    this.voices.clear();
    for (const g of [...this.loops.values()]) {
      for (const s of g.stems) {
        try {
          s.source.stop();
        } catch {
          /* */
        }
        try {
          s.source.disconnect();
          s.gain.disconnect();
        } catch {
          /* */
        }
      }
    }
    this.loops.clear();
    this.buffers.clear();
    if (this.context) {
      await this.context.close().catch(() => undefined);
    }
    this.context = null;
  }

  // —— internals ——

  private requireContext(): AudioContext {
    if (!this.context || this.disposed) throw new Error("engine not init");
    return this.context;
  }

  private requireBuffer(sha: string): InternalBuffer {
    const b = this.buffers.get(sha);
    if (!b) throw new Error(`buffer not loaded: ${sha}`);
    this.accounting.touch(sha);
    return b;
  }

  private connectVoice(
    buffer: AudioBuffer,
    bus: BusId,
    gainDb: number,
    pan: number,
    rate: number,
  ): { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode } {
    const ctx = this.requireContext();
    const busGain = this.buses[bus];
    if (!busGain) throw new Error(`unknown bus ${bus}`);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = dbToGain(gainDb);
    const panNode = ctx.createStereoPanner();
    panNode.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain);
    gain.connect(panNode);
    panNode.connect(busGain);
    return { source, gain, pan: panNode };
  }

  private disconnectVoice(v: VoiceState): void {
    try {
      v.source.disconnect();
      v.gain.disconnect();
      v.pan.disconnect();
    } catch {
      /* */
    }
  }

  private onVoiceEnded(v: VoiceState): void {
    if (v.ended) return;
    v.ended = true;
    this.disconnectVoice(v);
    this.voices.delete(v.id);
    if (v.kind === "narration" && !this.cancelledVoiceIds.has(v.id)) {
      this.applyDucking(false, true);
    }
    this.cancelledVoiceIds.delete(v.id);
  }

  private stopNarrationInternal(fadeMs: number): void {
    for (const v of [...this.voices.values()]) {
      if (v.kind === "narration") this.scheduleStop({ id: v.id }, fadeMs, undefined);
    }
  }

  private scheduleStop(
    target: VoiceHandle,
    fadeMs: number,
    stopAt: number | undefined,
  ): void {
    const ctx = this.context;
    const voice = this.voices.get(target.id);
    if (!ctx || !voice || voice.ended) return;
    this.cancelledVoiceIds.add(voice.id);
    rampGain(voice.gain.gain, ctx, 0, fadeMs);
    const when = stopAt ?? ctx.currentTime + Math.max(fadeMs, 1) / 1000 + 0.02;
    try {
      voice.source.stop(when);
    } catch {
      /* */
    }
  }

  private scheduleFrame(cb: FrameRequestCallback): number {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(cb);
    }
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  }

  private releaseLoopAfter(id: string, stopAt: number): void {
    const ctx = this.context;
    if (!ctx) return;
    const tick = () => {
      if (!this.context || this.disposed) return;
      if (this.context.currentTime < stopAt) {
        this.scheduleFrame(tick);
        return;
      }
      const group = this.loops.get(id);
      if (!group) return;
      for (const s of group.stems) {
        try {
          s.source.disconnect();
          s.gain.disconnect();
        } catch {
          /* */
        }
      }
      this.loops.delete(id);
    };
    this.scheduleFrame(tick);
  }

  private hasActiveNarration(): boolean {
    for (const v of this.voices.values()) {
      if (v.kind === "narration" && !v.ended && !v.paused) return true;
    }
    return false;
  }

  private applyDucking(narrationActive: boolean, afterglow = false): void {
    const ctx = this.context;
    if (!ctx) return;
    const levels = DuckingPolicy.computeDuckingLevels({
      narrationActive,
      route: this.route,
      afterglowActive: afterglow && !narrationActive,
    });
    const ramp = narrationActive ? levels.attackMs : levels.releaseMs;
    for (const [bus, db] of Object.entries(levels.busDb) as [BusId, number][]) {
      const node = this.buses[bus];
      if (node) rampGain(node.gain, ctx, dbToGain(db), ramp);
    }
  }

  private startProgressPump(): void {
    const tick = () => {
      if (this.disposed || !this.context) return;
      const ctx = this.context;
      for (const v of this.voices.values()) {
        if (v.kind !== "narration" || v.ended || v.paused) continue;
        const positionMs = Math.round(
          (v.offsetSec + (ctx.currentTime - v.startedAtContextTime)) * 1000,
        );
        for (const cb of this.progressSubs) {
          cb({ positionMs, durationMs: v.durationMs });
        }
      }
      this.progressRaf = this.scheduleFrame(tick);
    };
    this.progressRaf = this.scheduleFrame(tick);
  }

  private stopProgressPump(): void {
    if (this.progressRaf != null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.progressRaf);
      } else {
        clearTimeout(this.progressRaf);
      }
      this.progressRaf = null;
    }
  }
}
