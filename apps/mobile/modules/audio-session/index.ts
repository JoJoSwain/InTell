import { requireNativeModule, type EventSubscription } from "expo";

export type SessionMeta = {
  title: string;
  artist: string;
  /** Optional; native falls back to the app icon. */
  artworkUri?: string;
};

export type PlaybackState = "playing" | "paused" | "stopped";

export type FocusKind = "loss" | "lossTransient" | "duck" | "gain";

export type FocusChangeEvent = {
  kind: FocusKind;
  shouldResume?: boolean;
};

export type RemoteCommand = "play" | "pause" | "skipBack" | "stopExploring";

export type RemoteEvent = { command: RemoteCommand };

export type RouteKind = "headphones" | "bluetooth" | "speaker" | "unknown";

export type RouteEvent = {
  route: RouteKind;
  deviceType?: string;
};

type NativeAudioSession = {
  start(meta: SessionMeta): Promise<void>;
  update(meta: SessionMeta, state: PlaybackState): Promise<void>;
  stop(): Promise<void>;
  requestFocus(): Promise<boolean>;
  abandonFocus(): Promise<void>;
  /** Native Log.i — survives release stripping of console.log. */
  logContextState(state: string): Promise<void>;
  /** Native Log.w tag InTellAudio — release diagnostics (M6 review 5). */
  logBreadcrumb(message: string): Promise<void>;
  addListener(
    event: "focusChange",
    listener: (e: FocusChangeEvent) => void,
  ): EventSubscription;
  addListener(
    event: "remote",
    listener: (e: RemoteEvent) => void,
  ): EventSubscription;
  addListener(event: "noisy", listener: () => void): EventSubscription;
  addListener(
    event: "route",
    listener: (e: RouteEvent) => void,
  ): EventSubscription;
};

const Native =
  requireNativeModule<NativeAudioSession>("AudioSession");

export default Native;
