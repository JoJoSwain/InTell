import { GROVE_BUFFER_M } from "../geo/groveShape";
import { distanceMeters, type LatLng } from "../geo/polygon";
import { DEPTH_BLOOM_HYSTERESIS_M } from "./soundFeatures";

export type Tier = "root" | "branch" | "leaf";

/** Enter/exit latch with hysteresis. JSON-safe boolean. */
export function depthConditionLatched(
  prev: boolean,
  depthM: number,
  thresholdM: number,
  hysteresisM: number = DEPTH_BLOOM_HYSTERESIS_M,
): boolean {
  if (prev) return depthM >= thresholdM - hysteresisM;
  return depthM >= thresholdM + hysteresisM;
}

/**
 * Which tier buffer circles contain the point, with hysteresis on each tier.
 * State is a sorted string array (serializable), not a Set.
 */
export function insideTierBuffersLatched(
  prev: readonly Tier[],
  point: LatLng,
  playableFragments: readonly {
    tier: Tier;
    lat: number;
    lng: number;
  }[],
  hysteresisM: number = DEPTH_BLOOM_HYSTERESIS_M,
): Tier[] {
  const prevSet = new Set(prev);
  const next = new Set<Tier>();
  for (const tier of ["root", "branch", "leaf"] as const) {
    const radius = GROVE_BUFFER_M[tier];
    let nearest = Infinity;
    for (const f of playableFragments) {
      if (f.tier !== tier) continue;
      nearest = Math.min(nearest, distanceMeters(point, f));
    }
    if (nearest === Infinity) continue;
    const wasIn = prevSet.has(tier);
    const enter = nearest <= radius - hysteresisM;
    const stay = nearest <= radius + hysteresisM;
    if (wasIn ? stay : enter) next.add(tier);
  }
  return (["root", "branch", "leaf"] as const).filter((t) => next.has(t));
}
