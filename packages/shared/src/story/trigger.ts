import { distanceMeters } from "../geo/polygon";
import type { TimeWindow } from "../time/timeWindow";
import { feetToMeters } from "../units";
import { pickVersion, type FragmentInput } from "./unlock";

/** Two counted fixes must fall inside this span (PRODUCT_SPEC FR-3). */
export const TWO_FIX_WINDOW_MS = 60_000;

/** Accessible trigger radius: 35 ft of the fragment's point (FR-7). */
export const ACCESSIBLE_RADIUS_M = feetToMeters(35);

export type LocationFix = {
  at: Date;
  lat: number;
  lng: number;
  accuracyM: number;
};

export type TriggerVia = "proximity" | "accessible" | "scan";

export type TriggerCandidate = {
  fragment: FragmentInput;
  distanceM: number;
  via: "proximity" | "accessible";
};

export type QueuedFragment = {
  fragmentId: string;
  via: TriggerVia;
};

const TIER_RANK = { root: 0, branch: 1, leaf: 2 } as const;

function byTime(a: LocationFix, b: LocationFix): number {
  return a.at.getTime() - b.at.getTime();
}

function eligible(
  fragment: FragmentInput,
  unlockedIds: ReadonlySet<string>,
  completedEpochIds: ReadonlySet<string>,
  timeWindow: TimeWindow,
  lang: string,
): boolean {
  return (
    fragment.visibility === "standard" &&
    !fragment.retired &&
    unlockedIds.has(fragment.id) &&
    !completedEpochIds.has(fragment.id) &&
    pickVersion(fragment.versions, timeWindow, lang) !== undefined
  );
}

/**
 * Standard fragments the fix history can start.
 * A fix over the accuracy tolerance is skipped. An accurate fix outside the
 * radius clears the proximity pair. Accessible uses the latest accurate fix
 * within 35 ft of the point.
 */
export function proximityCandidates(input: {
  fragments: readonly FragmentInput[];
  fixes: readonly LocationFix[];
  accuracyToleranceM: number;
  unlockedIds: ReadonlySet<string>;
  completedEpochIds: ReadonlySet<string>;
  timeWindow: TimeWindow;
  lang: string;
  accessible: boolean;
}): TriggerCandidate[] {
  const fixes = [...input.fixes].sort(byTime);
  const out: TriggerCandidate[] = [];

  for (const fragment of input.fragments) {
    if (
      !eligible(
        fragment,
        input.unlockedIds,
        input.completedEpochIds,
        input.timeWindow,
        input.lang,
      )
    ) {
      continue;
    }

    const radiusM = fragment.radiusM;
    let lastInside: LocationFix | null = null;
    let proximity: LocationFix | null = null;
    let latestAccurate: LocationFix | null = null;

    for (const fix of fixes) {
      if (fix.accuracyM > input.accuracyToleranceM) continue;
      latestAccurate = fix;
      const distanceM = distanceMeters(fix, fragment);
      if (radiusM === undefined || distanceM > radiusM) {
        lastInside = null;
        proximity = null;
        continue;
      }
      if (
        lastInside &&
        fix.at.getTime() - lastInside.at.getTime() <= TWO_FIX_WINDOW_MS
      ) {
        proximity = fix;
        lastInside = fix;
      } else {
        lastInside = fix;
        proximity = null;
      }
    }

    if (proximity) {
      out.push({
        fragment,
        distanceM: distanceMeters(proximity, fragment),
        via: "proximity",
      });
      continue;
    }

    if (input.accessible && latestAccurate) {
      const distanceM = distanceMeters(latestAccurate, fragment);
      if (distanceM <= ACCESSIBLE_RADIUS_M) {
        out.push({ fragment, distanceM, via: "accessible" });
      }
    }
  }

  return out;
}

/** Root, then Branch, then Leaf, then nearest, then lower id. */
export function chooseTrigger(
  candidates: readonly TriggerCandidate[],
): TriggerCandidate | null {
  const sorted = [...candidates].sort((a, b) => {
    const tier = TIER_RANK[a.fragment.tier] - TIER_RANK[b.fragment.tier];
    if (tier !== 0) return tier;
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
    if (a.fragment.id < b.fragment.id) return -1;
    if (a.fragment.id > b.fragment.id) return 1;
    return 0;
  });
  return sorted[0] ?? null;
}

/** A physical scan plays only when the fragment is unlocked and has a version. */
export function scanDecision(
  fragment: FragmentInput,
  unlocked: boolean,
  hasVersion: boolean,
): { play: boolean } {
  return {
    play:
      fragment.visibility === "physical" &&
      !fragment.retired &&
      unlocked &&
      hasVersion,
  };
}

/**
 * Queue of one. A waiting proximity or accessible fragment leaves the slot
 * when it is no longer in range. A scan replaces whatever is waiting and
 * does not leave for range.
 */
export function queueAfterTrigger(input: {
  chosen: TriggerCandidate | { fragmentId: string; via: "scan" } | null;
  playingFragmentId: string | null;
  queued: QueuedFragment | null;
  afterglowEndsAt: Date | null;
  now: Date;
  stillInRange: (fragmentId: string) => boolean;
}): { startNow: string | null; queued: QueuedFragment | null } {
  let slot: QueuedFragment | null = input.queued;
  if (slot && slot.via !== "scan" && !input.stillInRange(slot.fragmentId)) {
    slot = null;
  }

  if (input.chosen) {
    if ("via" in input.chosen && input.chosen.via === "scan") {
      slot = { fragmentId: input.chosen.fragmentId, via: "scan" };
    } else if (!slot && "fragment" in input.chosen) {
      slot = { fragmentId: input.chosen.fragment.id, via: input.chosen.via };
    }
  }

  const playing = input.playingFragmentId !== null;
  const inAfterglow =
    input.afterglowEndsAt !== null && input.now < input.afterglowEndsAt;
  if (!playing && !inAfterglow && slot) {
    if (slot.via === "scan" || input.stillInRange(slot.fragmentId)) {
      return { startNow: slot.fragmentId, queued: null };
    }
    return { startNow: null, queued: null };
  }

  return { startNow: null, queued: slot };
}
