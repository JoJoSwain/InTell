/**
 * Narrow engine surface ExploringRuntime needs (RNAudioApiEngine or a fake).
 */
import type { AudioEngine, AudioRoute, BufferHandle } from "@intell/shared";
import type { AudioSessionController } from "../audio/session/AudioSessionController";

export type VoiceEndedEvent = {
  voiceId: string;
  kind: string;
  appState: string;
  reason: "ended" | "cancelled";
};

/** F6: AudioEngine remotes plus stopExploring forwarded by the engine. */
export type ExploringRemoteCommand =
  | "play"
  | "pause"
  | "skipForward"
  | "skipBackward"
  | "next"
  | "stopExploring";

export type ExploringEngine = Omit<AudioEngine, "onRemoteCommand"> & {
  load: (sha: string, uri: string, sampleRate?: number) => Promise<BufferHandle>;
  getSession: () => AudioSessionController;
  getContextCurrentTime: () => number;
  onTick: (cb: (ctxTimeSec: number) => void) => () => void;
  onVoiceEnded: (
    cb: (e: VoiceEndedEvent) => void | Promise<void>,
  ) => () => void;
  onInterruption: (cb: (e: "began" | "ended") => void) => () => void;
  onRouteChange: (cb: (route: AudioRoute) => void) => () => void;
  onNarrationProgress: (
    cb: (p: { positionMs: number; durationMs: number }) => void,
  ) => () => void;
  onRemoteCommand: (cb: (c: ExploringRemoteCommand) => void) => () => void;
  /** Fade-stop narration (session end). */
  stopAll?: (fadeMs: number) => Promise<void>;
  seekNarration?: (positionMs: number) => void;
  /** C1: silent heartbeats while exploring (no focus, no tour loop). */
  startSessionClock: () => void;
  stopSessionClock: () => void;
  /** Linear master gain (1 = full). Release diagnostics. */
  getMasterGainLinear?: () => number;
  /** Narration voice snapshot for diagnostics; null if none. */
  getNarrationDiag?: () => {
    id: string;
    paused: boolean;
    positionMs: number;
  } | null;
  /** Master-bus RMS in dBFS (AnalyserNode); null if unavailable. */
  getOutputLevelDb?: () => number | null;
};
