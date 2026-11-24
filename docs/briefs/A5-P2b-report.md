# A5 Part 2b report — Listening Simulator

**Lane A · A5 Part 2b** · branch `a/a5p2b-simulator`  
Sources: `docs/briefs/A5-part2.md` P2b, Part 2 of `A5-plan.md` / review, plus items moved from P2a review (landcover upload + H3; draggable breath/swell waveform markers).

No database reset. No `apps/mobile` edits.

## What changed

### Web Audio `AudioEngine` (admin)
- `apps/admin/src/lib/audio/webAudioEngine.ts` — implements shared `AudioEngine`, including the `moment` bus
- 12-voice budget via shared `allocateVoices` (harness / diagnostics path)
- Fade before every stop; disconnect on release; one-shots scheduled with `whenSec` on the audio clock (no setTimeout for starts)
- Injectable `createContext` for Node tests; decode LRU via `DecodedBufferLruAccounting`
- Unit tests: moment bus + clock scheduling; fade-then-stop

### Listening Simulator `/simulate/[groveId]`
- Map: walker pin (or lat/lng fallback when Maps keys absent), trigger radii, zones, H3 overlay, tier buffer circles
- Right rail: completed toggles, Day/Night, month, headphones/speaker, beacons on/off, profile weights, oneshot cap (2), cue/stem gains, depth bloom, buffers, beacon pan/gain, motif/resolve/teaser/Hush/mix ladder, bus mute/solo, GPX 1× / 4×
- Narration bar with shared breath/swell markers
- Pure harness (`lib/simulate/harness.ts`) calls the same shared rules as the phone: ambience, music, hush, depth bloom, beacon, motif, resolve, locked teaser, breath accents, mix ladder, voices
- Demo Farmington-shaped world; sidebar + grove page links

### Moved from P2a
- **Landcover:** JSON H3 grid upload UI (`LandcoverUpload`), H3 overlay (`h3-js`), `registerLandcoverGrid` server action → upserts `landcover_grids` (file under `staging-audio/landcover/`)
- **Breath/swell waveform markers:** `WaveformMarkers` (wavesurfer.js regions), wired into `BreathPointsField` / revision editors and the Simulator narration bar

### Tests (Vitest; Playwright not required)
| Coverage | File |
|---|---|
| M4: zone-edge blend, Day/Night, completed→stem, speaker wildlife, 4× GPX | `harness.test.ts` |
| A5: depth bloom, growth after afterglow, resolve by tier, motif once, beacon pan, breath accents, locked teaser once/day, mix ladder | `harness.test.ts` |
| GPX parse/schedule | `gpx.test.ts` |
| Web Audio engine | `webAudioEngine.test.ts` |

## Commands

```
pnpm lint          # green (admin hook warnings only)
pnpm typecheck     # green
pnpm test          # green (admin 58 tests)
```

No local `db reset`.

## Dependency
- `h3-js` on `@intell/admin` (TECH_SPEC-allowed) for H3 overlay geometry

## Review fixes (A5-P2b-review.md)

1. **Real grove content.** `preview` accepts `{ groveId }`, builds a working-row overlay (`loadGroveWorkingOverlay`), assembles GrovePack + RegionPack via the same builders and strict schemas, and returns signed asset URLs. `worldFromPacks` maps packs → SimulatorWorld. PackBuildErrors surface as readable messages (`CODE: message (fix this entity…)`). Demo world remains for tests and a UI “Demo world” switch / empty-grove fallback.
2. **Real audio.** Engine `tryLoad` lazy-decodes by sha through signed URLs within the LRU cap; missing/undecodable assets add a rail warning and stay silent (no crash). Motif / resolve / teaser / beacon oneshots use those URLs.
3. **Landcover `sha`.** Additive migration `20261124140000_a5p2b_landcover_sha.sql`; upload action sets `sha`; `buildRegionPack` / `assembleRegionPackObject` copies the grid to `public-media/landcover/{sha}.{ext}` and packs `landcover.gridSha`. Pack-integration test covers sha → rebuild → public object.
4. **Tests.** `worldFromPacks.test.ts` (fixture preview → world); `tryLoad` missing-asset degradation; harness tests still on demoWorld.
5. **CI.** Both jobs green on the final commit (this push).

## Not in this PR
- Phone playback / ADR 0001 mobile verdict (Lane B / M6–M7)
- Binary NLCD builder in `tools/landcover` (still a stub; JSON upload covers admin UX)

## For Jordan
- Staging legacy-key dashboard step from P2a still applies after that merge (not re-done here).
- No db reset requested or performed. Additive migration only — CI/`supabase start` applies it; local stacks that were already up need `supabase migration up` (or a reset if you choose).
