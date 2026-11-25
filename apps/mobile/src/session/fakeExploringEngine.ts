/**
 * Test double for ExploringRuntime (B8). Not used in production.
 */
import type {
  AudioRoute,
  BufferHandle,
  BusId,
  EngineDiagnostics,
  LoopGroupHandle,
  NowPlayingMeta,
  VoiceHandle,
} from "@intell/shared";
import { BUS_DEFAULT_DB } from "@intell/shared";
import type { AudioSessionController } from "../audio/session/AudioSessionController";
import type { ExploringEngine, VoiceEndedEvent } from "./enginePort";

const KNOWN_BUSES = new Set<string>(Object.keys(BUS_DEFAULT_DB));

type RemoteCmd =
  | "play"
  | "pause"
  | "skipForward"
  | "skipBackward"
  | "next"
  | "stopExploring";

export class FakeAudioSession {
  started = false;
  stopped = false;
  focusRequests = 0;
  /** When true, the next start() returns false (F2). */
  denyNextStart = false;
  private busy: "ok" | "audioBusy" | "notificationDenied" = "ok";
  private mode: "userPaused" | "playing" | "ducked" | "suspendedTransient" =
    "userPaused";
  private remote: ((c: string) => void | Promise<void>) | null = null;

  isStarted(): boolean {
    return this.started;
  }

  getMode(): string {
    return this.mode;
  }

  getBusy(): string {
    return this.busy;
  }

  setRemoteHandler(handler: ((c: string) => void | Promise<void>) | null): void {
    this.remote = handler;
  }

  async start(_meta: { title: string; artist: string }): Promise<boolean> {
    this.focusRequests += 1;
    if (this.denyNextStart) {
      this.denyNextStart = false;
      this.busy = "audioBusy";
      this.started = false;
      return false;
    }
    this.started = true;
    this.stopped = false;
    this.busy = "ok";
    this.mode = "playing";
    return true;
  }

  async update(
    _meta: { title: string; artist: string },
    _state: string,
  ): Promise<void> {
    // no-op
  }

  async requestFocus(): Promise<boolean> {
    this.focusRequests += 1;
    return true;
  }

  async userPlay(): Promise<boolean> {
    this.mode = "playing";
    return true;
  }

  async userPause(): Promise<void> {
    this.mode = "userPaused";
  }

  async stop(): Promise<void> {
    this.started = false;
    this.stopped = true;
    this.mode = "userPaused";
  }

  /** Test helper: fire a remote command through the wired session handler. */
  async emitRemote(command: string): Promise<void> {
    await this.remote?.(command);
  }
}

export class FakeExploringEngine implements ExploringEngine {
  readonly session = new FakeAudioSession();
  audioSec = 0;
  loads: string[] = [];
  playedNarration: { sha: string; title: string }[] = [];
  /** Narration attempts refused while still suspended (C4). */
  refusedNarration = 0;
  stopAllCalls: number[] = [];
  seekCalls: number[] = [];
  /** How many emitTick calls notified subscribers (C1). */
  tickNotifyCount = 0;
  /** Count of resumeNarration calls (F3). */
  resumeNarrationCalls = 0;
  /** Master gain after stopAll is ~0 until narration restores it (C4). */
  masterLinear = 1;
  private sessionClock = false;
  /** Models AudioContext suspended after fadeMasterAndSuspend / stopAll (C4). */
  private contextSuspended = false;
  private narrationVoiceId: string | null = null;
  private narrationPaused = false;
  private narrationPositionMs = 0;
  private lastNarration: { h: BufferHandle; meta: NowPlayingMeta } | null =
    null;
  /** Simulated master RMS dBFS while a narration voice is live. */
  private outputLevelDb = -90;
  private tickSubs = new Set<(t: number) => void>();
  private voiceEndedSubs = new Set<
    (e: VoiceEndedEvent) => void | Promise<void>
  >();
  private progressSubs = new Set<
    (p: { positionMs: number; durationMs: number }) => void
  >();
  private interruptionSubs = new Set<(e: "began" | "ended") => void>();
  private routeSubs = new Set<(r: AudioRoute) => void>();
  private remoteSubs = new Set<(c: RemoteCmd) => void>();

