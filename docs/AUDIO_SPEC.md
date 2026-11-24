# InTell — Audio Spec: Three Layers, One Mix (v4)

v4 adds the Nov 23 sound features (A5): growth soundtrack steps, depth bloom, afterglow resolves, threshold motifs, beacons, breath points, locked teasers, a 12-voice budget, a `moment` bus, and safer walker standards. v3’s ADR 0004 Day/Night tagging and Replaceplace-only audio still apply.

InTell is mostly heard, not seen. Three layers play together, mixed on the device:

| Layer | What | Driven by | Data |
|---|---|---|---|
| **Story** (narration) | Root, Branch and Leaf fragments, each with a Day and/or Night version; locked whispered teasers | Proximity (or a physical-marker scan), unlock state, Day or Night | `fragments`, `fragment_revisions`, `revision_versions` |
| **Surroundings** (ambience) | Randomized beds and rare accents; optional beacons toward unexplored fragments | Ambience zones (or land cover), Day or Night, month, headphones vs speaker | `ambience_profiles`, `ambience_layers`, `ambience_zones`, landcover grid, beacons |
| **Soundtrack** (music) | Looping stems that grow with the story; afterglow resolves and threshold motifs on the `moment` bus | Music zones and Groves, Day or Night, story state (threads, tiers, completions, depth) | `music_zones`, `music_cues`, `music_cue_stems`, `grove_sound_cues` |

Data definitions are in `DATA_MODEL.md` §3–6.

---

## 1. Principles for the sound design
1. **Accompany the real world; don't replace it.** Synthetic surroundings are a frame that turns attention outward. Mix them low, leave gaps, and make room for real sound.
2. **Hush moments.** Periodically, every synthetic layer fades out completely and a single whispered cue ("Listen.") invites the listener to hear what's actually there (§5). This is a signature of the experience. It's on by default and can be turned off.
3. **Do no harm to wildlife or neighbors.** Wildlife calls never play through the phone speaker, because playback can disturb animals. They're muted during nesting months the sound designer sets. On speaker, the app plays only `speaker_safe` layers at reduced volume. A grove's wildlife-speaker setting (`allows_speaker_wildlife_sounds`, off by default) silences surroundings on the speaker entirely inside that grove.
4. **Real sounds of the place first.** Prefer field recordings Replaceplace makes at the actual place. All audio (narration, music, effects) is produced by Replaceplace. "Synthetic" here means *randomly arranged*, not artificially generated: no AI-generated audio.
5. **The narrator is always intelligible.** Narration is the top priority. Everything else ducks under it.
6. **Safe for walkers.** No hazard-like sounds. Sharp transients are flagged at publish (`TRANSIENT`). Beds stay stereo and capped in length.

---

## 2. Audio engine

### 2.1 Requirements
- Several simultaneous sources within a **12-voice** budget (`allocateVoices` in `packages/shared`):
  - narration or locked teaser: **1**
  - music stems: up to **4**
  - ambience beds: up to **2**
  - one-shot accents: up to **2** (global)
  - beacon: **1** (headphones only)
  - moment (threshold motif or afterglow resolve): **1**
  - spare: **1**
- Per-source gain automation (ramps), stereo pan, and playback-rate or pitch variation for one-shots
- Sample-accurate synced looping for music stems with loop points
- Continuous playback with the screen locked and the app in the background, on iOS and Android
- Lock-screen and now-playing metadata and controls for narration
- Audio route detection: headphones, Bluetooth or speaker
- Interruptions (calls, other apps): pause everything and resume politely
- **Mix health:** `mixLevelFor` sheds layers under clock / battery / thermal stress in order: accents → beacon → extra stems → second bed → music. Shed one layer after `MIX_SHED_AFTER_WINDOWS` (2) consecutive degraded watchdog windows (~10 s). Recover one layer after every `MIX_RECOVER_STEP_MS` (60_000) of healthy clock. Recovery is slower than shedding. During a cue crossfade, accents and the beacon pause.

