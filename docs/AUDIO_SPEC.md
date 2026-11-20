# InTell — Audio Spec: Three Layers, One Mix (v3)

v3 incorporates ADR 0004: all audio is produced by Replaceplace; every fragment version, ambience layer and music cue is tagged **Day** or **Night**; rings and crossroads are removed.

InTell is mostly heard, not seen. Three layers play together, mixed on the device:

| Layer | What | Driven by | Data |
|---|---|---|---|
| **Story** (narration) | Root, Branch and Leaf fragments, each with a Day and/or Night version | Proximity to a fragment point (or a physical-marker scan), unlock state, Day or Night | `fragments`, `fragment_revisions`, `revision_versions` |
| **Surroundings** (ambience) | Randomized sound effects and beds that match the setting: birds at the refuge, wind in mountain aspens, traffic hum in town | Which ambience zone you're in (or land cover as a fallback), Day or Night, month, headphones vs speaker | `ambience_profiles`, `ambience_layers`, `ambience_zones`, landcover grid |
| **Soundtrack** (music) | Looping music, optionally in stems, that changes with place and story | Music zones and Groves, Day or Night, plus story state (which thread or tier you're in, what you've completed) | `music_zones`, `music_cues`, `music_cue_stems` |

Data definitions are in `DATA_MODEL.md` §3–6.

---

## 1. Principles for the sound design
1. **Accompany the real world; don't replace it.** Synthetic surroundings are a frame that turns attention outward. Mix them low, leave gaps, and make room for real sound.
2. **Hush moments.** Periodically, every synthetic layer fades out completely and a single whispered cue ("Listen.") invites the listener to hear what's actually there (§5). This is a signature of the experience. It's on by default and can be turned off.
3. **Do no harm to wildlife or neighbors.** Wildlife calls never play through the phone speaker, because playback can disturb animals. They're muted during nesting months the sound designer sets. On speaker, the app plays only `speaker_safe` layers at reduced volume. A grove's wildlife-speaker setting (`allows_speaker_wildlife_sounds`, off by default) silences surroundings on the speaker entirely inside that grove.
4. **Real sounds of the place first.** Prefer field recordings Replaceplace makes at the actual place. All audio (narration, music, effects) is produced by Replaceplace. "Synthetic" here means *randomly arranged*, not artificially generated: no AI-generated audio.
5. **The narrator is always intelligible.** Narration is the top priority. Everything else ducks under it.

---

## 2. Audio engine

### 2.1 Requirements
- Several simultaneous sources: **exactly one narration voice** (never two story fragments at once), up to 3 synced music stems, 1–2 ambience beds with crossfade, and up to 6 concurrent one-shots
- Per-source gain automation (ramps), stereo pan, and playback-rate or pitch variation for one-shots
- Sample-accurate synced looping for music stems with loop points
- Continuous playback with the screen locked and the app in the background, on iOS and Android
- Lock-screen and now-playing metadata and controls for narration
- Audio route detection: headphones, Bluetooth or speaker
- Interruptions (calls, other apps): pause everything and resume politely

### 2.2 Recommended implementation
- **Primary:** `react-native-audio-api` (Software Mansion; a Web Audio–style graph with `AudioBufferSourceNode`, `GainNode`, `StereoPannerNode` and scheduling). Wrap it behind our own `AudioEngine` interface in **`packages/shared`** (types only); the mobile implementation lives in `apps/mobile/src/audio/engine/`.
- **Mandatory spike (BUILD_PLAN M1):** prove on real iOS and Android devices that the library handles all of §2.1, especially background playback with the screen locked for 60 minutes, lock-screen controls and route detection. Record the results in `docs/adr/0001-audio-engine.md`.
- **Fallback if the spike fails:** a custom Expo Module (Swift `AVAudioEngine` with `AVAudioPlayerNode`s; Kotlin Media3/ExoPlayer instances or Oboe) behind the same `AudioEngine` interface. Lock-screen metadata through `MPNowPlayingInfoCenter` and an Android `MediaSession`.
- The UI chime and haptic feedback use the same engine (a bundled asset) and `expo-haptics`.

```ts
// packages/shared/src/audio/AudioEngine.ts — see that file for the concrete interface
// (M1 brief + ADR 0001). Sketch below is illustrative only.
export interface AudioEngine {
  init(opts: { mixWithOthers: false }): Promise<void>;
  load(sha: string, uri: string): Promise<BufferHandle>;
  playNarration(h: BufferHandle, meta: NowPlayingMeta, startAtMs?: number): VoiceHandle;
  // … pause/resume, one-shots, loop groups, bed crossfade, gains, route/interruption/remote …
}
```

### 2.3 Buses and default levels
| Bus | Default level | Ducked under narration | User slider |
|---|---|---|---|
| `story` | 0 dB (assets at -16 LUFS) | — | Story |
| `music` | -8 dB | additional -10 dB, 800 ms attack, 2.5 s release | Music |
| `surroundings` | -10 dB | additional -6 dB | Surroundings |
| `ui` | -6 dB | — | (follows Story) |

