# M4a brief (Lane A): shared story and sound logic

**Lane:** A (Platform) · **Branch:** `a/m4a-shared-logic` (in `C:\dev\intell-lanes\a`). It's cut from the A1 tip `c596935` with this brief committed. Before anything else, run `git fetch origin` and `git merge --no-edit origin/master` to bring in the PR #21 merge commit. Expect no conflicts and no file changes. · **Plan first:** write `docs/briefs/M4a-plan.md`, open the PR, and stop for Claude's plan review before writing code.

## What and why

M4a covers the **pure, unit-tested logic** in `packages/shared` that BUILD_PLAN M4 lists as "built and unit-tested in this milestone". Both apps run on it:
- the admin Listening Simulator (M4b, Lane A)
- the phone's map (M5b, Lane B, which needs `unlock.ts` and `timeWindow.ts`)
- the phone's session and sound (M6–M7)

**No UI, no database and no edge functions in M4a.** Only `packages/shared`.

**Sources (read all):**
- AUDIO_SPEC §3 (ambience), §4 (music), §5 (Hush and afterglow) and §9 (tests)
- DATA_MODEL §12 (the packs these functions read) and §14 (the rules computed on the device)
- PRODUCT_SPEC §5.1 (triggering and one-at-a-time), FR-3 (trigger), FR-6 (Day/Night) and FR-7 (accessible trigger), plus the vocabulary
- ADR 0003 (tiers); ADR 0004 §10 (marker opacity), §12 (radius), §13 (contingency; revealed stays revealed), §14 (Day/Night) and §16 (replay); ADR 0005 §3 (the pulse)
- the existing `src/time/timeWindow.ts`, `src/story/contingency.ts`, `src/audio/*` and `src/schemas/music.ts`

## Modules (names from BUILD_PLAN M4; refine them in the plan)

1. **`story/unlock.ts`. This goes first, because M5b needs it.**
   - It decides whether a prerequisite member is satisfied (`completions` with `revision_no ≥ contingencyRevisionNo`, using `externalPrerequisites` for other groves).
   - It decides whether a fragment is **unlocked** (an `unlocks` row, or every group satisfied now, in which case it reports that the row should be written).
   - It decides marker state: **playable now** (unlocked, a version exists for the current window, and not completed for its latest contingency) shows at 100%; locked or out of window shows at 35%. It also flags the "unheard contingency" pulse (ADR 0005 §3).
   - It decides Chronicle replayability per time window (§14).
   - Inputs are plain data (pack fragments plus device rows), never database calls.
2. **`story/trigger.ts`.** Given recent fixes and the candidate fragments, which fragment (if any) triggers:
   - two consecutive confirmed fixes within 60 s inside the radius (FR-3), with the accuracy tolerance as a parameter (M6 tunes it)
   - unlocked, with a version for the window, and not completed for its latest contingency
   - physical fragments never trigger by location. A scan is a separate entry point, and a scanned fragment always plays (§5.1.3 and §5.1.5).
   - tier priority Root > Branch > Leaf, then nearest
   - the one-at-a-time queue of one (§5.1.5): it waits through the afterglow and plays only if the listener is still in range
   - the accessible trigger (FR-7), as an option: a single fix within 35 ft of the GPS point
3. **`audio/ambience.ts`** (AUDIO_SPEC §3): the active profile from zone priority and edge blending, with the landcover fallback and neighbor smoothing; Day/Night, month and route filters; speaker filtering; wildlife nesting mute; the density cap during narration; seeded determinism (reuse `seededRng.ts` and `oneshotSchedule.ts`).
4. **`audio/music.ts`** (AUDIO_SPEC §4): story state in, then cue selection with Day/Night filtering, every `MusicCondition` key, priority and hysteresis, dwell, stem-rule evaluation, edge fade, and silence outside zones.
5. **`audio/hush.ts`** (AUDIO_SPEC §5): scheduling, cancellation by a trigger, never during narration, and the afterglow timing.
6. **`time/timeWindow.ts`:** fill any gaps in the §9 tests (several dates and latitudes; the polar fallback). Don't change its behavior unless a test exposes a bug, and if one does, report it.

Each module needs the AUDIO_SPEC §9 test list in full, plus the story rules above. They're pure functions: injected clock, seeded random numbers, and no I/O. Export them all from the package index.

## Plan (stop after this)
`docs/briefs/M4a-plan.md` should cover:
- each module's exported functions and types (signatures)
- the input shapes, and where each comes from (pack field or device row)
- the test-case list per module, mapped to AUDIO_SPEC §9 and DATA_MODEL §14
- the order of work (`unlock.ts` first)
- **every spec ambiguity or contradiction you find.** Don't guess. List each one with a proposed answer, and Claude decides.

Push with `git push -u origin a/m4a-shared-logic`, open a PR titled "M4a: shared story and sound logic (plan)", and **stop for plan review.**

## Not in M4a
The admin sound-design screens, the Simulator and the Web Audio engine (M4b), plus the M3h follow-ups V1/V2 and the M3c N3 loudness worker (M4b). Also any `apps/` or `supabase/` change, and the CI `expo export` job (after M5a merges).