### 2.2 Recommended implementation
- **Primary:** `react-native-audio-api` (Software Mansion; a Web Audio–style graph with `AudioBufferSourceNode`, `GainNode`, `StereoPannerNode` and scheduling). Wrap it behind our own `AudioEngine` interface in **`packages/shared`** (types only); the mobile implementation lives in `apps/mobile/src/audio/engine/`.
- **Mandatory spike (BUILD_PLAN M1):** prove on real iOS and Android devices that the library handles all of §2.1, especially background playback with the screen locked for 60 minutes, lock-screen controls and route detection. Record the results in `docs/adr/0001-audio-engine.md`.
- **Fallback if the spike fails:** a custom Expo Module (Swift `AVAudioEngine` with `AVAudioPlayerNode`s; Kotlin Media3/ExoPlayer instances or Oboe) behind the same `AudioEngine` interface. Lock-screen metadata through `MPNowPlayingInfoCenter` and an Android `MediaSession`.
- The UI chime and haptic feedback use the same engine (a bundled asset) and `expo-haptics`.

```ts
// packages/shared/src/audio/AudioEngine.ts — see that file for the concrete interface
export type BusId = "story" | "music" | "surroundings" | "ui" | "moment";
```

### 2.3 Buses and default levels
| Bus | Default level | Ducked under narration | Held in afterglow | User slider |
|---|---|---|---|---|
| `story` | 0 dB (assets at -16 LUFS) | — | — | Story |
| `music` | -8 dB | additional -10 dB, 800 ms attack, 2.5 s release | yes | Music |
| `surroundings` | -10 dB | additional -6 dB | yes | Surroundings |
| `ui` | -6 dB | — | — | (follows Story) |
| `moment` | -8 dB | additional -10 dB (like music) | **no** — resolves play in the afterglow | (follows Music) |

- **Speaker route:** the `surroundings` bus drops a further 6 dB, and non-`speaker_safe` layers are skipped.
- **Beacons** play on `surroundings` (Hush silences them). **Locked teasers** play on `story`. **Resolves and threshold motifs** play on `moment`.
- **Master limiter** at -1 dBFS, if the engine supports it. Otherwise keep the summed gains conservative.

---

## 3. Surroundings: the generative ambience scheduler

### 3.1 Which profile is active
Run on every location fix and at least every 5 s, as a pure function in `packages/shared/audio/ambience.ts`:

1. Find the ambience zones containing the user. For each, `weight = clamp(distanceToEdge / edge_fade_m, 0, 1)`.
2. Sort by `priority` descending. Take the top zone. If its weight is below 1, blend it with the next zone, or with the **landcover fallback** for the remaining weight.
3. **Landcover fallback:** look up the user's H3 cell (resolution 9, ~0.1 km²) in the region's grid, then `class → profile`. Smooth it by taking the majority class of the cell and its 6 neighbors, so the sound doesn't flicker at boundaries.
4. Output: `[{profileSlug, weight}]`, at most 2 entries, weights summing to 1. Entries with the same profile merge into one (weights summed). Landcover majority ignores cells with no data; a tie goes to the center cell's class when it is one of the tied classes. Profile changes crossfade over 4–8 s.

### 3.2 Context filters (every layer, every evaluation)
- **Time window** (shared by all three layers, `packages/shared/src/time/timeWindow.ts`): `day` from sunrise to sunset, `night` otherwise, computed with `suncalc` at the **region's** `sunReference` in the region's timezone. Skip layers whose `timeWindow` isn't the current window. Where the sun doesn't rise or set (polar regions), fall back to `day` 06:00–18:00 local time.
- **Month:** skip layers whose `months` exclude it. Skip `wildlife_call` layers in `nesting_mute_months`.
- **Route:** if on speaker, skip `wildlife_call` and non-`speaker_safe` layers. Inside a grove whose `allowsSpeakerWildlifeSounds` is false, skip every surroundings layer on the speaker.
- **Hush active:** skip everything (§5).