- **Speaker route:** the `surroundings` bus drops a further 6 dB, and non-`speaker_safe` layers are skipped.
- **Master limiter** at -1 dBFS, if the engine supports it. Otherwise keep the summed gains conservative.

---

## 3. Surroundings: the generative ambience scheduler

### 3.1 Which profile is active
Run on every location fix and at least every 5 s, as a pure function in `packages/shared/audio/ambience.ts`:

1. Find the ambience zones containing the user. For each, `weight = clamp(distanceToEdge / edge_fade_m, 0, 1)`.
2. Sort by `priority` descending. Take the top zone. If its weight is below 1, blend it with the next zone, or with the **landcover fallback** for the remaining weight.
3. **Landcover fallback:** look up the user's H3 cell (resolution 9, ~0.1 km²) in the region's grid, then `class → profile`. Smooth it by taking the majority class of the cell and its 6 neighbors, so the sound doesn't flicker at boundaries.
4. Output: `[{profileSlug, weight}]`, at most 2 entries, weights summing to 1. Profile changes crossfade over 4–8 s.

### 3.2 Context filters (every layer, every evaluation)
- **Time window** (shared by all three layers, `packages/shared/src/time/timeWindow.ts`): `day` from sunrise to sunset, `night` otherwise, computed with `suncalc` at the **region's** `sunReference` in the region's timezone. Skip layers whose `timeWindow` isn't the current window. Where the sun doesn't rise or set (polar regions), fall back to `day` 06:00–18:00 local time.
- **Month:** skip layers whose `months` exclude it. Skip `wildlife_call` layers in `nesting_mute_months`.
- **Route:** if on speaker, skip `wildlife_call` and non-`speaker_safe` layers. Inside a grove whose `allowsSpeakerWildlifeSounds` is false, skip every surroundings layer on the speaker.
- **Hush active:** skip everything (§5).

### 3.3 Beds
- Each eligible bed layer in the active profile picks one asset (weighted random, avoiding the last `no_repeat_last`) and loops it.
- When its loop ends, it may switch to another asset with an equal-power crossfade over `crossfade_ms`.
- Gain is randomized within the min/max range at each switch, multiplied by the profile weight.

### 3.4 One-shots
For each eligible oneshot layer:
```
nextAt = now + max(min_interval_s, Exponential(mean_interval_s / (density × weight)))
on tick ≥ nextAt and concurrent(layer) < max_concurrent:
   asset = weightedPick(layer.assets, excluding lastN)
   gainDb = uniform(gain_db_min, gain_db_max)
   pan    = uniform(pan_min, pan_max)
   rate   = 2^(uniform(pitch_cents_min, pitch_cents_max) / 1200)
   engine.playOneShot(asset, {gainDb, pan, rate}) on the surroundings bus
```
- A seeded RNG (seed = session id) makes runs reproducible in tests and in the admin simulator.
- **Global density cap:** no more than 1 one-shot per 4 s across all layers while narration is playing. A 1.5 s silence guard after narration starts and before it ends keeps the first and last words clear.

---

## 4. Soundtrack: adaptive music

### 4.1 Story state (the input to music selection)
```ts
type StoryState = {
  groveId?: string;                 // grove containing the user, if any
  playingFragmentId?: string;       // narration currently playing
  lastFragmentId?: string;          // most recently completed
  lastTier?: 'root'|'branch'|'leaf';
  lastThreadIds: string[];
  heard: Set<string>;               // fragment ids completed for their latest contingency (ADR 0003, 0004)
  timeWindow: 'day'|'night';
  narrationPlaying: boolean;
};
```

### 4.2 Conditions (zod `MusicCondition`, stored in `music_cues.conditions` and `music_cue_stems.state_gains[].when`)
```ts
const MusicCondition = z.object({
  threadIds:   z.array(z.string().uuid()).optional(),   // any match with lastThreadIds or the playing fragment's threads
  tiers:       z.array(z.enum(['root','branch','leaf'])).optional(),
  heardAll:    z.array(z.string().uuid()).optional(),
  heardAny:    z.array(z.string().uuid()).optional(),
  notHeard:    z.array(z.string().uuid()).optional(),
  narrationPlaying: z.boolean().optional(),
}).strict();   // every present key must match (AND); empty object = always
```

### 4.3 Selection (pure function `packages/shared/audio/music.ts`)
1. Candidate cues: those whose `timeWindow` is the current window, whose zone polygon contains the user (or grove boundary when `useGroveBoundary`), and whose `conditions` match `StoryState`. (Day/Night is a required field on the cue, not a condition.)
2. Pick the highest `priority`. **Hysteresis:** keep the current cue while it is still a candidate and has played for less than `min_dwell_s`, or if its priority equals the best.
3. When the cue changes, crossfade over `crossfade_ms` (equal-power). The new cue starts at bar 1 of its loop. (Musical bar-synced transitions are out of scope for v1.)
4. **Stems:** all stems start together, sample-aligned. Each stem's gain = `gainDb` plus the first matching rule in `state_gains`, re-evaluated on every state change with a 2 s ramp. Example: a strings layer fades up only while a Branch plays.
5. **Edges:** music gain multiplies by `clamp(distanceToEdge / edge_fade_m, 0, 1)`. Outside every zone and grove, music fades to silence. Silence is a valid state.

