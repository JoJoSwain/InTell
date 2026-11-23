# M4a report — shared story and sound logic

Lane A · M4a

**Branch:** `a/m4a-shared-logic`
**PR:** https://github.com/JoJoSwain/InTell/pull/22
**Review:** `docs/briefs/M4a-plan-review.md` (`2fcce26`)
**Stop for review.** Music, ambience, and hush are not started. They belong on a new branch after this PR merges.

The local database was not reset.

## Story half

Built plan steps 1–4 under the review. U4, T2, and T3 follow the review where they differ from the plan. Sound decisions (M5, A3, A5, review points 1–3, 5, 7) are not in this half.

**`geo/polygon.ts`.** `pointInPolygon`, `distanceInsideMeters` (0 outside, including holes), and `distanceMeters` (haversine). Tests use points just inside and just outside a square, not on an edge.

**`story/unlock.ts`.** `memberSatisfied`, `isUnlocked`, `unlocksToWrite`, `markerState`, `chronicleReplay`, and `pickVersion`. Language order is the device language, then `en`, then any version for that window. An empty group stays unsatisfied. An `unlocks` row stays unlocked. A completed in-window fragment is opacity 1, `playableNow` false, no pulse. An unheard contingency pulses at 35% as well. Chronicle replay is the on-site row for that window at or after the current epoch.

**`time/timeWindow.ts`.** Not changed. The new cases agree with the function: winter noon and evening at the Wasatch point, sunrise inclusive and sunset exclusive, equator noon and midnight, Sydney winter and summer noon, and polar 05:59 / 06:00 / 17:59 / 18:00 local in `America/Denver`.

**`story/trigger.ts`.** `proximityCandidates`, `chooseTrigger`, `scanDecision`, `queueAfterTrigger`. `TWO_FIX_WINDOW_MS` is 60 s. `ACCESSIBLE_RADIUS_M` is `feetToMeters(35)`. The accuracy tolerance is a required argument and has no exported default. An inaccurate fix is skipped. An accurate fix outside the radius clears the pair. A waiting proximity or accessible fragment leaves the slot when `stillInRange` is false. A scan replaces the waiting fragment and still starts after the listener has left.

All of these are exported from `packages/shared/src/index.ts`.

### Tests

`pnpm lint`, `pnpm typecheck`, and `pnpm test` passed.

`@intell/shared`: 18 files, 134 tests. New coverage is 6 polygon, 17 unlock, 14 trigger, and 5 added time-window cases (11 time-window tests in all).

### Notes for review

- Proximity is true only when the fix list **ends** in a pair. An accurate fix outside the radius after an earlier pair clears it. The session needs to act on the confirming fix.
- Accessible play looks at the latest accurate fix. An earlier fix inside 35 ft does not fire once a later accurate fix is outside that distance.
- A scan replaces a waiting accessible fragment as well as a waiting proximity one.
- A standard fragment with no `radiusM` never proximity-triggers. Accessible play can still start it.
