/**
 * Shared AudioEngine contract (AUDIO_SPEC §2.2).
 * Types only — no React Native imports. Mobile and admin Web Audio both implement this.
 */

export type BusId = "story" | "music" | "surroundings" | "ui" | "moment";
export type AudioRoute = "headphones" | "bluetooth" | "speaker" | "unknown";

export interface BufferHandle {
  readonly sha: string;
  readonly durationMs: number;
}

export interface VoiceHandle {
  readonly id: string;
}

export interface LoopGroupHandle {
  readonly id: string;
  readonly stemCount: number;
}

export interface NowPlayingMeta {
  title: string;
  artist: string;
  artworkUri?: string;
}

export interface EngineDiagnostics {
  uptimeMs: number;
  activeVoices: number;
  loopGroups: {
    id: string;
    stemPositionsMs: number[];
    /** Not measurable in Web Audio; optional / null. Prove alignment by ear (flam test). */
    maxStemDriftMs?: number | null;
  }[];
  narrationPositionMs?: number;
  underruns?: number;
  route: AudioRoute;
  /** Current decode-cache footprint (decoded PCM bytes). */
  decodedBytes?: number;
  /** How many LRU evictions have occurred since init. */
  cacheEvictions?: number;
  /** AudioContext.currentTime × 1000 at log time. */
  contextTimeMs?: number;
  /** Wall time since mix start (Date.now() based). */
  wallElapsedMs?: number;
  /** wallElapsedMs − contextTimeMs (adjusted for start offset). Growing gap = clock starve. */
  clockGapMs?: number;
  /** AudioContext.state */
  contextState?: string;
  /** React Native AppState: active | background | inactive */
  appState?: string;
  /** Whether the playback notification / FGS notification is shown. */
  notificationVisible?: boolean;
  /**
   * How far ahead (ms) the farthest pending one-shot is scheduled on the
   * audio clock. 0 if none pending.
   */
  scheduledAheadMs?: number;
  /**
   * Wall ms since the previous diagnostics write. Large values mean JS timers
   * (or the logging loop) did not run — typical when Android freezes JS while
   * locked.
   */
  jsTickGapMs?: number;
}

export interface AudioEngine {
  init(opts: { mixWithOthers: false }): Promise<void>;
  /** Decoded + LRU cached by sha (96 MB cap for the M1 spike). */
  load(sha: string, uri: string): Promise<BufferHandle>;
  playNarration(
    h: BufferHandle,
    meta: NowPlayingMeta,
    startAtMs?: number,
  ): VoiceHandle;
  pauseNarration(): void;
  resumeNarration(): void;
  playOneShot(
    h: BufferHandle,
    p: {
      bus: BusId;
      gainDb: number;
      pan: number;
      rate: number;
      /** Absolute AudioContext time; defaults to currentTime (immediate). */
      whenSec?: number;
    },
  ): VoiceHandle;
  startLoopGroup(
    bus: BusId,
    stems: {
      h: BufferHandle;
      gainDb: number;
      loopStartMs: number;
      loopEndMs: number;
    }[],
  ): LoopGroupHandle;
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
  ): VoiceHandle;
  setGain(
    target: VoiceHandle | LoopGroupHandle | BusId,
    gainDb: number,
    rampMs: number,
  ): void;
  setStemGain(
    group: LoopGroupHandle,
    index: number,
    gainDb: number,
    rampMs: number,
  ): void;
  stop(target: VoiceHandle | LoopGroupHandle, fadeMs: number): void;
  onRouteChange(cb: (route: AudioRoute) => void): () => void;
  onInterruption(cb: (e: "began" | "ended") => void): () => void;
  onNarrationProgress(
    cb: (p: { positionMs: number; durationMs: number }) => void,
  ): () => void;
  onRemoteCommand(
    cb: (
      c: "play" | "pause" | "skipForward" | "skipBackward" | "next",
    ) => void,
  ): () => void;
  getDiagnostics(): EngineDiagnostics;
  dispose(): Promise<void>;
}