### 3.3 Beds
- Each eligible bed layer in the active profile picks one asset (weighted random, avoiding the last `no_repeat_last`) and loops it.
- When its loop ends, it may switch to another asset with an equal-power crossfade over `crossfade_ms`.
- Gain is randomized within the min/max range at each switch, then scaled by the profile weight as linear gain: `gainDb + 20·log10(weight)` (silent at weight 0).
- Beds must be **stereo** (mono bed = publish **error** `BED_MONO`). Duration above **2 minutes** is a publish **warning** `BED_LONG`.

### 3.4 One-shots
For each eligible oneshot layer:
```
nextAt = now + max(min_interval_s, Exponential(mean_interval_s / (density × weight)))
on tick ≥ nextAt and concurrent(layer) < max_concurrent and globalConcurrent < 2:
   asset = weightedPick(layer.assets, excluding lastN)
   gainDb = uniform(gain_db_min, gain_db_max)
   pan    = uniform(pan_min, pan_max)
   rate   = 2^(uniform(pitch_cents_min, pitch_cents_max) / 1200)
   engine.playOneShot(asset, {gainDb, pan, rate}) on the surroundings bus
```
- A seeded RNG (seed = session id) makes runs reproducible in tests and in the admin simulator.
- **Global accent cap:** at most **2** concurrent one-shots across all layers (`ONESHOT_CONCURRENT_GLOBAL_MAX`). While narration plays, also no more than 1 one-shot per 4 s across all layers. A 1.5 s silence guard after narration starts and before it ends keeps the first and last words clear.
- A one-shot blocked by `max_concurrent`, the global cap, the density cap or the silence guard is dropped, and the next one is drawn from that tick. Random draws happen only when a shot is scheduled, so results don't depend on the tick rate.

### 3.5 Beacons (guide me by ear)
- Every unexplored playable fragment may have `beacon_asset_id`; else the grove default for its tier (`grove_sound_cues` kind `beacon_root` / `beacon_branch` / `beacon_leaf`).
- On by default (`beaconsEnabled: true` in shared settings). Headphones only.
- Pure `beaconMix(listener, courseDeg | null, target, lastPan)` → `{ gainDb, pan, lowpassHz }`: audible within 100 m; pan from bearing vs course (hold last pan with no course); behind → lowpass.
- Pure `chooseBeacon`: one at a time; nearest unexplored (`isPlayableNow` and not `completedEpoch`); Root > Branch > Leaf when within 10 m; switch only if another is closer by more than 10 m; none while narration plays.

---

## 4. Soundtrack: adaptive music

### 4.1 Story state (the input to music selection)
```ts
type StoryState = {
  groveId?: string;
  playingFragmentId?: string;
  playingTier?: 'root'|'branch'|'leaf';
  playingThreadIds: string[];
  lastFragmentId?: string;
  lastTier?: 'root'|'branch'|'leaf';
  lastThreadIds: string[];
  heard: Set<string>;               // completed for latest contingency
  timeWindow: 'day'|'night';
  narrationPlaying: boolean;
  depthM?: number;                  // distanceInsideMeters; absent until first fix
  insideTierBuffers: ('root'|'branch'|'leaf')[];  // JSON-serializable (not a Set)
};
```
Without a location fix, `depthM` and buffer membership are absent — depth / buffer conditions do **not** match (they are not treated as 0).

### 4.2 Conditions (zod `MusicCondition`)
```ts
const MusicCondition = z.object({
  threadIds:   z.array(z.string().uuid()).optional(),
  tiers:       z.array(z.enum(['root','branch','leaf'])).optional(),
  heardAll:    z.array(z.string().uuid()).optional(),
  heardAny:    z.array(z.string().uuid()).optional(),
  notHeard:    z.array(z.string().uuid()).optional(),
  narrationPlaying: z.boolean().optional(),
  minDepthM: z.number().nonnegative().optional(),
  insideTierBuffer: z.enum(['root','branch','leaf']).optional(),
}).strict();
// every present key must match (AND); empty object = always; empty array ≈ absent
```
Depth and buffer keys use **5 m hysteresis** (`DEPTH_BLOOM_HYSTERESIS_M`) via latched serializable state.

