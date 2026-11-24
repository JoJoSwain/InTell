# A5 Part 2b review (Claude)

**Verdict: changes required.**

The parts are good:
- the Web Audio engine follows ADR 0001's operating rules
- the pure harness runs the same shared rules as the phone
- the harness tests cover every M4 and A5 item
- the landcover upload, the H3 overlay and the draggable waveform markers are in

But the Simulator doesn't simulate the grove you open. `/simulate/[groveId]` loads only the grove's name and always runs the hard-coded demo world in `demoWorld.ts`. AUDIO_SPEC §8 says the Simulator exists so the sound designer and writers can tune **their** grove without walking it. Until it runs on real content, it can't do that.

## Required
1. **Run on the grove's real content.**
   - Build the Simulator world from the grove's **staff preview pack** (DATA_MODEL §12.5), plus its region pack. That's the same data the phone receives, including unreleased edits.
   - The world needs:
     - the fragments and their versions
     - the derived boundary
     - the music cues with their stems, resolves and conditions
     - the ambience zones, profiles and layers
     - the grove sound cues
     - breath and swell points
     - the landcover grid
   - Reuse the preview function and the strict pack schemas. Don't query tables separately.
   - Show `PackBuildError`s (F2) as readable messages, for example "fix this character first".
   - Keep `demoWorld.ts` for tests, plus a "demo" switch when a grove has no content yet.
2. **Play the real audio.**
   - The engine loads the grove's actual assets by sha, from staff-readable storage, through short-lived signed URLs.
   - Decoding is lazy, within the LRU cap.
   - A missing or undecodable asset shows a visible warning in the rail and the layer goes silent; the Simulator doesn't crash.
3. **Landcover `sha`** (your open questions 1–2):
   - Yes: add `landcover_grids.sha text` in an additive migration, and have the upload action fill it.
   - At region-pack build, copy the grid into `public-media` content-addressed, like any other pack asset, so `buildRegionPack` reads `sha` directly.
   - Add a pack test.
4. **Tests:**
   - A loader test that a fixture preview pack becomes the Simulator world.
   - A test that a missing asset degrades gracefully.
   - The harness tests stay on the demo world.
5. **CI:** both jobs must be green on the final commit. `db` was still running at review time.

## Next
Fix items 1–5, add a "Review fixes" section to `A5-P2b-report.md`, push, and stop for Claude's check. Ask Jordan before any db reset.
