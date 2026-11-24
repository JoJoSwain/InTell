import { distanceMeters, type LatLng } from "../geo/polygon";
import {
  BEACON_GAIN_FAR_DB,
  BEACON_GAIN_NEAR_DB,
  BEACON_RANGE_M,
  BEACON_TIER_NEAR_M,
} from "./soundFeatures";

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

/** Pan from relative bearing; back half is mirrored so 180° is centered. */
export function beaconPanFromRelative(relativeDeg: number): number {
  const abs = Math.abs(relativeDeg);
  if (abs === 0 || abs === 180) return 0;
  const signed = relativeDeg > 0 ? 1 : -1;
  if (abs <= 90) return signed * (abs / 90);
  return signed * ((180 - abs) / 90);
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
  // Linear in dB: NEAR at 0 m → FAR at range edge
  const t = d / BEACON_RANGE_M;
  const gainDb =
    BEACON_GAIN_NEAR_DB + (BEACON_GAIN_FAR_DB - BEACON_GAIN_NEAR_DB) * t;

  let pan = lastPan;
  let relative = 0;
  if (courseDeg !== null) {
    const brg = bearingDeg(listener, target);
    relative = norm180(brg - courseDeg);
    pan = beaconPanFromRelative(relative);
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
 * One beacon: nearest unexplored playable; among those within
 * BEACON_TIER_NEAR_M of the nearest, pick Root>Branch>Leaf then distance then id;
 * switch only if closer by > BEACON_TIER_NEAR_M; none while narration / disabled / speaker.
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

  const inRange = input.playableUnexplored
    .map((c) => ({
      ...c,
      distanceM: distanceMeters(input.listener, c),
    }))
    .filter((c) => c.distanceM <= BEACON_RANGE_M);

  if (inRange.length === 0) return null;

  const d0 = Math.min(...inRange.map((c) => c.distanceM));
  const band = inRange.filter((c) => c.distanceM <= d0 + BEACON_TIER_NEAR_M);

  band.sort((a, b) => {
    const tier = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tier !== 0) return tier;
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const best = band[0];
  if (!best) return null;

  if (input.currentId) {
    const current = inRange.find((c) => c.id === input.currentId);
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
