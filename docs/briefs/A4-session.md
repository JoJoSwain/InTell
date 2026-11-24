# A4 brief (Lane A): the session state machine (M6 shared logic)

**Lane:** A (Platform) · **Branch:** `a/a4-session` (in `C:\dev\intell-lanes\a`, cut from `8fa22c1`, with this brief committed) · **Plan first:** write `docs/briefs/A4-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What A4 is:** the logic for exploring a grove, as **pure, tested code in `packages/shared`**, built ahead of Lane B's M6. Lane B's M6 then only wires it to real location, audio and SQLite.

**The machine decides:**
- when a session starts and ends
- what plays, what waits and what shows a teaser
- what gets recorded

**Sources:**
- PRODUCT_SPEC §5.1 (Exploring), FR-3 to FR-8
- TECH_SPEC §3.1–3.3 (the session diagram and location)
- AUDIO_SPEC §4.1 (`StoryState`) and §5 (the afterglow)
- ADR 0004 (decisions 13, 16 and 28) and ADR 0005 §3
- ADR 0006 (groves are MultiPolygons, and changed fragments pulse)
- DATA_MODEL §14 (device tables)
- the existing shared code: `story/trigger.ts`, `story/unlock.ts`, `geo/polygon.ts`, `time/timeWindow.ts`

**Lane A never edits `apps/mobile`.**

## What to build
**1. A reducer:** `sessionStep(state, event, world) → { state, effects }` in `packages/shared/src/story/session.ts`.
- **No clocks, timers, I/O or randomness inside.** Time arrives on each event (`at`).
- **Everything that needs doing outside comes back as `effects`** for the shell to carry out.
- **State is JSON-serializable** (no `Set`s, no `Date` objects), because the phone persists it to `kv` and must resume after the OS kills the app.

**2. Events** (at least these; the plan may refine them):
- `fix` (a `LocationFix`)
- `scan` (a marker hash)
- `narrationEnded` (`natural` | `stopped` | `interrupted`, with the milliseconds played)
- `afterglowElapsed`
- `tick` (for timeouts)
- `stop` (the listener taps Stop)
- `settingsChanged` (the accessible trigger, location available)
- `windowChanged` (Day/Night flipped)

**3. `world`:** a read-only snapshot the shell passes in:
- the installed groves with their **MultiPolygon** boundaries
- fragments (`FragmentInput`), with each grove's `externalPrerequisites`
- marker hashes
- the device's `completions` and `unlocks`
- the current `timeWindow` and the language
- settings: the accessible trigger, and whether location is available

**4. Behavior** (PRODUCT_SPEC §5.1 and TECH_SPEC §3.2, using the existing helpers instead of rewriting them):

- **Start:**
  - A fix inside any piece of an installed grove starts a session (`pointInPolygon` on the MultiPolygon).
  - So does a scan, even outside every grove.
  - Effects: `sessionStarted` (with a session id the event supplies), `analytics grove_entered` / `session_started`, and the location mode.

- **Trigger:**
  - `proximityCandidates` → `chooseTrigger`: two confirmed fixes within 60 s; accurate fixes only; Root > Branch > Leaf, then nearest.
  - With the accessible trigger on: a single fix within 35 ft.
  - Only fragments that are **unlocked**, have a **version for the current window** (`pickVersion`), and aren't completed at their latest contingency.
  - The effect is `play { fragmentId, revisionNo, version, via }`.
  - **No Play button exists.** Narration always starts from an event.

- **Scan:**
  - `scanDecision`. If the fragment is unlocked and has a version now, play it (a scan always plays, queuing if needed).
  - Otherwise, `showTeaser { fragmentId, changeTeaser? }`.

- **One at a time:**
  - Exactly one narration plays.
  - A second trigger waits in a **queue of one** (`queueAfterTrigger`) and plays after the afterglow if the listener is still in its range. A queued scan always plays.
  - Never interrupt, and never overlap.

- **A natural end:**
  - `recordCompletion { fragmentId, revisionNo, timeWindow, onSite: true, trigger, sessionId }`
  - `writeUnlocks` (from `unlocksToWrite`)
  - `metCharacters` (the fragment's linked characters)
  - `analytics fragment_completed`
  - then the **8 s afterglow** (`startAfterglow`, then `afterglowElapsed`), then the queued fragment if it still qualifies
- **A stopped or interrupted end:** `recordProgress { fragmentId, revisionNo, timeWindow, maxProgressMs }`. There's no completion and no unlock. The machine doesn't auto-resume; the shell's lock-screen controls cover resuming.
- **Contingency and correction** (ADR 0004 §16, ADR 0005 §3):
  - A fragment completed at an older contingency triggers again.
  - Unlocks already written stay unlocked.
  - A correction never makes a fragment play again.
- **Day/Night:** a Day-only fragment never plays at night. `windowChanged` drops a queued fragment with no version for the new window.
- **End:**
  - `stop`; **15 minutes** after the last fix inside any grove (a scan counts as being "inside"); or **3 hours** after the start.
  - Effects: `writeVisit { sessionId, groveIds, startedAt, endedAt, fragmentsCompleted, timeWindow }`, `analytics session_ended { fragments_completed, minutes }`, and `locationMode idle`.
  - The shell must stop location within 5 s of this effect (the M6 acceptance criterion).
- **Location mode** (TECH_SPEC §3.3):
  - With no session: `foreground` (for the puck and grove entry).
  - In a session: `balanced` while more than 150 m from every candidate, otherwise `high`.
  - With no location permission: no proximity and no accessible trigger, but scanning still works.
- **`StoryState`:** a selector `storyStateOf(state, world)` that produces AUDIO_SPEC §4.1's `StoryState` for the AudioDirector: the grove, the playing tier and threads, the last ones, `heard`, the window and `narrationPlaying`. Hush stays the AudioDirector's (`hush.ts`); the session machine doesn't run it. **TECH_SPEC §3.2 is updated to match in this commit.**

**5. Privacy:** no effect or analytics payload ever carries a coordinate. The visit record stores grove ids and times, never positions.

## Tests
- **Unit tests for each rule above.** That includes a table of trigger eligibility: locked, out of window, completed, changed, physical, retired.
- **A scripted walk** through the Farmington demo grove, using `apps/mobile/e2e/demo-route.gpx` (or `tools/demo-geometry`) replayed as `fix` events with simulated narration ends. It mirrors M6's acceptance criteria in pure logic:
  - each unlocked fragment triggers **exactly once** in tier order
  - locked ones never trigger
  - two never play at once
  - a contingency replays and a correction doesn't
  - a Day-only fragment is silent at night
  - the session ends 15 minutes after leaving
- **A resume test:** serialize the state mid-narration and mid-afterglow, parse it back, and continue identically.
- **No coordinate in any effect:** a property test over the walk.

## Accept when
- [ ] `pnpm lint`, `typecheck` and `test` pass.
- [ ] The tests above pass.
- [ ] The public API (the state, events, effects, `world` and the selector) is documented in the module, so Lane B can wire it in M6.

## Out of scope
- Any phone code (M6, Lane B)
- Hush timing (already in `hush.ts`)
- The Journal growth moment (M9; leave a documented hook only)
- Analytics transport (M11)

## Plan (stop after this)
`docs/briefs/A4-plan.md` should cover:
- **The exact types** for the state, events, effects and `world`.
- **How the existing helpers are composed,** and any change they need.
- **Where the session id and timestamps come from.**
- **How each timeout is computed from events.**
- **The walk test's setup:** the GPX, the narration durations and how time advances.
- **The order of work, and any spec gaps.** Flag anything in PRODUCT_SPEC §5.1 or TECH_SPEC §3.2 that's ambiguous. Don't guess.

Push with `git push -u origin a/a4-session`, open a PR titled "A4: session state machine (plan)", and **stop for plan review.**