**Growth steps:** the grove’s song grows with the story. Each step is its own cue (arrangement) chosen by `heardAll`. Per grove and time window, count the base cue plus every grove cue whose conditions use **only** `heardAll`; that total must be ≤ **4** (publish failure `GROWTH_STEPS_OVER_MAX`). A step may add or remove layers. Admin “after this fragment” writes `heardAll`.

**Depth bloom:** texture default **15 m** deep (`DEPTH_BLOOM_TEXTURE_M_DEFAULT`; per-grove override). Melody: inside a playable Root’s buffer circle (**76.2 m**, `GROVE_BUFFER_M.root`). Branch (45.72 m) and Leaf (30.48 m) buffers are optional. At most **4 stems per cue**.

### 4.3 Selection (pure function `packages/shared/audio/music.ts`)
1. Candidate cues: those whose `timeWindow` is the current window, whose zone polygon contains the user (or grove boundary when `useGroveBoundary`), and whose `conditions` match `StoryState`.
2. Pick the highest `priority`. **Hysteresis:** keep the current cue while it is still a candidate and has played for less than `min_dwell_s`, or if its priority equals the best.
3. When a completion would change the cue via `heardAll` growth, **defer** until that fragment’s afterglow ends so the switch lands on the resolve.
4. When the cue changes, crossfade over `crossfade_ms` (equal-power). The new cue starts at bar 1 of its loop.
5. **Stems:** all stems start together, sample-aligned. Each stem plays at its `gainDb` unless a rule in `state_gains` matches; the first matching rule replaces the resting level. Re-evaluated on every state change with a 2 s ramp. ≤4 stems; the foundation stem keeps the edge fade.
6. **Edges:** music gain multiplies (linear) by `clamp(distanceToEdge / edge_fade_m, 0, 1)`. Grove-boundary / pack zones without their own fade use 60 m.

### 4.4 Example
```
Cue "Salt Marsh – Theme (Day)"    grove=Salt Marsh, day,   priority 100, conditions {}
Cue "Salt Marsh – Theme (Night)"  grove=Salt Marsh, night, priority 100, conditions {}
Cue "Salt Marsh – Mara"           grove=Salt Marsh, day,   priority 200, conditions {threadIds:[mara]}
  stems: base (0 dB), strings (state_gains: [{when:{tiers:['branch']}, gain_db:0}], default -60)
Cue "Salt Marsh – After the Flood" grove=Salt Marsh, night, priority 300, conditions {heardAll:[frag10]}
```

---

## 5. Hush moments, afterglow, motifs and resolves
- **Hush:** unchanged from v3 (setting on, inside grove, interval, fade, "Listen." cue, hold, cancel on trigger). Hush fades music and surroundings (and therefore beacons).
- **Afterglow:** after a fragment ends, hold ducked levels on `music` and `surroundings` for 8 s (`AFTERGLOW_MS`). The `moment` bus is **not** held ducked, so a resolve can play.
- **Resolve:** each cue may carry `resolve_root_asset_id` (4–8 s), `resolve_branch_asset_id` (3–6 s), `resolve_leaf_asset_id` (2–4 s). Optional `fragments.resolve_asset_id` overrides the tier. Kind `music_moment`. Missing → plain 8 s pause; publish warning `RESOLVE_MISSING`. Pure `pickResolve` from `startAfterglow{fragmentId, tier}`.
- **Threshold motif:** one motif per grove per time window (`threshold_motif_day` / `threshold_motif_night`). Plays **once per visit** once depth ≥ **10 m**, never over narration (wait up to **30 s**, then drop). Pure rule from `groveEntered` + depth. Kind `music_moment` on the `moment` bus.

---

