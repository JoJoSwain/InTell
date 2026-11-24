# A5 Part 2 brief (Lane A): admin sound design and the Listening Simulator

**Lane:** A (Platform) · **Branches:** `a/a5p2a-sound-admin`, then `a/a5p2b-simulator`, each cut from `master` (Part 1 merged at `221df9f`). **No new plan step:** follow the Part 2 section of `docs/briefs/A5-plan.md` and `docs/briefs/A5-plan-review.md`, which were already reviewed. Where this brief adds or changes something, this brief wins.

**What Part 2 is:** the rest of BUILD_PLAN M4, plus admin and Simulator support for every A5 feature. It ships as **two PRs**, so each review stays manageable:
- **P2a:** sound admin and the carried fixes
- **P2b:** the Web Audio engine and the Listening Simulator

**Sources:**
- BUILD_PLAN M4 (its acceptance list is the bar)
- AUDIO_SPEC v4 (§3–§8)
- DATA_MODEL §3–§6 and §11
- the A5 plan and its review
- the carried items: M3c N3 (`docs/briefs/M3c-review.md`), M3e F2 (`M3e-review.md`), M3h V1/V2 (`M3h-review.md`) and M3f K1–K3 (`M3f-review.md`)
- the shared rules from Part 1 (`packages/shared/src/audio/*`)

**Lane A never edits `apps/mobile`.** Use the admin's existing patterns throughout: shadcn/ui, `ServerActionForm`, the design tokens, and Terra Draw for polygons.

## P2a: sound admin and the carried fixes
**1. Carried fixes first, as separate commits.**
- **N3:** O(n) short-term loudness (per-100 ms segment sums), and `analyzeAudioFile` in a Web Worker. Also compute the crest factor for `TRANSIENT` there.
- **F2:** a typed `PackBuildError` (with a code and the entity) instead of the regex in `preview`.
- **V1:** `ServerActionForm` accepts only a same-origin relative `href` (reuse `sanitizeNext`).
- **V2:** expected failures come back as `{ ok: false, error }` and are shown as-is.
- **K1–K3:**
  - Stop sending the secret key as a bearer.
  - Read the singular `SUPABASE_SECRET_KEY` and `SUPABASE_PUBLISHABLE_KEY`.
  - Remove the legacy key fallbacks.
  - **Don't** disable the legacy keys on staging. That's a dashboard step Jordan does after merge; list it in the report.

**2. Screens** (routes as in the plan's Part 2 table):
- **Ambience:**
  - Profiles and Day/Night layers, with every layer field and audition.
  - Asset weights.
  - The bed **stereo** check, shown inline. A mono bed is the publish error `BED_MONO`, and a bed over 2 minutes is the warning `BED_LONG`.
- **Zones:** ambience and music zone polygons (Terra Draw), priority and edge fade.
- **Landcover:** grid upload with the H3 overlay (`tools/landcover` exists).
- **Music:**
  - Zones and cues.
  - A condition builder covering `heardAll` (an "after this fragment" picker that shows the growth chain in order, with at most 4 steps per grove and window), threads, tiers, `minDepthM` and `insideTierBuffer`.
  - A cue page with stems (at most 4), the loop-point editor, the state-gain rules, and the three tier resolves.
- **Grove sound:** threshold motifs (Day and Night), the default beacons per tier, and the texture-depth override (default 15 m).
- **Fragment and revision editors** (extend the existing ones):
  - the beacon, the resolve override and the locked teaser
  - breath and swell points on the waveform (`wavesurfer.js`), auto-suggested on upload by `suggestBreathPoints`, then editable
- **Audio upload:** the walker-safety checklist, plus a crest and `TRANSIENT` display.
- **Publish check panel:** each new A5 code, with a link to the thing to fix.

**3. Tests:** server-action tests for every new form, including the save-twice guard; the worker test for N3; F2's typed error; V1/V2; K1–K3.

**Then:** write `docs/briefs/A5-P2a-report.md`, push, open a PR titled "A5 Part 2a: sound admin", and stop for Claude's review.

## P2b: Web Audio engine and the Listening Simulator (after P2a merges)
1. **A Web Audio `AudioEngine`** in the admin, implementing the shared interface, including the `moment` bus. Follow ADR 0001's engine operating rules:
   - the 12-voice budget via `allocateVoices`
   - release and disconnect every node
   - fade before every stop
   - schedule on the audio clock, not timers
2. **The Simulator, `/simulate/[groveId]`,** laid out as in the plan:
   - **The map:** a walker pin, trigger radii, zones, edge fades, the H3 overlay and the **buffer circles**.
   - **The right rail:**
     - story-state toggles; Day/Night, month, headphones or speaker; a **beacons on/off** switch
     - live profile weights, a one-shot timeline (showing the cap of 2), the cue and stem gains, and the growth step
     - depth in metres and the buffer flags
     - the beacon's target, pan and gain
     - motif, resolve and locked-teaser events
     - Hush countdowns, bus meters with mute and solo, and the mix level (`mixLevelFor`)
   - Breath markers on the active narration bar.
   - **GPX replay** at 1× and 4×.
   - The Simulator runs **the same pure functions** as the phone will: `ambience`, `music`, `hush`, `trigger`, `unlock`, `session`, and the A5 rules.
3. **Tests:**
   - Simulator integration tests, one per BUILD_PLAN M4 acceptance item:
     - zone-edge blending
     - Day/Night swaps
     - "completed" toggles a stem
     - speaker mode silences wildlife
     - 4× GPX replay
   - One per A5 feature:
     - depth bloom enters and leaves
     - growth steps after the afterglow
     - the resolve by tier
     - the motif once per visit
     - the beacon's choice and pan
     - accents only in breath gaps
     - the locked teaser once a day
     - the ladder shedding layers
   - Playwright isn't required.

**Then:** write `docs/briefs/A5-P2b-report.md`, push, open a PR titled "A5 Part 2b: Listening Simulator", and stop for Claude's review.

## Accept when
- [ ] `pnpm lint`, `typecheck` and `test` pass, and CI is green on each PR.
- [ ] Every BUILD_PLAN M4 acceptance item passes in the Simulator.
- [ ] Every A5 feature can be edited in the admin, and shows up in the Simulator.
- [ ] Every carried item (N3, F2, V1, V2, K1–K3) is done, with the staging legacy-key step listed for Jordan.
- [ ] No database reset happens without asking Jordan first.
