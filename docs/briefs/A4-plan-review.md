# A4 plan review (Claude)

**Verdict: approved with the changes below.** Build A4 on `a/a4-session` without another plan round. Where this review and the plan differ, this review wins.

The plan is solid. The types are JSON-safe, time arrives on events, the existing helpers are reused rather than rewritten, and there are no coordinates in effects. The changes below settle the spec gaps. They also add three small hooks for the sound features Jordan approved on Nov 23 (threshold motif, afterglow resolve, whispered teasers), so A5 and M6 won't need to reopen the reducer.

## Answers to the spec gaps
1. **Missing `sessionId` on a starting event:** refuse to start, as planned, and test it. The shell always attaches a fresh id to `fix` and `scan` while idle.
2. **`accuracyToleranceM`:** required in `world.settings`, with no silent default in production code. Tests use 25 m.
3. **`stop` or a timeout while playing (no `playedMs`):** the reducer computes `playedMs` itself: `at − playing.startedAt − pausedTotalMs` (see change A). `narrationEnded.playedMs` stays authoritative when it arrives. `stop` needs no new field.
4. **TECH_SPEC §3.2 diagram:** yes, it's out of date. Update it in this PR so it matches the reducer: `fix`/`scan` events, and `growthMoment` as a hook effect.
5. **Teaser matrix on scan:**
   - Locked: `showTeaser { reason: "locked" }`. Locked wins even if the fragment also changed.
   - Unlocked, but no version for the current window: `showTeaser { reason: "wrongTime" }`.
   - Unlocked and changed (completed at an older contingency): it plays, and `play` carries `changeTeaser?` for the UI.
6. **`writeVisit`:** one visit row per grove. Change the effect to `writeVisit { sessionId, startedAt, endedAt, timeWindow, groves: { groveId, fragmentsCompleted }[] }`. The shell writes one row for each entry.
7. **Several containing groves:** add them all to `groveIds`. Track `currentGroveId` in state: the containing grove you're deepest inside on the latest fix (`distanceInsideMeters`), with ties broken by id. `storyStateOf.groveId` is the playing fragment's grove, then `currentGroveId`, then the most recently entered grove. Drop the `containingGroveId` argument.
8. **Unknown marker hash:** a silent no-op.
9. **Physical fragments:** never pass them to `proximityCandidates`. Assert it in a test as well as relying on the helper.
10. **Hand-built fragment graph for the correction and contingency cases:** yes, that's fine.
11. **`heard` as a fresh `Set` on each call:** yes, that's fine.
12. **Chime, haptic and ducking:** the shell and the AudioDirector handle them on `play`. They're not reducer effects.

## Changes
**A. Pausing isn't ending.**
- Breath points (approved) mean an interruption pauses narration, and it resumes from the sentence it stopped in. Add two events: `narrationPaused { at }` and `narrationResumed { at }`.
- While paused:
  - `playing` stays set, with `pausedAt`, and `pausedTotalMs` accumulates.
  - The queue waits.
  - The 15-minute and 3-hour timeouts still apply. Ending a session while paused emits `stopNarration` and `recordProgress`, using the computed `playedMs`.
- Keep `narrationEnded { reason: "interrupted" }` for a narration the shell gives up on. It behaves like `stopped`.
- `stopped` clears the queue, since the listener chose silence. `interrupted` keeps a queued scan only.

**B. Sound-feature hooks** (cheap now; A5 and M6 use them):
- `groveEntered { groveId }`: the first time each grove becomes `currentGroveId` in a session, for the threshold motif. A5 adds the 10 m depth rule and owns the timing; A4 just reports entry.
- `startAfterglow { endsAt, fragmentId, tier }`: so the AudioDirector can play a resolve after Roots.
- `showTeaser` gains `reason: "locked" | "wrongTime"` (gap 5).

**C. Versioned persisted state.** Add `v: 1` to `SessionState`, and a zod `parseSessionState` that rejects unknown versions. Note in the module header that `recentFixes` holds coordinates: it's local device state, never sent off the device and never put into an effect.

**D. The walk test's "never two plays" assertion.** Between two `play` effects there must be a natural end with its afterglow cleared, or a `stopped`/`interrupted` end. Add a case for pause → resume → natural end.

**E. Document the effect order** in the module header, and test it. On a natural end the order is: `recordCompletion`, `writeUnlocks`, `metCharacters`, `analytics`, `startAfterglow` (and `growthMoment` when it applies).

## Next
Implement in the plan's order of work, with these changes folded in. Then write `docs/briefs/A4-report.md`, push, and mark PR #29 ready for review. Rename it "A4: session state machine". Stop for Claude's review.
