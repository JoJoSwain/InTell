# A5 report — Part 1: sound data, rules and packs

**Lane A · A5 Part 1** · branch `a/a5-sound-features` · PR #30  
Plan review (`docs/briefs/A5-plan-review.md` @ `5ff9d81`) wins over the plan.

## What changed

### Specs
- `docs/AUDIO_SPEC.md` — v4 with growth steps, depth bloom, resolves, threshold motifs, beacons, breath/swell, locked teasers, mix ladder, 12-voice budget, `moment` bus (−8 dB), TRANSIENT crest > 20 dB, mix timings
- `docs/DATA_MODEL.md` — A5 columns/kinds; §12.4 **GrovePackDevice** / **RegionPackDevice** (strip) vs strict builder schemas; schema numbers stay 4 / 2

### Database
- `20261124090000_a5_asset_kinds.sql` — enum values `music_moment`, `beacon` (own migration so PG can use them)
- `20261124090100_a5_sound_features.sql` — columns on assets/groves/fragments/versions/music_cues; `grove_sound_cues` + RLS + grants; loudness/bitrate/`fn_check_audio_asset` (BED_MONO, BED_LONG, TRANSIENT); `fn_a5_sound_check_issues` + wrapped `fn_publish_check`; snapshot projection for A5 fields and denser ambience layer fields
- `supabase/tests/120_a5_sound_publish.test.sql` — TRANSIENT + RESOLVE_MISSING / no A5 errors on seed
- Local database was **reset** on this machine after the migrations

### Shared
- Named constants in `audio/soundFeatures.ts` (growth max, depth hysteresis, resolve ranges, motif/beacon/breath/mix/voice budget, `TRANSIENT_CREST_DB`, `MIX_SHED_AFTER_WINDOWS`, `MIX_RECOVER_STEP_MS`, …)
- Pure rules: depth bloom, resolve, threshold motif, beacon, breath (`resume = max(0, bp − RESUME_PREROLL_MS)`), locked teaser (device-local day, arrays), mix health, voices
- `moment` on `BusId` + DuckingPolicy (ducks like music under narration; **not** held in afterglow)
- `MusicCondition` / `StoryState` depth + buffer keys; `selectMusicCueDeferred`; ambience oneshot global cap 2; `DeviceAudioSettings.beaconsEnabled`
- Pack zod optional A5 fields; **GrovePackDevice** / **RegionPackDevice** = `.strip()`; AssetKind includes `music_moment` / `beacon`
- `manifestShas` collects new optional asset shas
- DB types updated for new columns/enums/table

### Packs / edge
- Grove + region pack builders emit optional A5 keys only when valued (default depth bloom 15 omitted for sequencing)
- Edge-shared schemas synced (`pnpm db:sync-edge-shared`)

## Review A–E + gap answers (implemented)

| Item | Implementation |
|---|---|
| A device parsers | `GrovePackDevice` / `RegionPackDevice`; builder omits empty keys |
| B moment bus | `BusId.moment`, −8 dB, ducks under narration, not afterglow |
| C asset kinds | `music_moment`, `beacon`; teasers stay `voice_cue` |
| D resume rule | `bp = max(breath ≤ stop)` else 0; `resume = max(0, bp − 300)` |
| E serializable state | arrays/objects (buffers, teaser, mix), not Sets |
| TRANSIENT | crest > 20 dB warning |
| GROWTH_STEPS_OVER_MAX | **error**; base + heardAll-only ≤ 4 per grove/window |
| Mix timings | `MIX_SHED_AFTER_WINDOWS = 2`, `MIX_RECOVER_STEP_MS = 60_000` |
| storyStateOf without fix | depth/buffers absent (not 0) |

## Sequencing (Lane B / publish)

Until mobile imports the **device** parsers (M6 checklist), do not publish packs that emit the new keys to binaries still using strict `GrovePack` / `RegionPack`. Builder already omits keys with no value; default `depthBloomTextureM` (15) is omitted.

## Commands

```
pnpm lint       # green
pnpm typecheck  # green
pnpm test       # green (243 shared tests)
npx supabase db reset   # applied; local DB reset
npx supabase test db    # 40 files / 216 tests PASS
```

## Not done (Part 2)

Admin sound screens, Web Audio engine, Listening Simulator, upload crest UX — after Part 1 merges, new branch from `master`.

Lane A did not edit `apps/mobile`.
