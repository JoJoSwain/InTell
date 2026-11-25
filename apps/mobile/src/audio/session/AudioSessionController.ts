/**
 * Thin JS owner of the native `audio-session` module + focus state machine.
 * Engine / spike subscribe here; UI never imports the native module.
 */
import { PermissionsAndroid, Platform } from "react-native";
import NativeAudioSession, {
  type FocusChangeEvent,
  type PlaybackState,
  type RemoteEvent,
  type RouteEvent,
  type SessionMeta,
} from "audio-session";
import {
  FOCUS_DUCK_DB,
  FOCUS_RESUME_FADE_MS,
  reduceFocus,
  type FocusEffect,
  type FocusMode,
} from "./focusMachine";
import { requestFocusWithRetry } from "./requestFocusWithRetry";

export type SessionBusyState = "ok" | "audioBusy" | "notificationDenied";

type EffectHandler = (effect: FocusEffect, mode: FocusMode) => void | Promise<void>;
type RemoteHandler = (command: RemoteEvent["command"]) => void | Promise<void>;
type BusyHandler = (state: SessionBusyState) => void;
type RouteHandler = (e: RouteEvent) => void;

type Sub = { remove(): void };

export type AudioSessionDeps = {
  /** Override for unit tests. Defaults to native requestFocus. */
  requestFocusOnce?: () => Promise<boolean>;
  /** Override native update for tests. */
  updateSession?: (
    meta: SessionMeta,
    state: PlaybackState,
  ) => Promise<void>;
};

export class AudioSessionController {
  private mode: FocusMode = "userPaused";
  private meta: SessionMeta = { title: "InTell", artist: "" };
  private started = false;
  private subs: Sub[] = [];
  private onEffect: EffectHandler | null = null;
  private onRemote: RemoteHandler | null = null;
  private onBusy: BusyHandler | null = null;
  private onRouteChange: RouteHandler | null = null;
  private notificationWarning = false;
  /** Last route from the module; null until the first event (no pause on initial speaker). */
  private lastRoute: RouteEvent["route"] | null = null;
  private busy: SessionBusyState = "ok";
  private readonly deps: AudioSessionDeps;

  constructor(deps: AudioSessionDeps = {}) {
    this.deps = deps;
  }

  getMode(): FocusMode {
    return this.mode;
  }

  getBusy(): SessionBusyState {
    return this.busy;
  }

  isStarted(): boolean {
    return this.started;
  }

  hadNotificationDenied(): boolean {
    return this.notificationWarning;
  }

  setEffectHandler(handler: EffectHandler | null): void {
    this.onEffect = handler;
  }

  setRemoteHandler(handler: RemoteHandler | null): void {
    this.onRemote = handler;
  }

  setBusyHandler(handler: BusyHandler | null): void {
    this.onBusy = handler;
  }

  setRouteHandler(handler: RouteHandler | null): void {
    this.onRouteChange = handler;
  }

  /**
   * Ask for POST_NOTIFICATIONS (API 33+) from a user gesture (Start).
   * Mix still plays if denied; caller should surface a warning.
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    if (typeof Platform.Version === "number" && Platform.Version < 33) {
      return true;
    }
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      const ok = result === PermissionsAndroid.RESULTS.GRANTED;
      this.notificationWarning = !ok;
      if (!ok) this.setBusy("notificationDenied");
      return ok;
    } catch {
      this.notificationWarning = true;
      this.setBusy("notificationDenied");
      return false;
    }
  }

  async start(meta: SessionMeta): Promise<boolean> {
    this.meta = { ...this.meta, ...meta };
    const focused = await this.requestFocusOnce();
    if (!focused) {
      this.setBusy("audioBusy");
      return false;
    }
    await NativeAudioSession.start(this.meta);
    this.started = true;
    this.mode = "playing";
    this.setBusy("ok");
    this.ensureListeners();
    return true;
  }

  async update(
    meta: Partial<SessionMeta>,
    state: PlaybackState,
  ): Promise<void> {
    this.meta = { ...this.meta, ...meta };
    if (!this.started) return;
    if (this.deps.updateSession) {
      await this.deps.updateSession(this.meta as SessionMeta, state);
      return;
    }
    await NativeAudioSession.update(this.meta as SessionMeta, state);
  }

  async stop(): Promise<void> {
    this.clearListeners();
    if (this.started) {
      await NativeAudioSession.stop();
    }
    this.started = false;
    this.mode = "userPaused";
    this.lastRoute = null;
  }

  async requestFocus(): Promise<boolean> {
    const ok = await this.requestFocusOnce();
    if (!ok) this.setBusy("audioBusy");
    else this.setBusy("ok");
    return ok;
  }

  async abandonFocus(): Promise<void> {
    await NativeAudioSession.abandonFocus();
  }

  /** Apply a user pause (UI or remote). */
  async userPause(): Promise<void> {
    await this.applyAction({ type: "userPause" });
    if (this.started) {
      await this.update({}, "paused");
    }
  }

