# A5 plan review (Claude)

**Verdict: approved with the changes and answers below.** Build Part 1 on `a/a5-sound-features`. Where this review and the plan differ, this review wins.

The plan is thorough. Every decision is a named constant, the migrations are additive, the rules are pure and well tested, and Part 2 is properly sequenced after Part 1. The one design change is about pack forward compatibility (change A).

## Changes
**A. Make device pack parsing forward-compatible, now.**
- Optional fields on schema 4/2 are right, but with `.strict()` schemas, any older build rejects a pack that carries an unknown key. The plan's "release sequencing" caveat would then come back with every future addition.
- No InTell build is in production yet, so fix it at the root:
  - Export a **device** parser that strips unknown keys (`GrovePackDevice = GrovePack.strip()`, and the same for `RegionPack`).
  - Keep the strict schemas for the builder and its tests.
  - Point `apps/mobile` at the device parsers. That's a one-line import change per call site, but Lane A doesn't edit mobile: note it for Lane B (M6 checklist), and document both parsers in DATA_MODEL §12.4.
- Until Lane B switches the imports, the builder must leave a new key out when it has no value. Keep the plan's sequencing note in the report.

**B. A `moment` bus.**
- Resolves and threshold motifs go on a new `moment` bus, default −8 dB. It ducks under narration like `music`, but it isn't held down by the afterglow, so a resolve can be heard in the afterglow while the stems stay ducked.
- Add `moment` to `BusId` and `DuckingPolicy` in shared (types and levels only); M7 wires it in the engine.
- Beacons play on `surroundings`, so Hush silences them too. Locked teasers play on `story`.

**C. Asset kinds.** Extend the enum, so format and loudness checks fit each kind:
- `music_moment` (resolves and motifs): AAC stereo, 160 kbps, −20 LUFS.
- `beacon`: AAC mono, 96 kbps, −30 LUFS, loopable. It's mono because the engine pans it.
- Locked teasers reuse `voice_cue`.

The migration also updates pack `AssetKind`, which is an optional-tolerant change under A.

**D. Breath-point resume, stated exactly.** `bp = max(breathPoint ≤ stoppedAtMs)` (or 0 if there's none), then `resume = max(0, bp − RESUME_PREROLL_MS)`. Test the case with no breath points, and a stop exactly on a breath point.

**E. Serializable rule state.** Latched buffers and teaser state use arrays and plain objects, not `Set`, so the AudioDirector can persist them alongside the session state.

## Answers to the spec gaps
1. **TRANSIENT:** crest factor (true peak against RMS of the loudest 400 ms) **> 20 dB** gives a warning. 12 dB would flag most natural recordings. Make it a named constant; we'll tune it with real assets.
2. **`GROWTH_STEPS_OVER_MAX`:** a **failure**. Jordan's cap is 4.
3. **Asset kinds:** see C.
4. **Bus for motifs and resolves:** see B.
5. **`storyStateOf` without a fix:** depth and buffer conditions don't match (they're absent, not 0). No bloom until the first fix.
6. **Mix timings:**
   - Shed one layer after 2 consecutive degraded watchdog windows (about 10 s).
   - Recover one layer after every 60 s of healthy clock.
   - Both are named constants (`MIX_SHED_AFTER_WINDOWS = 2`, `MIX_RECOVER_STEP_MS = 60_000`).
7. **"Unexplored" for beacons:** unlocked, playable now (`isPlayableNow`), and **not** `completedEpoch`. That's the same test the session machine uses.
8. **Teaser "per day":** device-local calendar day.
9. **Growth-step count:** per grove and time window, count the base cue plus every grove cue whose conditions use only `heardAll`. The total must be ≤ 4. Thread-based or other conditional cues don't count.
10. **Playwright:** not required. Unit tests and Simulator integration tests are enough for acceptance. Add one admin smoke only if the Playwright setup already exists.
11. **No schema bump:** accepted, together with change A.
12. **"Linked characters" for stereo narration:** the fragment's character links (`fragment_characters`), not the individual version.

## Also
- `grove_sound_cues` and the new fragment and grove fields go through snapshots and releases, like the other story fields. RLS: staff write, `anon` none. Explicit grants, per AGENTS.md.
- The spec text is approved with A–E and the answers above folded in. Land it as Part 1, step 1.

## Next
Implement Part 1 in the plan's order, with these changes. Write `docs/briefs/A5-report.md` (Part 1), push, rename PR #30 (if that's its number) to "A5 Part 1: sound data, rules and packs", mark it ready, and stop for Claude's review. Part 2 starts from `master` once Part 1 has merged. Lane A never edits `apps/mobile`.