## 6. Asset standards (sound team; enforced as publish warnings / errors)
| Kind | Format | Loudness | Notes |
|---|---|---|---|
| narration | AAC `.m4a`, mono 96 kbps, or stereo 128 kbps when the **fragment** has character links | -16 LUFS integrated, -1 dBTP | Trim silence to ≤ 300 ms at the head. Narrator-only stereo → warning. **Narrator always center and close; no character dead center.** |
| sfx_oneshot | AAC mono or stereo, 128 kbps | -24 LUFS short-term peak region | ≤ 12 s; 50 ms fades |
| sfx_bed | AAC **stereo**, 128 kbps | -30 LUFS | Loop points; warn if > 2 min; mono = **error** |
| music_stem | AAC stereo, 160 kbps | -23 LUFS (sum ≈ -20) | Equal length per cue; loop points |
| music_moment | AAC stereo, 160 kbps | -20 LUFS | Resolves and threshold motifs |
| beacon | AAC mono, 96 kbps | -30 LUFS | Loopable; engine pans |
| voice_cue / growth_cue | AAC mono, 96 kbps | -18 LUFS | Locked teasers reuse `voice_cue` |

- **Staff export phone-ready files** before uploading. No server-side transcoding.
- Loudness / true peak measured at upload (`packages/shared/src/audio/loudness.ts`). Format checks too. Warnings: `LOUDNESS`, `AUDIO_FORMAT`, `TRANSIENT` (crest factor true peak vs RMS of loudest 400 ms **> 20 dB**, `TRANSIENT_CREST_DB`), `BED_LONG`, `REGION_AMBIENCE_BUDGET`, `RESOLVE_MISSING`, `RESOLVE_DURATION`, `NARRATION_STEREO`. Failures: `BED_MONO`, `STEMS_OVER_MAX`, `GROWTH_STEPS_OVER_MAX`.
- **Safe for walkers:** upload checklist stored on the asset (`safe_for_walkers_checked`). Wildlife rules unchanged.
- **Breath points / swell:** `revision_versions.breath_points_ms` / `swell_cues_ms`. `suggestBreathPoints`: silences ≥ 350 ms. Resume after interruption: `bp = max(breathPoint ≤ stoppedAtMs)` or 0 if none; `resume = max(0, bp − 300)`. Accents only inside pauses. **Back** skips 10 s and does not use breath points.
- **Directing for walking ears:** keep sentences short enough to land between footsteps; leave air after place-names; avoid sudden level jumps that read as hazard; prefer mid-range for outdoor intelligibility; characters occupy left/right — narrator stays center.

---

## 7. Download size budgets
| Pack | Target |
|---|---|
| Region ambience library | ≤ 40 MB (publish **warning** when over) |
| Grove: narration (current revisions, one language) | ≤ 60 MB |
| Grove: music | ≤ 30 MB |
| Grove: images (portraits) | ≤ 5 MB |

Day and Night versions both count toward the narration budget. Download the Grove pack first; fetch the region library in the background on Wi-Fi.

---

## 8. Admin: the Listening Simulator
A browser tool (`/simulate/[groveId]`) that runs **the same pure functions** with Web Audio:
- Drag a walker pin. Trigger radii, zones, edge fades, H3 overlay, and depth-bloom / buffer circles are visible.
- Story-state panel: completed fragments, Day/Night, month, headphones/speaker, **beacons on/off**.
- Live readout: profile weights, oneshot timeline (cap 2), music cue/stems, depth m, buffer flags, beacon pan/gain, motif/resolve/teaser events, Hush countdowns, bus meters (including `moment`).
- Breath markers on the narration bar; GPX replay at 1× or 4×.

---

## 9. Tests (shared logic must be fully unit-tested)
- **Time window:** day/night boundaries; polar fallback.
- **Ambience:** zone blend; landcover; filters; global oneshot cap 2; seeded determinism.
- **Music:** conditions including depth/buffer hysteresis; growth deferral past afterglow; stem ≤4; edge fade.
- **Resolve / motif / beacon / teaser / breath / mix ladder / voice budget** as in A5.
- **Engine (device tests):** 60-minute locked-screen run; route switch; interruption; memory under 150 MB.
