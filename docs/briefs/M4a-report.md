# M4a report — shared story and sound logic

Lane A · M4a

**Branch:** `a/m4a-sound` (story half landed on `a/m4a-shared-logic` and `a/m4a-story-fixes`)
**Review:** `docs/briefs/M4a-plan-review.md` (`2fcce26`)
**Stop for review.**

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

### R1–R2

On `a/m4a-story-fixes`, after merging `origin/master` (`3ed1b8b`, PR #22). PR #20 is still open, so it was not in that merge.

**R1.** `proximityCandidates` takes `playingFragmentId` and never returns it. `queueAfterTrigger` ignores a chosen proximity, accessible, or scan fragment when that id is the one playing. While Root X plays inside its own radius it is not queued, and when it ends nothing starts. A Leaf entered during X takes the slot and starts after the afterglow.

**R2.** `queueAfterTrigger` takes `isEligible`. It is checked before `startNow` for every kind, including a scan. A fragment that fails leaves the slot. The sunset case (queued Day-only fragment, window gone) does not start, and the slot clears.

**N1.** The `proximityCandidates` doc comment tells M6 to pass recent fixes only. A pair stays valid while it remains in the list; 60 s is enough.

**N2.** A one-line comment on the missing-radius path. Behavior is unchanged: no `radiusM` never proximity-triggers.

`pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. `@intell/shared` is 137 tests. Trigger tests are 17 (three added).

## Sound half

On `a/m4a-sound`, from master `104b257`. `RegionPack` and the pack builder are unchanged. The modules take their own input types (A1).

**`audio/music.ts`.** `selectMusicCue` and `stemGainDb`. Empty condition arrays match (M5). Before dwell the current cue stays against a higher priority; after dwell only a strictly higher priority replaces it; equal priority keeps the current cue, and a fresh tie goes to the lower id (M1). The first matching stem rule replaces the resting level (M2). `edgeGain` is the linear 0–1 fade. `GROVE_MUSIC_EDGE_FADE_M` is 60 for a grove boundary or a grove-pack zone with no fade of its own (M3). A change crossfades over the incoming cue; silence uses the outgoing cue.

**`audio/ambience.ts`.** `activeProfiles`, `eligibleLayers`, `pickBed`, `nextOneShot`. Profiles that share a slug merge. Landcover ignores null cells; a tie prefers the center when it is tied, otherwise the tied class that appears first; a class with no profile mapping adds nothing (A3). Bed gain is `gainDb + 20·log10(weight)`, silent at weight 0. One-shot pan and rate use the layer's pan and pitch-cent ranges (A5). `nextOneShot` is a state reducer: it draws only when it schedules, and a shot blocked by `maxConcurrent`, the 4 s narration cap, or the 1.5 s guard is dropped and the next gap is drawn from that tick. Calling it twice with the same state and seed returns the same event.

**`audio/hush.ts`.** `hushStep` keeps `nextHushAt` and `holdEndsAt` on the state. The ±2 minute offset is drawn when idle begins, and the 60–90 s hold is drawn when the hold begins. A later call with the same state does not draw again. Narration or a queued fragment blocks the start. A trigger during a Hush returns a 1 s fade. Exported timings: 4 s out, 1 s to the cue, 6 s back, 1 s trigger exit, and `HUSH_CUE_GAIN_DB` −12.

`pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. `@intell/shared` is 21 files and 166 tests. The new tests are 11 music, 13 ambience, and 5 hush.

### R1–R2

**R1.** During `fadingOut`, `cue`, or `holding`, `settingOn` false or `insideGrove` false goes to `fadingIn` with the normal 6 s fade. Idle still draws the next time when that fade finishes. Turning the setting off during the hold fades back over 6 s. Leaving the grove during the fade-out does the same. A fragment trigger still uses the 1 s fade.

**R2.** `exponentialDelay` returns `Infinity` when `density × weight` is 0 or the mean is 0, so `nextAtSec` never comes due. A profile weight of 0 produces no shot across 501 ticks, and it does not draw a random number. A mean of 0 does the same.

`pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. `@intell/shared` is 169 tests (7 hush, 14 ambience).