  async init(): Promise<void> {
    // Wire session remotes into engine subscribers (mirrors RNAudioApiEngine).
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
        this.seekNarration(Math.max(0, this.narrationPositionMs - 10_000));
        for (const cb of this.remoteSubs) cb("skipBackward");
        return;
      }
      if (command === "stopExploring") {
        for (const cb of this.remoteSubs) cb("stopExploring");
      }
    });
  }

  getSession(): AudioSessionController {
    return this.session as unknown as AudioSessionController;
  }

  getContextCurrentTime(): number {
    return this.audioSec;
  }

  async load(sha: string, _uri: string, _sampleRate?: number): Promise<BufferHandle> {
    this.loads.push(sha);
    return { sha, durationMs: 2_000 };
  }

  playNarration(
    h: BufferHandle,
    meta: NowPlayingMeta,
    startAtMs?: number,
  ): VoiceHandle {
    // C4 narration start: focus → resume → restore master (prepareMixStart minus spike).
    void this.session.requestFocus();
    this.contextSuspended = false;
    this.masterLinear = 1;
    this.narrationPaused = false;

    // RC6: replacing a live narration stops the old voice as "cancelled".
    const previousId = this.narrationVoiceId;
    const id = `narr-${this.playedNarration.length + 1}`;
    this.narrationVoiceId = id;
    this.lastNarration = { h, meta };
    if (startAtMs != null) this.narrationPositionMs = startAtMs;
    this.playedNarration.push({ sha: h.sha, title: meta.title });
    this.outputLevelDb = -25;
    if (previousId) {
      queueMicrotask(() => {
        void this.emitVoiceEndedKeepCurrent({
          voiceId: previousId,
          kind: "narration",
          reason: "cancelled",
          appState: "active",
        });
      });
    }
    return { id };
  }

  /**
   * Test helper: play without the C4 prepare path. Refuses while suspended /
   * muted after stopAll (models pre-fix silence).
   */
  playNarrationWhileSuspended(
    h: BufferHandle,
    meta: NowPlayingMeta,
  ): VoiceHandle | null {
    if (this.contextSuspended || this.masterLinear < 0.5) {
      this.refusedNarration += 1;
      return null;
    }
    return this.playNarration(h, meta);
  }

  pauseNarration(): void {
    this.contextSuspended = true;
    this.masterLinear = 0.0001;
    this.narrationPaused = true;
    this.outputLevelDb = -90;
  }

  resumeNarration(): void {
    this.resumeNarrationCalls += 1;
    this.contextSuspended = false;
    this.masterLinear = 1;
    this.narrationPaused = false;
    if (this.narrationVoiceId) this.outputLevelDb = -25;
  }

  playOneShot(
    _h: BufferHandle,
    _p: {
      bus: BusId;
      gainDb: number;
      pan: number;
      rate: number;
      whenSec?: number;
    },
  ): VoiceHandle {
    return { id: `oneshot-${Date.now()}` };
  }

  startLoopGroup(): LoopGroupHandle {
    return { id: "loop", stemCount: 0 };
  }

  crossfadeBed(): VoiceHandle {
    return { id: "bed" };
  }

  setGain(
    target: VoiceHandle | LoopGroupHandle | BusId,
    _gainDb?: number,
    _rampMs?: number,
  ): void {
    // RC7: match real engine — unknown bus throws so tests catch missing buses.
    if (typeof target === "string" && !KNOWN_BUSES.has(target)) {
      throw new Error(`Unknown bus ${target}`);
    }
  }

  setStemGain(): void {
    // no-op
  }

  stop(): void {
    // no-op
  }

  async stopAll(fadeMs: number): Promise<void> {
    this.stopAllCalls.push(fadeMs);
    const previousId = this.narrationVoiceId;
    this.narrationVoiceId = null;
    this.outputLevelDb = -90;
    // fadeMasterAndSuspend: context suspended, master ~0
    this.contextSuspended = true;
    this.masterLinear = 0.0001;
    if (previousId) {
      await this.emitVoiceEndedKeepCurrent({
        voiceId: previousId,
        kind: "narration",
        reason: "cancelled",
        appState: "active",
      });
    }
  }

  seekNarration(positionMs: number): void {
    this.seekCalls.push(positionMs);
    this.narrationPositionMs = positionMs;
    // RC6: real engine remounts via playNarration (old voice → cancelled).
    if (!this.lastNarration) return;
    this.playNarration(this.lastNarration.h, this.lastNarration.meta, positionMs);
  }

  startSessionClock(): void {
    this.sessionClock = true;
    // C4: resume suspended context without focus or master restore
    this.contextSuspended = false;
  }

  stopSessionClock(): void {
    this.sessionClock = false;
  }

  isSessionClockRunning(): boolean {
    return this.sessionClock;
  }

  isContextSuspended(): boolean {
    return this.contextSuspended;
  }

  getMasterGainLinear(): number {
    return this.masterLinear;
  }

  getOutputLevelDb(): number | null {
    return this.outputLevelDb;
  }

  getNarrationDiag(): {
    id: string;
    paused: boolean;
    positionMs: number;
  } | null {
    if (!this.narrationVoiceId) return null;
    return {
      id: this.narrationVoiceId,
      paused: this.narrationPaused,
      positionMs: this.narrationPositionMs,
    };
  }

  onTick(cb: (ctxTimeSec: number) => void): () => void {
    this.tickSubs.add(cb);
    return () => this.tickSubs.delete(cb);
  }

  onVoiceEnded(cb: (e: VoiceEndedEvent) => void | Promise<void>): () => void {
    this.voiceEndedSubs.add(cb);
    return () => this.voiceEndedSubs.delete(cb);
  }

  onNarrationProgress(
    cb: (p: { positionMs: number; durationMs: number }) => void,
  ): () => void {
    this.progressSubs.add(cb);
    return () => this.progressSubs.delete(cb);
  }

  onInterruption(cb: (e: "began" | "ended") => void): () => void {
    this.interruptionSubs.add(cb);
    return () => this.interruptionSubs.delete(cb);
  }

  onRouteChange(cb: (route: AudioRoute) => void): () => void {
    this.routeSubs.add(cb);
    return () => this.routeSubs.delete(cb);
  }

  onRemoteCommand(cb: (c: RemoteCmd) => void): () => void {
    this.remoteSubs.add(cb);
    return () => this.remoteSubs.delete(cb);
  }

  getDiagnostics(): EngineDiagnostics {
    return {
      uptimeMs: 0,
      activeVoices: this.narrationVoiceId ? 1 : 0,
      loopGroups: [],
      route: "headphones",
      contextState: this.contextSuspended ? "suspended" : "running",
      focusHeld: this.session.focusRequests > 0,
      audioHealth: "ok",
    };
  }

  async dispose(): Promise<void> {
    this.tickSubs.clear();
  }

  /**
   * Advance the fake audio clock and notify tick subscribers.
   * No-op until `startSessionClock()` (C1) — mirrors production heartbeats.
   * No-op while context is still suspended after stopAll (C4).
   */
  emitTick(audioSec: number): void {
    if (!this.sessionClock || this.contextSuspended) return;
    this.audioSec = audioSec;
    this.tickNotifyCount += 1;
    for (const cb of this.tickSubs) cb(audioSec);
  }

  async emitVoiceEnded(partial?: Partial<VoiceEndedEvent>): Promise<void> {
    const e: VoiceEndedEvent = {
      voiceId: partial?.voiceId ?? this.narrationVoiceId ?? "narr-1",
      kind: partial?.kind ?? "narration",
      appState: partial?.appState ?? "active",
      reason: partial?.reason ?? "ended",
    };
    if (e.kind === "narration" && e.voiceId === this.narrationVoiceId) {
      this.narrationVoiceId = null;
      this.outputLevelDb = -90;
    }
    await this.emitVoiceEndedKeepCurrent(e);
  }

  /** Emit without clearing the current narration voice id (RC6 replacements). */
  private async emitVoiceEndedKeepCurrent(e: VoiceEndedEvent): Promise<void> {
    await Promise.all(
      [...this.voiceEndedSubs].map((cb) => Promise.resolve(cb(e))),
    );
  }

  emitInterruption(phase: "began" | "ended"): void {
    for (const cb of this.interruptionSubs) cb(phase);
  }

  emitProgress(positionMs: number, durationMs: number): void {
    this.narrationPositionMs = positionMs;
    for (const cb of this.progressSubs) cb({ positionMs, durationMs });
  }

  emitRoute(route: AudioRoute): void {
    for (const cb of this.routeSubs) cb(route);
  }
}
