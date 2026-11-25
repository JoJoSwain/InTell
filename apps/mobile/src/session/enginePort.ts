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

export type ExploringEngine = AudioEngine & {
  load: (sha: string, uri: string, sampleRate?: number) => Promise<BufferHandle>;
  getSession: () => AudioSessionController;
  getContextCurrentTime: () => number;
  onTick: (cb: (ctxTimeSec: number) => void) => () => void;
  onVoiceEnded: (cb: (e: VoiceEndedEvent) => void) => () => void;
  onInterruption: (cb: (e: "began" | "ended") => void) => () => void;
  onRouteChange: (cb: (route: AudioRoute) => void) => () => void;
  onNarrationProgress: (
    cb: (p: { positionMs: number; durationMs: number }) => void,
  ) => () => void;
  onRemoteCommand: (
    cb: (c: "play" | "pause" | "skipForward" | "skipBackward" | "next") => void,
  ) => () => void;
  /** Fade-stop narration (session end). */
  stopAll?: (fadeMs: number) => Promise<void>;
  seekNarration?: (positionMs: number) => void;
};
