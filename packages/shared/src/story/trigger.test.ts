import { describe, expect, it } from "vitest";
import {
  ACCESSIBLE_RADIUS_M,
  chooseTrigger,
  proximityCandidates,
  queueAfterTrigger,
  scanDecision,
  TWO_FIX_WINDOW_MS,
  type LocationFix,
  type TriggerCandidate,
} from "./trigger";
import type { FragmentInput } from "./unlock";

const HERE = { lat: 40.98, lng: -111.9 };

function north(meters: number): { lat: number; lng: number } {
  return {
    lat: HERE.lat + (meters / 6_371_000) * (180 / Math.PI),
    lng: HERE.lng,
  };
}

function fragment(overrides: Partial<FragmentInput> = {}): FragmentInput {
  return {
    id: "leaf-near",
    groveId: "grove-1",
    tier: "leaf",
    visibility: "standard",
    retired: false,
    lat: HERE.lat,
    lng: HERE.lng,
    radiusM: 10,
    requires: [],
    threadIds: [],
    contingencyRevisionNo: 1,
    versions: [{ lang: "en", timeWindow: "day" }],
    ...overrides,
  };
}

function fix(atMs: number, metersNorth: number, accuracyM = 5): LocationFix {
  const point = north(metersNorth);
  return { at: new Date(atMs), lat: point.lat, lng: point.lng, accuracyM };
}

function candidates(
  fragments: FragmentInput[],
  fixes: LocationFix[],
  extra: {
    accessible?: boolean;
    completed?: string[];
    unlocked?: string[];
    playingFragmentId?: string | null;
  } = {},
) {
  const unlocked = new Set(extra.unlocked ?? fragments.map((item) => item.id));
  return proximityCandidates({
    fragments,
    fixes,
    accuracyToleranceM: 10,
    unlockedIds: unlocked,
    completedEpochIds: new Set(extra.completed ?? []),
    timeWindow: "day",
    lang: "en",
    accessible: extra.accessible ?? false,
    playingFragmentId: extra.playingFragmentId ?? null,
  });
}

describe("proximityCandidates", () => {
  it("fires on two accurate fixes inside the radius and within 60 s", () => {
    const frag = fragment();
    expect(candidates([frag], [fix(0, 0), fix(TWO_FIX_WINDOW_MS, 0)])).toHaveLength(1);
    expect(candidates([frag], [fix(0, 0), fix(TWO_FIX_WINDOW_MS + 1, 0)])).toEqual([]);
    expect(candidates([frag], [fix(0, 0)])).toEqual([]);
  });

  it("skips an inaccurate fix and breaks the pair on an accurate fix outside the radius", () => {
    const frag = fragment();
    expect(
      candidates(
        [frag],
        [fix(0, 0), fix(10_000, 0, 11), fix(20_000, 0)],
      ),
    ).toHaveLength(1);
    expect(
      candidates(
        [frag],
        [fix(0, 0), fix(10_000, 20), fix(20_000, 0)],
      ),
    ).toEqual([]);
  });

  it("never fires a physical fragment from location", () => {
    const frag = fragment({ visibility: "physical", radiusM: undefined });
    expect(candidates([frag], [fix(0, 0), fix(1_000, 0)])).toEqual([]);
  });

  it("uses one fix within 35 ft when accessible play is on", () => {
    const small = fragment({ radiusM: 5 });
    expect(candidates([small], [fix(0, 4)])).toEqual([]);
    expect(candidates([small], [fix(0, 4)], { accessible: true })).toMatchObject([
      { via: "accessible" },
    ]);
    expect(candidates([small], [fix(0, 4)], { accessible: true })[0]?.distanceM).toBeLessThan(
      ACCESSIBLE_RADIUS_M,
    );
    expect(candidates([small], [fix(0, 12)], { accessible: true })).toEqual([]);
    const physical = fragment({ visibility: "physical", radiusM: undefined });
    expect(candidates([physical], [fix(0, 0)], { accessible: true })).toEqual([]);
  });

  it("does not fire when locked, out of window, retired, or already completed", () => {
    const frag = fragment();
    expect(candidates([frag], [fix(0, 0), fix(1_000, 0)], { unlocked: [] })).toEqual(
      [],
    );
    expect(
      candidates([fragment({ versions: [{ lang: "en", timeWindow: "night" }] })], [
        fix(0, 0),
        fix(1_000, 0),
      ]),
    ).toEqual([]);
    expect(
      candidates([fragment({ retired: true })], [fix(0, 0), fix(1_000, 0)]),
    ).toEqual([]);
    expect(
      candidates([frag], [fix(0, 0), fix(1_000, 0)], { completed: [frag.id] }),
    ).toEqual([]);
  });

  it("falls back to an English version", () => {
    const frag = fragment({ versions: [{ lang: "en", timeWindow: "day" }] });
    const found = proximityCandidates({
      fragments: [frag],
      fixes: [fix(0, 0), fix(1_000, 0)],
      accuracyToleranceM: 10,
      unlockedIds: new Set([frag.id]),
      completedEpochIds: new Set(),
      timeWindow: "day",
      lang: "es",
      accessible: false,
      playingFragmentId: null,
    });
    expect(found).toHaveLength(1);
  });
});

