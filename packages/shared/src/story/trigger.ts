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
 * Pass recent fixes only: a pair stays valid for as long as it remains in
 * this list. The M6 session should trim the buffer; 60 s is enough.
 * A fix over the accuracy tolerance is skipped. An accurate fix outside the
 * radius clears the proximity pair. Accessible uses the latest accurate fix
 * within 35 ft of the point. The playing fragment is never a candidate.
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
  playingFragmentId: string | null;
}): TriggerCandidate[] {
  const fixes = [...input.fixes].sort(byTime);
  const out: TriggerCandidate[] = [];

  for (const fragment of input.fragments) {
    if (fragment.id === input.playingFragmentId) continue;
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
      // No radius never proximity-triggers. Packs omit radiusM only for physical fragments.
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

function chosenId(
  chosen: TriggerCandidate | { fragmentId: string; via: "scan" },
): string {
  return "fragment" in chosen ? chosen.fragment.id : chosen.fragmentId;
}

/**
 * Queue of one. A waiting proximity or accessible fragment leaves the slot
 * when it is no longer in range. A scan replaces whatever is waiting and
 * does not leave for range. A chosen fragment that is the one playing is
 * ignored. Before anything starts, `isEligible` is checked for every kind,
 * including a scan; a fragment that fails leaves the slot.
 */
export function queueAfterTrigger(input: {
  chosen: TriggerCandidate | { fragmentId: string; via: "scan" } | null;
  playingFragmentId: string | null;
  queued: QueuedFragment | null;
  afterglowEndsAt: Date | null;
  now: Date;
  stillInRange: (fragmentId: string) => boolean;
  /** Unlocked, not retired, a version for the current window, and not completed for the epoch. */
  isEligible: (fragmentId: string) => boolean;
}): { startNow: string | null; queued: QueuedFragment | null } {
  let slot: QueuedFragment | null = input.queued;
  if (slot && slot.via !== "scan" && !input.stillInRange(slot.fragmentId)) {
    slot = null;
  }

  const chosen =
    input.chosen && chosenId(input.chosen) !== input.playingFragmentId
      ? input.chosen
      : null;
  if (chosen) {
    if ("fragment" in chosen) {
      if (!slot) slot = { fragmentId: chosen.fragment.id, via: chosen.via };
    } else {
      slot = { fragmentId: chosen.fragmentId, via: "scan" };
    }
  }

  const playing = input.playingFragmentId !== null;
  const inAfterglow =
    input.afterglowEndsAt !== null && input.now < input.afterglowEndsAt;
  if (!playing && !inAfterglow && slot) {
    if (!input.isEligible(slot.fragmentId)) {
      return { startNow: null, queued: null };
    }
    if (slot.via === "scan" || input.stillInRange(slot.fragmentId)) {
      return { startNow: slot.fragmentId, queued: null };
    }
    return { startNow: null, queued: null };
  }

  return { startNow: null, queued: slot };
}