  /**
   * User / remote play. Media-session play promotes FGS first (native);
   * then we retry focus, then resume. Denied → stay paused + "audio busy".
   */
  async userPlay(): Promise<boolean> {
    const { ok, attempts } = await requestFocusWithRetry(
      () => this.requestFocusOnce(),
      { tries: 3, gapMs: 500 },
    );
    if (!ok) {
      console.warn(
        "[AudioHardening] focus denied after retries — staying paused (audio busy)",
        { attempts },
      );
      this.setBusy("audioBusy");
      // Stay in a paused mode; do not apply userPlay.
      if (
        this.mode === "playing" ||
        this.mode === "ducked"
      ) {
        await this.applyAction({ type: "userPause" });
      }
      if (this.started) {
        await this.update({}, "paused");
      }
      return false;
    }
    this.setBusy("ok");
    await this.applyAction({ type: "userPlay" });
    if (this.started) {
      await this.update({}, "playing");
    }
    return true;
  }

  /** Test helper: set mode without native side effects. */
  setModeForTest(mode: FocusMode): void {
    this.mode = mode;
  }

  /** Test helper: mark session started without native start. */
  markStartedForTest(started = true): void {
    this.started = started;
  }

  private requestFocusOnce(): Promise<boolean> {
    if (this.deps.requestFocusOnce) {
      return this.deps.requestFocusOnce();
    }
    return NativeAudioSession.requestFocus();
  }

  private setBusy(state: SessionBusyState): void {
    this.busy = state;
    this.onBusy?.(state);
  }

  private ensureListeners(): void {
    if (this.subs.length > 0) return;
    this.subs.push(
      NativeAudioSession.addListener("focusChange", (e) => {
        void this.applyFocusEvent(e);
      }),
    );
    this.subs.push(
      NativeAudioSession.addListener("remote", (e) => {
        void this.onRemoteEvent(e);
      }),
    );
    this.subs.push(
      NativeAudioSession.addListener("noisy", () => {
        void this.applyAction({ type: "noisy" });
        void this.update({}, "paused");
      }),
    );
    this.subs.push(
      NativeAudioSession.addListener("route", (e) => {
        void this.onRoute(e);
      }),
    );
  }

  private clearListeners(): void {
    for (const s of this.subs) s.remove();
    this.subs = [];
  }

  /** Native focus listener and unit tests. */
  async applyFocusEvent(e: FocusChangeEvent): Promise<void> {
    await this.applyAction({
      type: "focus",
      change: {
        kind: e.kind,
        shouldResume: e.shouldResume,
      },
    });
    // A later gain clears "audio busy" so the next play can retry.
    if (e.kind === "gain") {
      this.setBusy("ok");
    }
  }

  private async onRoute(e: RouteEvent): Promise<void> {
    const prev = this.lastRoute;
    this.lastRoute = e.route;
    this.onRouteChange?.(e);
    const lostExternal =
      prev != null &&
      prev !== "speaker" &&
      prev !== "unknown" &&
      e.route === "speaker";
    if (lostExternal) {
      await this.applyAction({ type: "routeSpeaker" });
      await this.update({}, "paused");
    }
  }

  private async onRemoteEvent(e: RemoteEvent): Promise<void> {
    if (e.command === "pause") {
      await this.userPause();
      await this.onRemote?.("pause");
      return;
    }
    if (e.command === "play") {
      // FGS already promoted by the media-session command before this event.
      const ok = await this.userPlay();
      if (ok) await this.onRemote?.("play");
      return;
    }
    if (e.command === "skipBack") {
      await this.onRemote?.("skipBack");
    }
  }

  private async applyAction(
    action: Parameters<typeof reduceFocus>[1],
  ): Promise<void> {
    const transition = reduceFocus(this.mode, action);
    this.mode = transition.mode;
    const effect = transition.effect;
    if (effect.type === "duck") {
      await this.onEffect?.({ type: "duck", db: FOCUS_DUCK_DB }, this.mode);
      return;
    }
    if (effect.type === "resumeFadeIn") {
      await this.onEffect?.(
        { type: "resumeFadeIn", ms: FOCUS_RESUME_FADE_MS },
        this.mode,
      );
      return;
    }
    await this.onEffect?.(effect, this.mode);
  }
}

export { FOCUS_DUCK_DB, FOCUS_RESUME_FADE_MS };
