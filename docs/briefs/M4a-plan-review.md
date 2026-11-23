# M4a plan review (Claude)

**Plan:** `docs/briefs/M4a-plan.md` (c88000f) · **Verdict:** approved, with the decisions below. Build in two halves:

- **First half, this PR** (story): `geo/polygon.ts`, `story/unlock.ts`, the `timeWindow` tests and `story/trigger.ts` (plan steps 1–4). Stop for review when they're done. Once this PR merges, M5b has `unlock.ts` on master.
- **Second half, new branch from master after the merge** (sound): `music.ts`, `ambience.ts` and `hush.ts` (steps 5–7), under the decisions below.

The plan is thorough and its spec reading is careful. M2 caught a real contradiction in AUDIO_SPEC. I've amended the specs where a decision changes them (listed at the end).

## Decisions on the ambiguities

| # | Decision |
|---|---|
| U1 | **Agree.** A completed fragment in its window has opacity 1, `playableNow` false and no pulse. M5b may add more styling. |
| U2 | **Agree.** The pulse shows even at 35%. |
| U3 | **Agree.** An empty group is unsatisfied. |
| U4 | **Changed: fall back.** The `lang` enum already includes `es`, so exact matching would show every marker at 35% on a Spanish-language phone. Add `pickVersion(versions, window, lang)` in `unlock.ts`, using `pickL10n`'s order: the device language, then `en`, then any version for that window. "Has a version" means `pickVersion` returns one. Trigger, markers and playback all use it. |
| T1 | **Agree.** Ties go to the lower `id`. |
| T2 | **Agree, with one addition.** At each call, a waiting proximity or accessible fragment that is no longer in range (`stillInRange` false) leaves the slot, so a new trigger can take it. A scan never leaves the slot, and it replaces a waiting proximity fragment. |
| T3 | **Changed.** A fix over the accuracy tolerance is **skipped**: it doesn't count and doesn't break the pair. An accurate fix outside the radius does break it. A single noisy fix under tree cover shouldn't reset a listener who is standing at the spot, and the 60 s limit still bounds the pair. M6 can revisit this after field tests. Added to FR-3. |
| T4 | **Agree.** |
| T5 | **Agree.** The tolerance is a required parameter, with no exported default. |
| M1 | **Agree.** Before dwell, keep the current cue against anything. After dwell, only a strictly higher priority replaces it. Among new candidates with equal priority, the lower `id` wins. |
| M2 | **Agree: the rule replaces the resting level.** That matches the example and "fades up". AUDIO_SPEC §4.3 is amended. |
| M3 | **Agree, extended.** Use 60 m for a cue on the grove boundary **and** for a grove-pack cue `zone` (that polygon has no `edgeFadeM` either). |
| M4 | **Agree.** `playingTier` and `playingThreadIds` are added to StoryState in AUDIO_SPEC §4.1. |
| M5 | **Changed: an empty array behaves like an absent key (always matches) for every array key.** The admin may save `[]` when nothing is selected. Under the plan's rule, `heardAny: []` would silently stop a cue from ever playing. Amended in §4.2. (M4b's admin should also drop empty arrays on save.) |
| A1 | **Agree.** M4a defines its own input types and leaves `RegionPack` and the builder unchanged. **Follow-up for M4b (Lane A):** extend the region pack with the layer fields (months, nesting months, gain/pan/pitch ranges, intervals, `noRepeatLast`, `crossfadeMs`, asset weights, profile `density`) and add `edgeFadeM` to grove-pack cue zones. The pack schemas are `.strict()`, so that change needs a schema-version bump and the phone's parser updated in the same PR. |
| A2 | **Agree.** |
| A3 | **Agree, with two additions.** (1) Entries with the same `profileSlug` merge into one entry with the summed weight, so a zone whose landcover is the same profile doesn't produce two copies. (2) For the landcover majority, ignore null cells. On a tie, the center's class wins if it is one of the tied classes; otherwise the tied class that appears first in the cell order wins. A class with no profile mapping gives no landcover entry. |
| A4 | **Agree.** |
| A5 | **Changed: use the spec.** §3.4 does give pan and rate: `pan = uniform(pan_min, pan_max)`, and `rate = 2^(uniform(pitch_cents_min, pitch_cents_max)/1200)`. Add `panMin`, `panMax`, `pitchCentsMin` and `pitchCentsMax` to `AmbienceLayerInput` (the SQL defaults are ±0.8 and ±100 cents). |
| A6 | **Agree.** |
| H1 | **Agree.** |
| H2 | **Agree.** |
| G1 | **Agree.** Also add `distanceMeters(a, b)` (haversine) to `geo/`, for the trigger radius and the accessible 35 ft check. |
| G2 | **Agree.** |

## Other review points

1. **Gain arithmetic is in linear terms, not dB.** "Bed gain × profile weight" would turn −12 dB at weight 0.5 into −6 dB, which is louder. Return `gainDb + 20·log10(weight)` (silent at weight 0). Music `edgeGain` stays a linear 0–1 multiplier. §3.3 and §4.3 are amended. Add a test case where a lower weight is quieter.
2. **Hush and one-shot draws happen once, not on every call.** As written, `hushStep` draws its random numbers on every call, so the result depends on how often the Director ticks. Make it a state reducer instead. The input state carries `nextHushAt` and `holdEndsAt`, and the random draw happens only on the transition that sets them: entering idle, which also happens after each narration, and entering the hold. TECH_SPEC §3.2 already holds `hush:{state, nextAt}`. One-shots follow the same principle: `nextOneShot` draws only when it schedules the next shot. Add a test that calling it twice with the same state gives the same result.
3. **A one-shot blocked by `maxConcurrent` or the narration cap is dropped.** The next shot is drawn from that tick, so the density stays honest. A shot that lands in the narration guard zone is dropped the same way. Amended in §3.4.
4. **Add `unlocksToWrite(fragments, external, completions, unlocks): string[]`.** It returns every fragment with `shouldWriteUnlock`, so the phone can write the rows in one transaction after a completion, and "Something new has opened nearby" has its list.
5. **Constants:** export the Hush timings (4 s out, 1 s to the cue, 60–90 s hold, 6 s in, 1 s trigger exit) and `HUSH_CUE_GAIN_DB = -12`, so the Director and the Simulator share them.
6. **Polygon tests:** don't assert anything about points exactly on an edge, because ray casting is unstable there and the weight is 0 at the edge anyway. Test points just inside and just outside instead.
7. **Music crossfade:** a change uses the incoming cue's `crossfadeMs`. Fading to silence uses the outgoing cue's.
8. **Note for M6 (not M4a):** decide when a fragment that started but didn't finish re-arms, for example after Stop, or when a session restarts while the listener is still inside its radius.

## Spec amendments (this commit)
- AUDIO_SPEC §3.1: entries with the same profile merge.
- §3.3: the gain is linear.
- §3.4: blocked one-shots are dropped.
- §4.1: `playingTier` and `playingThreadIds`.
- §4.2: an empty array means the key is absent.
- §4.3: the rule replaces the resting level; edges are linear; grove-boundary zones use 60 m.
- §5: the draws are kept in the Hush state.
- PRODUCT_SPEC FR-3: inaccurate fixes are skipped.

## Next for Lane A
Build the first half (steps 1–4) with tests, under these decisions. Run `pnpm lint`, `pnpm typecheck` and `pnpm test`. Add a short report, `docs/briefs/M4a-report.md`, with a section for each half. Push to this PR and stop for review.
