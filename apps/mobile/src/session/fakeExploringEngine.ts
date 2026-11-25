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
import type { AudioSessionController } from "../audio/session/AudioSessionController";
import type { ExploringEngine, VoiceEndedEvent } from "./enginePort";

type RemoteCmd = "play" | "pause" | "skipForward" | "skipBackward" | "next";

export class FakeAudioSession {
  started = false;
  stopped = false;
  private remote: ((c: string) => void | Promise<void>) | null = null;

  isStarted(): boolean {
    return this.started;
  }

  setRemoteHandler(handler: ((c: string) => void | Promise<void>) | null): void {
    this.remote = handler;
  }

  async start(_meta: { title: string; artist: string }): Promise<boolean> {
    this.started = true;
    this.stopped = false;
    return true;
  }

  async update(
    _meta: { title: string; artist: string },
    _state: string,
  ): Promise<void> {
    // no-op
  }

  async userPlay(): Promise<boolean> {
    return true;
  }

  async userPause(): Promise<void> {
    // no-op
  }

  async stop(): Promise<void> {
    this.started = false;
    this.stopped = true;
  }

  /** Test helper: fire a remote command through the wired handler. */
  async emitRemote(command: string): Promise<void> {
    await this.remote?.(command);
  }
}

export class FakeExploringEngine implements ExploringEngine {
  readonly session = new FakeAudioSession();
  audioSec = 0;
  loads: string[] = [];
  playedNarration: { sha: string; title: string }[] = [];
  stopAllCalls: number[] = [];
  seekCalls: number[] = [];
  /** How many emitTick calls notified subscribers (C1). */
  tickNotifyCount = 0;
  private sessionClock = false;
  private narrationVoiceId: string | null = null;
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
    // no-op
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
    _startAtMs?: number,
  ): VoiceHandle {
    const id = `narr-${this.playedNarration.length + 1}`;
    this.narrationVoiceId = id;
    this.playedNarration.push({ sha: h.sha, title: meta.title });
    return { id };
  }

  pauseNarration(): void {
    // no-op
  }

  resumeNarration(): void {
    // no-op
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

  setGain(): void {
    // no-op
  }

  setStemGain(): void {
    // no-op
  }

  stop(): void {
    // no-op
  }

  async stopAll(fadeMs: number): Promise<void> {
    this.stopAllCalls.push(fadeMs);
    this.narrationVoiceId = null;
  }

  seekNarration(positionMs: number): void {
    this.seekCalls.push(positionMs);
  }

  startSessionClock(): void {
    this.sessionClock = true;
  }

  stopSessionClock(): void {
    this.sessionClock = false;
  }

  isSessionClockRunning(): boolean {
    return this.sessionClock;
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
      contextState: "running",
      focusHeld: true,
      audioHealth: "ok",
    };
  }

  async dispose(): Promise<void> {
    this.tickSubs.clear();
  }

  /**
   * Advance the fake audio clock and notify tick subscribers.
   * No-op until `startSessionClock()` (C1) — mirrors production heartbeats.
   */
  emitTick(audioSec: number): void {
    if (!this.sessionClock) return;
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
    this.narrationVoiceId = null;
    await Promise.all(
      [...this.voiceEndedSubs].map((cb) => Promise.resolve(cb(e))),
    );
  }

  emitInterruption(phase: "began" | "ended"): void {
    for (const cb of this.interruptionSubs) cb(phase);
  }

  emitProgress(positionMs: number, durationMs: number): void {
    for (const cb of this.progressSubs) cb({ positionMs, durationMs });
  }

  emitRoute(route: AudioRoute): void {
    for (const cb of this.routeSubs) cb(route);
  }
}
