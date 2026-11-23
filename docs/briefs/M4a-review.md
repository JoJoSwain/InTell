# M4a review (Claude)

## Story half (`7938a8e`, PR #22)

**Verdict:** two fixes in `trigger.ts` before merge. Everything else is approved.

`geo/polygon.ts`, `unlock.ts` and the timeWindow tests match the plan review exactly: the language fallback, revealed stays revealed, U1/U2 marker states, Chronicle per window, and `unlocksToWrite`. The new time-window cases agree with the function, so `timeWindow.ts` is unchanged. The trigger handles T2 and T3 as decided. The tests read well.

### R1. The playing fragment queues behind itself, and blocks the slot
While fragment X plays, the listener is still in X's radius and X isn't completed until it ends. So `proximityCandidates` keeps returning X, `chooseTrigger` picks it, and `queueAfterTrigger` puts X in the empty slot. When X ends, the slot still holds X, and after the afterglow X **plays again**. A second problem follows from the first. If X is a Root, `chooseTrigger` always prefers it, so a Leaf the listener walks into during X never gets the slot.

Fix:
- `proximityCandidates` takes `playingFragmentId: string | null` and never returns it.
- `queueAfterTrigger` ignores a `chosen` (proximity, accessible or scan) whose id is the playing fragment.

Tests:
- While Root X plays and the listener stays in its radius, X is never queued, and after it ends nothing starts.
- While Root X plays, a Leaf the listener enters takes the slot and starts after the afterglow.

### R2. Re-check eligibility when the slot starts
A waiting fragment can stop being eligible before it starts. For example, the sun sets during the playing fragment and the waiting one has only a Day version. Because FR-6 picks the version at playback start, there's nothing to play. Add an `isEligible(fragmentId) => boolean` predicate to `queueAfterTrigger`. The caller computes it at that moment: unlocked, not retired, a version for the current window, and not completed for the epoch. Check it before `startNow` for every kind, scan included (FR-4 says time windows still apply to scans). A fragment that fails the check leaves the slot.

Test: a queued fragment that loses its window at sunset doesn't start, and the slot clears.

### Notes (not blocking)
- N1. Pass `proximityCandidates` recent fixes only. A pair stays valid for as long as it's in the list. Say so in its doc comment, so the M6 session trims the buffer (60 s is enough).
- N2. A standard fragment without `radiusM` never proximity-triggers. That can't happen today, because `trigger_radius_m` is `not null default 10.67` and the builder omits it only for physical fragments. Leave the behavior as it is, but add a one-line comment.
- N3. `markerState` and `unlocksToWrite` scan arrays linearly. That's fine at grove sizes. M5b should memoize per change of completions, unlocks and window, not per fix.

### Then
PR #22 merged before this review, so the fixes go on a **new branch** `a/m4a-story-fixes` with this review commit. Fix R1 and R2, run `git fetch origin` and `git merge --no-edit origin/master` (that brings in PR #22 and, once it merges, PR #20 for M5a), then run lint, typecheck and tests. Nothing calls `trigger.ts` yet (the session comes in M6), so the bug on master affects no one in the meantime. Add an "R1–R2" section to the report under Story half, push with `git push -u origin a/m4a-story-fixes`, open the PR "M4a: trigger fixes (R1–R2)" and stop.

### Trigger fixes verified (`f2ff1f4`, PR #23)
R1: `proximityCandidates` skips `playingFragmentId`, and `queueAfterTrigger` ignores a `chosen` that is the playing fragment. Tests cover the playing Root that never re-queues and the Leaf that takes the slot during a Root. R2: `isEligible` is checked before any start, scan included, and the sunset case is tested. The N1 and N2 comments are in. **Approved. Merged as PR #23 (`104b257`).**

## Sound half
On branch `a/m4a-sound`, from master `104b257`.

### Review (`88204b6`)
**Verdict:** two small fixes before merge. Everything else is approved.

The music, ambience and Hush logic matches the plan review point for point:
- music hysteresis (M1), the stem rule replacing the resting level (M2) and the 60 m grove fade (M3)
- empty condition arrays matching (M5)
- landcover ties and merging of the same profile (A3), and pan and pitch from the layer's ranges (A5)
- linear gain, dropped one-shots, random draws only on transitions with the result kept in state, the exported Hush timings, and the crossfade rule

The determinism tests are the right ones.

#### R1. A Hush should end when it can no longer apply
Once a Hush starts, `hushStep` only ends it early for a trigger or narration. If the listener **turns the Hush setting off**, or **leaves every grove** while the sound is faded out or held, the silence keeps going for up to 90 s. The listener just asked for sound, or walked away. Fix: during `fadingOut`, `cue` or `holding`, if `settingOn` is false or `insideGrove` is false, go to `fadingIn` with the normal 6 s fade. Then idle draws its next time as usual. Tests: setting turned off during the hold fades back in over 6 s; leaving the grove during the fade-out does the same.

#### R2. Weight 0 must mean no one-shots
`exponentialDelay` returns `minS` when `density × weight` is 0, or when the mean is 0. A layer whose `minIntervalS` is unset then fires on **every tick**, which is the opposite of silent. `activeProfiles` drops weight-0 entries, so the Director shouldn't send one, but the function should be safe on its own. Fix: return `Infinity` in those cases, so `nextAtSec` never comes due. Test: `profileWeight: 0` never produces a shot over a long run of ticks.

#### Note for M7 (not blocking)
N4. `nextHushAt` is drawn even while the listener is outside a grove. So a listener who walks for 10 minutes between groves gets a Hush the moment they enter the next one. Consider asking for a minute or so inside a grove first. Tune it in M7's field tests.