describe("chooseTrigger", () => {
  function candidate(
    id: string,
    tier: FragmentInput["tier"],
    distanceM: number,
  ): TriggerCandidate {
    return { fragment: fragment({ id, tier }), distanceM, via: "proximity" };
  }

  it("prefers Root, then the nearer fragment, then the lower id", () => {
    expect(
      chooseTrigger([
        candidate("leaf", "leaf", 1),
        candidate("root", "root", 30),
      ])?.fragment.id,
    ).toBe("root");
    expect(
      chooseTrigger([
        candidate("far", "leaf", 8),
        candidate("near", "leaf", 1),
      ])?.fragment.id,
    ).toBe("near");
    expect(
      chooseTrigger([
        candidate("b", "root", 4),
        candidate("a", "root", 4),
      ])?.fragment.id,
    ).toBe("a");
  });

  it("returns null when nothing fired", () => {
    expect(chooseTrigger([])).toBeNull();
  });
});

describe("scanDecision", () => {
  it("plays a physical scan only when it is unlocked and has a version", () => {
    const physical = fragment({ visibility: "physical" });
    expect(scanDecision(physical, true, true)).toEqual({ play: true });
    expect(scanDecision(physical, false, true)).toEqual({ play: false });
    expect(scanDecision(physical, true, false)).toEqual({ play: false });
    expect(scanDecision(fragment(), true, true)).toEqual({ play: false });
    expect(scanDecision(fragment({ visibility: "physical", retired: true }), true, true)).toEqual({
      play: false,
    });
  });
});