### 4.4 Example
```
Cue "Salt Marsh – Theme (Day)"    grove=Salt Marsh, day,   priority 100, conditions {}
Cue "Salt Marsh – Theme (Night)"  grove=Salt Marsh, night, priority 100, conditions {}
Cue "Salt Marsh – Mara"           grove=Salt Marsh, day,   priority 200, conditions {threadIds:[mara]}
  stems: base (0 dB), strings (state_gains: [{when:{tiers:['branch']}, gain_db:0}], default -60)
Cue "Salt Marsh – After the Flood" grove=Salt Marsh, night, priority 300, conditions {heardAll:[frag10]}
```

---

## 5. Hush moments and afterglow
- **Hush:**
  - Conditions: the setting is on, the user is inside a grove, no narration has played in the last `hushIntervalMin` (default 7; random ±2), and none is pending.
  - Fade the music and surroundings buses to -inf over 4 s.
  - At silence + 1 s, play the `hush` UI voice cue ("Listen.") at -12 dB, recorded by the grove narrator.
  - Hold 60–90 s (random), then fade back in over 6 s.
  - If a fragment triggers during a Hush, end the Hush at once with a 1 s fade.
- **Afterglow:** after a fragment ends, hold the ducked levels for 8 s before releasing. This leaves a beat of quiet for the story to land.

---

## 6. Asset standards (sound team; enforced as publish warnings)
| Kind | Format | Loudness | Notes |
|---|---|---|---|
| narration | AAC `.m4a`, mono, 96 kbps, 44.1/48 kHz | -16 LUFS integrated, -1 dBTP | Trim silence to ≤ 300 ms at the head |
| sfx_oneshot | AAC mono or stereo, 128 kbps | -24 LUFS short-term peak region | ≤ 12 s; 50 ms fades |
| sfx_bed | AAC stereo, 128 kbps | -30 LUFS | 30–120 s, seamless loop points |
| music_stem | AAC stereo, 160 kbps | -23 LUFS (sum of stems ≈ -20) | All stems in a cue the same length; loop points set |
| voice_cue / growth_cue | AAC mono, 96 kbps | -18 LUFS | |

- **Staff export phone-ready files** to this table before uploading. There's no server-side transcoding. Masters stay in Replaceplace's own archive, outside InTell.
- Loudness and true peak are measured at upload in the browser (an ITU-R BS.1770-4 implementation in `packages/shared/src/audio/loudness.ts`, run via Web Audio in the admin) and stored in `audio_assets.loudness_lufs` / `true_peak_dbtp`. Format, channels and bitrate are checked too. Deviations are publish **warnings** (`LOUDNESS`, `AUDIO_FORMAT`).
- **All audio is produced by Replaceplace.** There are no third-party or licensed sounds, so there are no rights records.

---

## 7. Download size budgets
| Pack | Target |
|---|---|
| Region ambience library | ≤ 40 MB (shared by all groves; downloaded once) |
| Grove: narration (current revisions, one language) | ≤ 60 MB |
| Grove: music | ≤ 30 MB |
| Grove: images (portraits) | ≤ 5 MB |

Day and Night versions both count toward the narration budget. The base map is online (ADR 0002), so there are no tile downloads. Download the Grove pack first; fetch the region library in the background on Wi-Fi.

---

## 8. Admin: the Listening Simulator
A browser tool (`/simulate/[groveId]`) that runs **the same pure functions** (`ambience.ts`, `music.ts`, `trigger.ts`, `unlock.ts`) with Web Audio:
- Drag a "walker" pin on the map. The trigger radii, zones, edge fades and the H3 landcover overlay are visible.
- A story-state panel: toggle completed fragments, choose Day or Night and a month, and headphones or speaker.
- A live readout of the active profile weights, scheduled one-shots (a timeline), the music cue and stem gains, and Hush countdowns.
- Bus meters and mute/solo per layer.
- A "Record walk" mode that replays a GPX file at 1× or 4× for review sessions with the story team.

The simulator lets the sound designer and writers tune the whole experience without walking the trail, and it doubles as an integration test for the shared logic.

---

## 9. Tests (shared logic must be fully unit-tested)
- **Time window:** day/night boundaries at sunrise and sunset for several dates and latitudes; the polar fallback.
- **Ambience:** zone priority and edge blending; landcover fallback with neighbor smoothing; Day/Night and month filters; speaker filtering; wildlife nesting mute; density cap during narration; seeded determinism.
- **Music:** Day/Night filtering; condition matching for every key; priority and hysteresis; dwell; stem rule evaluation; edge fade; silence outside zones.
- **Hush:** scheduling, cancellation by a trigger, never during narration.
- **Engine (device tests):** 60-minute locked-screen run with all layers on iOS and Android; route switch mid-play; phone-call interruption and resume; memory stays under 150 MB.
