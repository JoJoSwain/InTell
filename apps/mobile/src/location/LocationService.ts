/**
 * Location modes for exploring (M6 / R2 / R3).
 * Starts the location FGS only while the app is foregrounded.
 * Never logs coordinates.
 */
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import { LOCATION_HIGH_WITHIN_M } from "@intell/shared";
import {
  EXPLORING_LOCATION_TASK,
  setExploringLocationListener,
  type LocationFixListener,
} from "./locationTask";

export type LocationMode = "idle" | "foreground" | "balanced" | "high";

const LOCATION_NOTIFICATION = {
  notificationTitle: "InTell is playing your Grove",
  notificationBody: "Tap Stop exploring in the app to end this session.",
  notificationColor: "#295E7C",
} as const;

/**
 * Gap (R3): expo-location 58's LocationTaskService has no custom notification
 * actions API, so Stop cannot be a shade button yet — open-app + grove chip Stop.
 */

export class LocationService {
  private mode: LocationMode = "idle";
  private watch: { remove: () => void } | null = null;
  private background = false;
  private onFix: LocationFixListener | null = null;
  private onStopRequest: (() => void) | null = null;

  setFixListener(listener: LocationFixListener | null): void {
    this.onFix = listener;
    setExploringLocationListener(listener);
  }

  setStopRequestListener(listener: (() => void) | null): void {
    this.onStopRequest = listener;
  }

  getMode(): LocationMode {
    return this.mode;
  }

  /** R2: only start session FGS when AppState is active. */
  isAppActive(): boolean {
    return AppState.currentState === "active";
  }

  async setMode(mode: LocationMode): Promise<void> {
    if (mode === this.mode && mode !== "idle") {
      // Still allow accuracy bump balanced ↔ high
      if (mode === "balanced" || mode === "high") {
        await this.ensureBackground(mode);
      }
      return;
    }
    const prev = this.mode;
    this.mode = mode;
    console.info("location mode", mode);

    if (mode === "idle") {
      await this.stopAll();
      return;
    }

    if (mode === "foreground") {
      if (prev === "balanced" || prev === "high") await this.stopBackground();
      await this.ensureForegroundWatch();
      return;
    }

    // balanced | high — session
    if (!this.isAppActive()) {
      // R2: process restarted in background while exploring — wait for active.
      console.info("location fgs deferred until active");
      await this.ensureForegroundWatch();
      return;
    }
    await this.ensureBackground(mode);
  }

  /** Call when AppState becomes active and session is still exploring. */
  async onAppBecameActive(): Promise<void> {
    if (this.mode === "balanced" || this.mode === "high") {
      await this.ensureBackground(this.mode);
    }
  }

  /**
   * Choose balanced vs high from distance to nearest candidate (metres).
   * Shell passes the distance; we never log the point.
   */
  async applyProximityDistance(distanceM: number | null): Promise<void> {
    if (this.mode !== "balanced" && this.mode !== "high") return;
    const next: LocationMode =
      distanceM !== null && distanceM <= LOCATION_HIGH_WITHIN_M ? "high" : "balanced";
    if (next !== this.mode) await this.setMode(next);
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
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 5,
        timeInterval: 2000,
      },
      (position) => {
        this.onFix?.({
          at: position.timestamp,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? 50,
        });
      },
    );
  }

  private async ensureBackground(mode: "balanced" | "high"): Promise<void> {
    await this.ensureForegroundWatch();
    if (!this.isAppActive()) {
      console.info("location fgs refused: app not active");
      return;
    }
    const accuracy =
      mode === "high" ? Location.Accuracy.High : Location.Accuracy.Balanced;
    const timeInterval = mode === "high" ? 2000 : 5000;
    const distanceInterval = mode === "high" ? 5 : 10;

    const started = await Location.hasStartedLocationUpdatesAsync(EXPLORING_LOCATION_TASK);
    if (started) {
      // Restart with new options
      await Location.stopLocationUpdatesAsync(EXPLORING_LOCATION_TASK);
    }

    try {
      await Location.startLocationUpdatesAsync(EXPLORING_LOCATION_TASK, {
        accuracy,
        timeInterval,
        distanceInterval,
        deferredUpdatesInterval: timeInterval,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          ...LOCATION_NOTIFICATION,
          killServiceOnDestroy: true,
        },
        // While Using only — never request background permission.
        pausesUpdatesAutomatically: false,
      });
      this.background = true;
      console.info("location fgs started", Platform.OS);
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown";
      console.info("location fgs start failed", message);
      this.background = false;
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
    console.info("location stopped");
  }

  /** Test helper / report: whether background updates are running. */
  isBackgroundRunning(): boolean {
    return this.background;
  }

  /** Invoked if a future native Stop action lands. */
  requestStop(): void {
    this.onStopRequest?.();
  }
}
