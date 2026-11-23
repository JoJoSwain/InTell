import type { MarkerState } from "@intell/shared";

/** Stand-in until A2 makes `pulse` the string "tier" | "changed" | "none". */
export function legacyPulse(state: MarkerState): "tier" | "changed" | "none" {
  if (state.hidden || state.opacity === 0 || state.opacity === 0.35) return "none";
  if (state.pulse) return "changed";
  if (state.playableNow) return "tier";
  return "none";
}

export function markerLocked(state: MarkerState): boolean {
  return !state.hidden && state.opacity === 0.35;
}

export function isOnScreen(
  point: { latitude: number; longitude: number },
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number },
): boolean {
  return (
    Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 &&
    Math.abs(point.longitude - region.longitude) <= region.longitudeDelta / 2
  );
}
