# A6 brief (Lane A): the AudioDirector (M7 shared logic)

**Lane:** A (Platform) · **Branch:** `a/a6-audio-director`, cut from `master` at `b99c4d0` (A5 complete). This brief is its first commit. · **Plan first:** write `docs/briefs/A6-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What A6 is:** the "conductor" that decides, moment to moment, what the phone plays. It's pure, tested logic in `packages/shared`, built ahead of Lane B's M6/M7, which will then only wire it to the real engine, location and settings. The admin Simulator switches to it too, so the browser and the phone run **one** brain. **Lane A never edits `apps/mobile`.**

**Sources:**
- AUDIO_SPEC v4 (all of it), TECH_SPEC §3.2 (the AudioDirector boundary), ADR 0001 (Findings and the engine operating rules)
- `packages/shared/src/audio/*`:
  - `ambience`, `music` (`selectMusicCueDeferred`), `hush`, `DuckingPolicy` (including the `moment` bus)
  - `oneshotSchedule` (including B·S2's short look-ahead), `voiceLedger`
  - the A5 rules: depth bloom, resolve, threshold motif, beacon, breath, locked teaser, mix health, voices
- `story/session.ts`: its effects (`play`, `stopNarration`, `startAfterglow`, `groveEntered`, `showTeaser`, `sessionEnded`) and `storyStateOf`
- the admin harness, `apps/admin/src/lib/simulate/harness.ts`. It already composes most of these rules ad hoc; A6 makes that composition the shared product code.

## Design
**1. A pure reducer:** `directorStep(state, input, world) → { state, commands }` in `packages/shared/src/audio/director.ts`.
- No clocks, timers, I/O or randomness inside. Time comes on each input as **audio-clock seconds** plus wall-clock ms. Randomness comes from the seeded RNG, carried in state.
- **State is JSON-serializable** and versioned (`v: 1` plus a zod parser), so the phone can persist it beside the session state.

**2. Inputs** (at least these; the plan may refine them):
- **Session effects:** `play`, `stopNarration`, `startAfterglow`, `groveEntered`, `showTeaser`, `sessionEnded`.
- **`story`:** a `StoryState` snapshot (`storyStateOf`), with depth and buffers.
- **`location`:** the course for beacons, plus the zone and profile context.
- **`heartbeat`:** the audio clock's 5 s tick, the only scheduler wake-up.
- **Engine events:**
  - `voiceEnded`
  - `narrationProgress` (for breath-point gating)
  - `interruption`
  - `health` (clock rate per window)
- **`settings`:**
  - the bus sliders, Hush on/off, beacons on/off, the chime
  - the route (headphones or speaker)
  - battery saver and thermal state

**3. Output commands:** declarative engine commands that map one-to-one onto the shared `AudioEngine` interface. For example:
- `load(sha)` / `unload(sha)`
- `startLoopGroup`, `crossfadeBed`, `setStemGain`, `setBusGain`
- `playOneShot { whenSec }`, `playMoment`, `startBeacon` / `updateBeacon` / `stopBeacon`, `playNarration`
- `stop { fadeMs }`, `suspend` / `resume`

Prefer computing a **target mix** each step and **diffing** it against the last emitted state, so the commands are minimal and idempotent.

**4. What it decides** (by composing the existing rules, not rewriting them):
- **Surroundings:**
  - profile blending and bed crossfades (§3)
  - accents: the cap of 2, at most 2 pending and 20 s ahead, scheduled on the audio clock, only in narration pauses (breath gating), wildlife and speaker filters
- **Soundtrack:**
  - cue selection with hysteresis and dwell
  - growth steps deferred to the end of the afterglow
  - stem gains from depth bloom, buffers and `state_gains`
  - edge fades
- **Ducking, afterglow and the resolve:** narration ducks music, moment and surroundings. The afterglow holds the duck while the tier's resolve plays on `moment`.
- **Hush** (§5): scheduling, the "Listen." cue, cancelled by a trigger.
- **Moments:** the threshold motif (once per visit, ≥ 10 m inside, waits up to 30 s); the locked teaser (once per fragment per day, never over narration).
- **Beacons:** `chooseBeacon` + `beaconMix`, only with headphones, off during narration and Hush.
- **Budget and health:** every voice request goes through `allocateVoices` (12 slots; accents and the beacon pause during a crossfade). `mixLevelFor` sheds and recovers layers in the agreed order, and narration is never shed.
- **Interruptions:** `began` → fade and suspend; `ended` with `shouldResume` → resume from the breath point (`resumePointMs`); an unpaired `ended` → nothing (a gap in react-native-audio-api 1.0.1).
- **Memory policy:**
  - decode narration at 24 kHz
  - keep at most the current fragment plus the most likely next one (by distance) loaded, and unload the rest
  - stream beds when the engine supports it (an engine capability flag); otherwise decode, with the LRU cap
  - this follows B·S2's memory probe

**5. Admin Simulator:** replace the ad-hoc composition in `harness.ts` with `directorStep`. The Simulator then drives `WebAudioEngine` from the director's commands. Keep the harness's tests, now running through the director.

## Tests
- Unit tests for each behaviour above, including:
  - duck, afterglow and resolve timing
  - Hush scheduling and its cancellation
  - growth deferral
  - accent gating by breath points
  - the motif and teaser rules
  - beacon start, update and stop
  - budget under a crossfade
  - the shed and recover order
  - interruption resume from a breath point
  - memory load and unload
- **A scripted walk:** the Farmington demo route (the same GPX as A4), fed through `sessionStep`, then `storyStateOf`, then `directorStep`. Assert:
  - never more than 12 voices
  - accents only in pauses
  - one beacon at a time
  - the motif once
  - the resolve after each completion
  - no command while the engine is suspended
- **A resume test:** serialize the state mid-afterglow and mid-Hush, parse it back, and the commands continue identically.
- **Determinism:** the same seed and inputs give identical commands.

## Accept when
- [ ] `pnpm lint`, `typecheck` and `test` pass, and both CI jobs are green.
- [ ] The Simulator runs on `directorStep`, and every A5 harness test still passes through it.
- [ ] The public API (inputs, commands, state, world) is documented in the module, for Lane B's M7.

## Out of scope
- Phone wiring (M6/M7, Lane B)
- Engine streaming itself (the ADR 0001 verdict and the B·S2 results)
- Chronicle and Journal audio
- Analytics

## Plan (stop after this)
`docs/briefs/A6-plan.md` covers:
- the exact types (state, inputs, commands, world)
- the target-mix-and-diff design
- how each existing rule is composed, and any change it needs
- the time model (the audio clock vs wall clock)
- the memory policy
- how the Simulator switches over
- the walk test's setup
- the order of work, and any spec gaps (flag them; don't guess)

Push with `git push -u origin a/a6-audio-director`, open a PR titled "A6: AudioDirector (plan)", and **stop for plan review.**
