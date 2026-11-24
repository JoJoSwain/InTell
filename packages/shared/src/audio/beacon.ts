import { distanceMeters, type LatLng } from "../geo/polygon";
import { BEACON_RANGE_M, BEACON_TIER_NEAR_M } from "./soundFeatures";

const TIER_RANK = { root: 0, branch: 1, leaf: 2 } as const;

function bearingDeg(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function norm180(deg: number): number {
  let d = ((deg + 180) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Gain falls with distance (silent beyond BEACON_RANGE_M).
 * Pan from relative bearing; with no course, hold lastPan.
 * Behind the listener → lowpass.
 */
export function beaconMix(
  listener: LatLng,
  courseDeg: number | null,
  target: LatLng,
  lastPan: number,
): { gainDb: number; pan: number; lowpassHz: number } {
  const d = distanceMeters(listener, target);
  if (d > BEACON_RANGE_M) {
    return { gainDb: Number.NEGATIVE_INFINITY, pan: lastPan, lowpassHz: 18_000 };
  }
  const t = 1 - d / BEACON_RANGE_M;
  const gainDb = -6 + 12 * t; // about -6 at edge, +6 near

  let pan = lastPan;
  let relative = 0;
  if (courseDeg !== null) {
    const brg = bearingDeg(listener, target);
    relative = norm180(brg - courseDeg);
    pan = Math.max(-1, Math.min(1, relative / 90));
  }

  const behind = courseDeg !== null && Math.abs(relative) > 90;
  const lowpassHz = behind ? 2_000 : 18_000;
  return { gainDb, pan, lowpassHz };
}

export type BeaconCandidate = {
  id: string;
  tier: "root" | "branch" | "leaf";
  lat: number;
  lng: number;
};

/**
 * One beacon: nearest unexplored playable; Root>Branch>Leaf within 10 m;
 * switch only if closer by >10 m; none while narration / disabled / speaker.
 */
export function chooseBeacon(input: {
  listener: LatLng;
  playableUnexplored: readonly BeaconCandidate[];
  currentId: string | null;
  narrationPlaying: boolean;
  beaconsEnabled: boolean;
  headphones: boolean;
}): string | null {
  if (
    !input.beaconsEnabled ||
    !input.headphones ||
    input.narrationPlaying ||
    input.playableUnexplored.length === 0
  ) {
    return null;
  }

  const ranked = [...input.playableUnexplored]
    .map((c) => ({
      ...c,
      distanceM: distanceMeters(input.listener, c),
    }))
    .filter((c) => c.distanceM <= BEACON_RANGE_M)
    .sort((a, b) => {
      if (Math.abs(a.distanceM - b.distanceM) <= BEACON_TIER_NEAR_M) {
        const tier = TIER_RANK[a.tier] - TIER_RANK[b.tier];
        if (tier !== 0) return tier;
      }
      if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const best = ranked[0];
  if (!best) return null;

  if (input.currentId) {
    const current = ranked.find((c) => c.id === input.currentId);
    if (
      current &&
      best.id !== current.id &&
      current.distanceM - best.distanceM <= BEACON_TIER_NEAR_M
    ) {
      return input.currentId;
    }
  }
  return best.id;
}
