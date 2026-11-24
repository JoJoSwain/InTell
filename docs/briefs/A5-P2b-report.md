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
pnpm test          # green (admin 55 tests; includes 17 new Simulator/engine)
```

No local `db reset`.

## Dependency
- `h3-js` on `@intell/admin` (TECH_SPEC-allowed) for H3 overlay geometry

## Not in this PR
- Phone playback / ADR 0001 mobile verdict (Lane B / M6–M7)
- Binary NLCD builder in `tools/landcover` (still a stub; JSON upload covers admin UX)
- `landcover_grids.sha` column — pack builder still looks for `sha`; upload records `sha:` in `source` and content-addressed path. Additive column can follow if Claude wants pack landcover shipping from admin uploads.

## Open questions
1. Should `landcover_grids` get an explicit `sha text` column so `buildRegionPack` picks up admin uploads without parsing `source` / path?
2. Staging path for landcover JSON vs copying into `public-media/landcover/` at publish time?

## For Jordan
- Staging legacy-key dashboard step from P2a still applies after that merge (not re-done here).
- No db reset requested or performed.
