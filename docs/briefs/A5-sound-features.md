# A5 brief (Lane A): M4b sound design, plus the approved sound features

**Lane:** A (Platform) · **Branch:** `a/a5-sound-features`, cut from `master` at `1689394` (A4 merged). This brief is its first commit. · **Plan first:** write `docs/briefs/A5-plan.md`, push, open the PR, and stop for Claude's plan review before writing code.

**What A5 is:** M4b from BUILD_PLAN (admin sound design and the Listening Simulator), together with the sound features Jordan approved on Nov 23. Everything is built as data, pure rules in `packages/shared`, pack fields, publish checks, admin screens and the Simulator. **Phone playback is out of scope:** it's M6 and M7 (Lane B), after the ADR 0001 verdict. **Lane A never edits `apps/mobile`.**

**It ships in two parts, with one PR each:**
- **Part 1:** specs, data, shared rules, packs and publish checks.
- **Part 2:** the admin screens, the Web Audio engine and the Simulator.

The plan covers both. Build and merge Part 1 before starting Part 2.

**Sources:**
- BUILD_PLAN M4; WORKFLOW §6, Lane A item 3 (M4b's carried items: the region-pack sound fields from M4a plan review A1, M3c N3, M3e F2, M3h V1/V2, M3f K1–K3)
- AUDIO_SPEC (all of it) and DATA_MODEL §3–6, §11 and §12
- ADR 0001's Findings: the six engine operating rules and the 12-voice budget
- `packages/shared/src/audio/*`, `story/session.ts` (A4's hooks `groveEntered`, `startAfterglow{tier}`, `showTeaser{reason}`, and `storyStateOf`), `geo/polygon.ts`
- The feature list below. **Every value in it is Jordan's decision (Nov 23)**, not a provisional default. Still make each one a named, exported constant or a data field, so it can be tuned later without changing code.

## The approved features (Jordan's decisions)
**Soundtrack**
1. **The grove's song grows with the story.**
   - Each growth step is its own cue (arrangement), chosen by `heardAll`; up to **4 steps per grove**, and the composer decides how many.
   - **A step may add or remove layers.** It's just a new arrangement, so a story turn can thin the music.
   - When the switch comes from a completion, it's deferred until that fragment's afterglow ends, so it lands on the resolve.
   - Admin: an "after this fragment" picker that writes the `heardAll` condition.
2. **Depth bloom.**
   - Stems can depend on new `MusicCondition` keys. Extend `StoryState` to match, computed by `storyStateOf` from the latest fix.
     - `minDepthM`: the depth inside the grove outline (`distanceInsideMeters`).
     - `insideTierBuffer: 'root' | 'branch' | 'leaf'`: true while the listener is inside the buffer circle of a playable fragment of that tier.
   - **Texture: 15 m** deep by default, and each grove can override it.
   - **Melody: inside a playable Root's buffer circle (76.2 m, the same circle used for the grove outline).** It's fixed; there's no per-grove override.
   - Branch (45.72 m) and Leaf (30.48 m) buffer layers are optional; the composer uses them per grove.
   - Reuse A2's buffer constants; don't duplicate them. Use 5 m hysteresis on every threshold.
   - At most **4 stems per cue** (a publish check). The foundation stem keeps the existing edge fade.
3. **The afterglow resolve, after every tier.**
   - Each cue carries three resolves: `resolve_root_asset_id` (4–8 s), `resolve_branch_asset_id` (3–6 s) and `resolve_leaf_asset_id` (2–4 s). Day and Night come from the cue's time window.
   - Add an optional `fragments.resolve_asset_id` that overrides the tier's resolve for that fragment.
   - A missing resolve falls back to the plain 8 s pause, with a publish warning `RESOLVE_MISSING`.
   - A pure rule picks the resolve from `startAfterglow{fragmentId, tier}`.
4. **The threshold motif.**
   - One motif per grove per time window: Day and Night versions.
   - It plays **once per visit** (once per session), once the listener is ≥ 10 m inside, and never over narration: it waits up to 30 s, then it's dropped.
   - A pure rule decides it, from `groveEntered` plus depth.

**Surroundings**

5. **Composed beds, rare accents.**
   - A global cap of **2 concurrent one-shots** (AUDIO_SPEC §2.1 changes from 6).
   - **Beds: up to 2 minutes** (a publish warning above that), and **beds must be stereo**: a mono bed is a publish **error**.
   - A region-library size warning against the 40 MB budget (AUDIO_SPEC §7).
6. **Guide me by ear (beacons).**
   - **Every unexplored fragment** can have a beacon: `fragments.beacon_asset_id` (nullable, staged by snapshot).
   - A grove-level default beacon per tier (`grove_sound_cues`, kind `beacon_root` / `beacon_branch` / `beacon_leaf`) is used when the fragment has none.
   - It's **on by default**, with an off switch in Settings; the shared settings type gets `beaconsEnabled: true`.
   - A pure `beaconMix(listener, courseDeg | null, target)` returns `{ gainDb, pan, lowpassHz }`:
     - It's audible within 100 m, and level follows distance.
     - Pan follows the bearing relative to the direction of travel; with no course, it holds the last pan.
     - A source behind the listener is softened with a lowpass.
   - A pure `chooseBeacon` plays **one beacon at a time**:
     - the nearest unexplored playable fragment, preferring Root, then Branch, then Leaf when distances are within 10 m of each other;
     - switching only when another is closer by more than 10 m;
     - none while narration plays.
   - Headphones only.
7. **Safe sounds for walkers.**
   - An upload checklist ("no hazard-like sounds") is stored on the asset.
   - A publish warning `TRANSIENT` flags sharp peaks, using a crest-factor or onset measure in the loudness analysis (thresholds in the plan).
   - The rules go into AUDIO_SPEC §6, beside the wildlife rules.

**Narration and voice**

8. **Breath points.**
   - Add `revision_versions.breath_points_ms int[]` and `swell_cues_ms int[]` (both default `'{}'`).
   - Shared rules:
     - `suggestBreathPoints(samples, sampleRate)`: silences of at least 350 ms.
     - `resumePointMs(breathPoints, stoppedAtMs)`: the last breath point at or before the stop, minus 300 ms of pre-roll. Used after interruptions.
     - `accentAllowed(positionMs, breathPoints)`: accents only inside pauses.
   - Admin: auto-suggest on upload, editable on the waveform.
9. **Back command: 10 seconds back**, the podcast standard. Breath points aren't used for Back.
10. **Narrator and characters.**
    - Stereo narration is allowed **only where characters speak**: `AUDIO_FORMAT` accepts mono 96 kbps, or stereo 128 kbps when the version has linked characters. Narrator-only stereo gets a warning.
    - Production rule for AUDIO_SPEC §6: **the narrator is always center and close; no character sits dead center.**
    - No engine work in v1.
11. **Directing for walking ears.** Docs only: put the review doc's guidelines into AUDIO_SPEC §6 as production guidance.
12. **Whispered teasers: locked fragments only.**
    - Add `fragments.teaser_locked_asset_id` (nullable).
    - A pure rule plays it on `showTeaser{reason: "locked"}` at most once per fragment per day, never over narration.
    - Wrong-time fragments get no audio teaser; the visual teaser stays.

**Playback rules** (pure, in `packages/shared`; M7 wires them):
- **Narration comes first:** `mixLevelFor(signals)` maps the audio-health signals (clock rate, battery saver, thermal) to the layers allowed. They're shed in order: accents, beacon, extra stems, second bed, music. Recovery is slower than shedding (hysteresis).
- **Voice budget:** `allocateVoices(requests)` hands out the 12 slots: narration or teaser 1, stems 4, beds 2, accents 2, beacon 1, moment (motif or resolve) 1, spare 1. While two cues crossfade, accents and the beacon pause.

## Packs
- Carry every new field into the packs: per-cue resolve sha, stem count, beacon and teaser shas, threshold motif shas, and breath and swell points per version. Also carry the region-pack sound fields from M4a plan review A1.
- **Installed phones must keep working.** Read `apps/mobile`'s pack parsing (read only) and decide in the plan:
  - either a schema bump the phone already tolerates,
  - or optional additive fields on the current schema.
- Don't break M5a/M5b builds.

## Specs (Part 1, for Claude's review)
- Write **AUDIO_SPEC v4** and the **DATA_MODEL** changes for everything above. That includes §2.1 (the budget split), §6 (stereo narration, safe sounds, direction guidance) and §7 (the bed warning).
- Put the proposed spec text in the plan. Claude reviews it there before it lands.

## Tests
- Unit tests for every pure rule, including the hysteresis edges, beacon pan front/back/left/right, held pan with no course, the resume point, accent gating, motif timing, the teaser rate limit, the ladder order and its recovery, and budget allocation during a crossfade.
- Migration tests and publish-check tests for each new check.
- The pack builders' canonical-JSON tests, including the new fields.
- Part 2: Simulator coverage for depth, beacons, the motif, breath points and teasers (the timeline shows each).

## Accept when
- [ ] `pnpm lint`, `typecheck` and `test` pass, and both CI jobs are green.
- [ ] Every decided value is a named constant or a data field, and is listed in the report.
- [ ] Installed phone builds still parse the new packs.
- [ ] Part 2 meets BUILD_PLAN M4's acceptance criteria, plus the Simulator shows the new features.

## Out of scope
- Any phone code (M6 and M7, Lane B)
- Engine streaming (decided after B·S2)
- Spatial placement of characters by the engine (later)
- Journal growth audio (M9)

## Plan (stop after this)
`docs/briefs/A5-plan.md` covers:
- the migrations
- the exact type changes (`MusicCondition`, `StoryState`, pack zod)
- the signature and test list for each pure rule
- the pack compatibility decision, and the proposed spec text
- Part 2's screens and Simulator layout
- the order of work, and any spec gaps (flag them; don't guess)

Push with `git push -u origin a/a5-sound-features`, open a PR titled "A5: sound design and features (plan)", and **stop for plan review.**
