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

export type SessionBusyState = "ok" | "audioBusy" | "notificationDenied";

type EffectHandler = (effect: FocusEffect, mode: FocusMode) => void | Promise<void>;
type RemoteHandler = (command: RemoteEvent["command"]) => void | Promise<void>;
type BusyHandler = (state: SessionBusyState) => void;
type RouteHandler = (e: RouteEvent) => void;

type Sub = { remove(): void };

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

  getMode(): FocusMode {
    return this.mode;
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
      if (!ok) this.onBusy?.("notificationDenied");
      return ok;
    } catch {
      this.notificationWarning = true;
      this.onBusy?.("notificationDenied");
      return false;
    }
  }

  async start(meta: SessionMeta): Promise<boolean> {
    this.meta = { ...this.meta, ...meta };
    const focused = await NativeAudioSession.requestFocus();
    if (!focused) {
      this.onBusy?.("audioBusy");
      return false;
    }
    await NativeAudioSession.start(this.meta);
    this.started = true;
    this.mode = "playing";
    this.onBusy?.("ok");
    this.ensureListeners();
    return true;
  }

  async update(
    meta: Partial<SessionMeta>,
    state: PlaybackState,
  ): Promise<void> {
    this.meta = { ...this.meta, ...meta };
    if (!this.started) return;
    await NativeAudioSession.update(this.meta as SessionMeta, state);
  }

  async stop(): Promise<void> {
    this.clearListeners();
    if (this.started) {
      await NativeAudioSession.stop();
    }
    this.started = false;
    this.mode = "userPaused";
  }

  async requestFocus(): Promise<boolean> {
    const ok = await NativeAudioSession.requestFocus();
    if (!ok) this.onBusy?.("audioBusy");
    else this.onBusy?.("ok");
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
   * User / remote play. Re-requests focus; refuses if denied ("audio busy").
   */
  async userPlay(): Promise<boolean> {
    const focused = await this.requestFocus();
    if (!focused) return false;
    await this.applyAction({ type: "userPlay" });
    if (this.started) {
      await this.update({}, "playing");
    }
    return true;
  }

  private ensureListeners(): void {
    if (this.subs.length > 0) return;
    this.subs.push(
      NativeAudioSession.addListener("focusChange", (e) => {
        void this.onFocusChange(e);
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

  private async onFocusChange(e: FocusChangeEvent): Promise<void> {
    await this.applyAction({
      type: "focus",
      change: {
        kind: e.kind,
        shouldResume: e.shouldResume,
      },
    });
    if (e.kind === "gain" && this.mode === "suspendedLoss") {
      // Review: try again on next gain after a denied play — no auto resume.
      // If we were previously audioBusy, clear the busy flag so next play can retry.
      this.onBusy?.("ok");
    }
  }

  private async onRoute(e: RouteEvent): Promise<void> {
    this.onRouteChange?.(e);
    if (e.route === "speaker") {
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