describe("queueAfterTrigger", () => {
  const chosen: TriggerCandidate = {
    fragment: fragment({ id: "next" }),
    distanceM: 2,
    via: "proximity",
  };
  const now = new Date(10_000);
  const eligible = () => true;

  it("starts immediately when nothing is playing", () => {
    expect(
      queueAfterTrigger({
        chosen,
        playingFragmentId: null,
        queued: null,
        afterglowEndsAt: null,
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }),
    ).toEqual({ startNow: "next", queued: null });
  });

  it("waits through playback and afterglow", () => {
    const waiting = queueAfterTrigger({
      chosen,
      playingFragmentId: "current",
      queued: null,
      afterglowEndsAt: null,
        now,
        stillInRange: () => true,
        isEligible: eligible,
      });
    expect(waiting).toEqual({
      startNow: null,
      queued: { fragmentId: "next", via: "proximity" },
    });
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: waiting.queued,
        afterglowEndsAt: new Date(now.getTime() + 1),
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }).startNow,
    ).toBeNull();
  });

  it("starts a proximity fragment after afterglow only while it is in range, and a scan anyway", () => {
    const after = new Date(now.getTime() - 1);
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: { fragmentId: "next", via: "proximity" },
        afterglowEndsAt: after,
        now,
        stillInRange: () => false,
        isEligible: eligible,
      }),
    ).toEqual({ startNow: null, queued: null });
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: { fragmentId: "scanned", via: "scan" },
        afterglowEndsAt: after,
        now,
        stillInRange: () => false,
        isEligible: eligible,
      }),
    ).toEqual({ startNow: "scanned", queued: null });
  });

  it("drops a proximity wait that left range so a new trigger can take the slot, and a scan replaces it", () => {
    expect(
      queueAfterTrigger({
        chosen,
        playingFragmentId: "current",
        queued: { fragmentId: "old", via: "proximity" },
        afterglowEndsAt: null,
        now,
        stillInRange: (id) => id !== "old",
        isEligible: eligible,
      }).queued,
    ).toEqual({ fragmentId: "next", via: "proximity" });
    expect(
      queueAfterTrigger({
        chosen: { fragmentId: "scanned", via: "scan" },
        playingFragmentId: "current",
        queued: { fragmentId: "old", via: "proximity" },
        afterglowEndsAt: null,
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }).queued,
    ).toEqual({ fragmentId: "scanned", via: "scan" });
  });

  it("keeps the first proximity fragment when a second one arrives", () => {
    expect(
      queueAfterTrigger({
        chosen,
        playingFragmentId: "current",
        queued: { fragmentId: "old", via: "accessible" },
        afterglowEndsAt: null,
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }).queued?.fragmentId,
    ).toBe("old");
  });

  it("does not queue the playing Root, so nothing starts when it ends", () => {
    const root = fragment({ id: "root-x", tier: "root" });
    const fixes = [fix(0, 0), fix(1_000, 0)];
    expect(
      candidates([root], fixes, { playingFragmentId: "root-x" }),
    ).toEqual([]);
    const whilePlaying = queueAfterTrigger({
      chosen: {
        fragment: root,
        distanceM: 0,
        via: "proximity",
      },
      playingFragmentId: "root-x",
      queued: null,
      afterglowEndsAt: null,
      now,
      stillInRange: () => true,
      isEligible: eligible,
    });
    expect(whilePlaying).toEqual({ startNow: null, queued: null });
    expect(
      queueAfterTrigger({
        chosen: { fragmentId: "root-x", via: "scan" },
        playingFragmentId: "root-x",
        queued: null,
        afterglowEndsAt: null,
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }),
    ).toEqual({ startNow: null, queued: null });
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: whilePlaying.queued,
        afterglowEndsAt: new Date(now.getTime() - 1),
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }),
    ).toEqual({ startNow: null, queued: null });
  });

  it("queues a Leaf entered while a Root plays, and starts it after the afterglow", () => {
    const root = fragment({ id: "root-x", tier: "root" });
    const leaf = fragment({ id: "leaf-y", tier: "leaf" });
    const found = candidates([root, leaf], [fix(0, 0), fix(1_000, 0)], {
      playingFragmentId: "root-x",
    });
    expect(found.map((item) => item.fragment.id)).toEqual(["leaf-y"]);
    const waiting = queueAfterTrigger({
      chosen: chooseTrigger(found),
      playingFragmentId: "root-x",
      queued: null,
      afterglowEndsAt: null,
      now,
      stillInRange: () => true,
      isEligible: eligible,
    });
    expect(waiting).toEqual({
      startNow: null,
      queued: { fragmentId: "leaf-y", via: "proximity" },
    });
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: waiting.queued,
        afterglowEndsAt: new Date(now.getTime() + 1),
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }).startNow,
    ).toBeNull();
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: waiting.queued,
        afterglowEndsAt: new Date(now.getTime() - 1),
        now,
        stillInRange: () => true,
        isEligible: eligible,
      }),
    ).toEqual({ startNow: "leaf-y", queued: null });
  });

  it("clears a queued fragment that is no longer eligible, including a scan", () => {
    const after = new Date(now.getTime() - 1);
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: { fragmentId: "day-only", via: "proximity" },
        afterglowEndsAt: after,
        now,
        stillInRange: () => true,
        isEligible: () => false,
      }),
    ).toEqual({ startNow: null, queued: null });
    expect(
      queueAfterTrigger({
        chosen: null,
        playingFragmentId: null,
        queued: { fragmentId: "scanned", via: "scan" },
        afterglowEndsAt: after,
        now,
        stillInRange: () => true,
        isEligible: () => false,
      }),
    ).toEqual({ startNow: null, queued: null });
  });
});
