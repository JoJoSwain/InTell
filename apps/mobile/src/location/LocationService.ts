/**
 * Location modes for exploring (M6 / R2 / B6).
 * High accuracy for the whole session. One source at a time.
 * Starts the location FGS only while the app is foregrounded.
 * Never logs coordinates.
 */
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import {
  EXPLORING_LOCATION_TASK,
  setExploringLocationListener,
  type LocationFixListener,
} from "./locationTask";

export type LocationMode = "idle" | "foreground" | "balanced" | "high";

const LOCATION_NOTIFICATION = {
  notificationTitle: "InTell is playing your Grove",
  notificationBody: "Open the app to stop exploring.",
  notificationColor: "#295E7C",
} as const;

/**
 * B6: High for the whole session (Balanced ≈ 100 m on Android — too coarse for
 * the 25 m accuracy tolerance). balanced and high both map to High.
 */
function sessionAccuracy(): Location.LocationAccuracy {
  return Location.Accuracy.High;
}

export class LocationService {
  private mode: LocationMode = "idle";
  private watch: { remove: () => void } | null = null;
  private background = false;
  private onFix: LocationFixListener | null = null;
  private onStopRequest: (() => void) | null = null;
  /** Drop duplicate / stale fixes (B6). */
  private lastFixAt = 0;

  setFixListener(listener: LocationFixListener | null): void {
    this.onFix = listener;
    setExploringLocationListener((fix) => this.emitFix(fix));
  }

  setStopRequestListener(listener: (() => void) | null): void {
    this.onStopRequest = listener;
  }

  getMode(): LocationMode {
    return this.mode;
  }

  isAppActive(): boolean {
    return AppState.currentState === "active";
  }

  async setMode(mode: LocationMode): Promise<void> {
    // Collapse balanced → high (B6).
    const next: LocationMode = mode === "balanced" ? "high" : mode;
    if (next === this.mode && next !== "idle") return;
    this.mode = next;
    console.info("location mode", next);

    if (next === "idle") {
      await this.stopAll();
      return;
    }

    if (next === "foreground") {
      await this.stopBackground();
      await this.ensureForegroundWatch();
      return;
    }

    // high (session) — FGS only; one source (B6)
    if (!this.isAppActive()) {
      console.info("location fgs deferred until active");
      await this.ensureForegroundWatch();
      return;
    }
    await this.ensureBackground();
  }

  async onAppBecameActive(): Promise<void> {
    if (this.mode === "high") {
      await this.ensureBackground();
    }
  }

  /** @deprecated B6 dropped balanced↔high switching; kept as no-op for callers. */
  async applyProximityDistance(_distanceM: number | null): Promise<void> {
    return;
  }

  private emitFix(fix: {
    at: number;
    lat: number;
    lng: number;
    accuracyM: number;
  }): void {
    if (fix.at <= this.lastFixAt) return;
    this.lastFixAt = fix.at;
    this.onFix?.(fix);
  }

  private async ensureForegroundWatch(): Promise<void> {
    if (this.watch) return;
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      console.info("location permission denied");
      return;
    }
    this.watch = await Location.watchPositionAsync(
      {
        accuracy: sessionAccuracy(),
        distanceInterval: 5,
        timeInterval: 2000,
      },
      (position) => {
        this.emitFix({
          at: position.timestamp,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? 50,
        });
      },
    );
  }

  private async ensureBackground(): Promise<void> {
    if (!this.isAppActive()) {
      console.info("location fgs refused: app not active");
      return;
    }
    // B6: stop the on-screen watch so each fix arrives once.
    this.watch?.remove();
    this.watch = null;

    const started = await Location.hasStartedLocationUpdatesAsync(EXPLORING_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(EXPLORING_LOCATION_TASK);
    }

    try {
      await Location.startLocationUpdatesAsync(EXPLORING_LOCATION_TASK, {
        accuracy: sessionAccuracy(),
        timeInterval: 2000,
        distanceInterval: 5,
        deferredUpdatesInterval: 2000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          ...LOCATION_NOTIFICATION,
          killServiceOnDestroy: true,
        },
        pausesUpdatesAutomatically: false,
      });
      this.background = true;
      console.info("location fgs started", Platform.OS);
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      console.info("location fgs start failed", message);
      this.background = false;
      // Fall back to watch so exploring still gets fixes while on screen.
      await this.ensureForegroundWatch();
    }
  }

  private async stopBackground(): Promise<void> {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(EXPLORING_LOCATION_TASK);
      if (started) await Location.stopLocationUpdatesAsync(EXPLORING_LOCATION_TASK);
    } catch {
      // ignore
    }
    this.background = false;
  }

  private async stopAll(): Promise<void> {
    this.watch?.remove();
    this.watch = null;
    await this.stopBackground();
    this.lastFixAt = 0;
    console.info("location stopped");
  }

  isBackgroundRunning(): boolean {
    return this.background;
  }

  requestStop(): void {
    this.onStopRequest?.();
  }
}
