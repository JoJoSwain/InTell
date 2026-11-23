import type { MarkerState, PulseKind } from "@intell/shared";
import { strings } from "../ui/strings";
import type { WebTier } from "./web";

export function markerLocked(state: MarkerState): boolean {
  return !state.hidden && state.opacity === 0.35;
}

export function markerPulse(state: MarkerState): PulseKind {
  return state.pulse;
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

export function accessibilityLabel(
  tier: WebTier,
  pulse: PulseKind,
  locked: boolean,
  card: string,
): string {
  const tierName =
    tier === "root" ? strings.tierRoot : tier === "branch" ? strings.tierBranch : strings.tierLeaf;
  const state = locked
    ? strings.stateLocked
    : pulse === "changed"
      ? strings.stateChanged
      : pulse === "tier"
        ? strings.stateUnexplored
        : strings.stateCompleted;
  return `${tierName}, ${state}. ${card}`;
}
