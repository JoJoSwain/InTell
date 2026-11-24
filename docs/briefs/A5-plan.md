# A5 plan — M4b sound design and approved sound features

Lane A · A5. Plan only. No module / migration / admin code in this commit.

Two PRs after plan approval: **Part 1** (specs, data, shared rules, packs, publish checks) merges first; then **Part 2** (admin screens, Web Audio engine, Listening Simulator) on a follow-up branch from master.

**Out of scope:** phone playback (M6/M7, Lane B), engine streaming, spatial character placement, Journal growth audio (M9). Lane A never edits `apps/mobile` (read-only for pack parsing).

Sources: `docs/briefs/A5-sound-features.md` (Jordan Nov 23 decisions), BUILD_PLAN M4, AUDIO_SPEC, DATA_MODEL §3–6 / §11–12, ADR 0001 Findings, M4a plan review A1 (region-pack sound fields), A4 session hooks, `packages/shared` audio/story/geo modules.

---

## Named constants and data fields (every decided value)

Export from `@intell/shared` (or store as DB defaults / pack fields). No magic numbers in rule bodies.

| Name | Value | Kind |
|---|---|---|
| `MUSIC_GROWTH_STEPS_MAX` | `4` | const — max cues that form a growth chain per grove per window |
| `MUSIC_STEMS_PER_CUE_MAX` | `4` | const — publish check |
| `DEPTH_BLOOM_TEXTURE_M_DEFAULT` | `15` | const — grove override column default |
| `DEPTH_BLOOM_HYSTERESIS_M` | `5` | const — every depth / buffer threshold |
| `GROVE_BUFFER_M.root` / `.branch` / `.leaf` | `76.2` / `45.72` / `30.48` | **reuse** A2 export — melody uses root; branch/leaf optional |
| `RESOLVE_ROOT_MS` range | `4000`–`8000` | const min/max + publish warnings |
| `RESOLVE_BRANCH_MS` range | `3000`–`6000` | const |
| `RESOLVE_LEAF_MS` range | `2000`–`4000` | const |
| `AFTERGLOW_MS` | `8000` | existing DuckingPolicy — plain pause fallback |
| `THRESHOLD_MOTIF_DEPTH_M` | `10` | const |
| `THRESHOLD_MOTIF_WAIT_MS` | `30_000` | const — drop if narration blocks longer |
| `ONESHOT_CONCURRENT_GLOBAL_MAX` | `2` | const — replaces AUDIO_SPEC §2.1 “6” |
| `BED_DURATION_WARN_MS` | `120_000` | const — publish warning above |
| `REGION_AMBIENCE_BUDGET_BYTES` | `40 * 1024 * 1024` | const — §7 warning |
| `BEACON_RANGE_M` | `100` | const |
| `BEACON_TIER_NEAR_M` | `10` | const — tier preference band + switch hysteresis |
| `beaconsEnabled` default | `true` | settings field |
| `BREATH_SILENCE_MIN_MS` | `350` | const — `suggestBreathPoints` |
| `RESUME_PREROLL_MS` | `300` | const — `resumePointMs` |
| `BACK_SKIP_MS` | `10_000` | const — podcast Back |
| `TEASER_ONCE_PER_DAY` | calendar day (device local) | rule + kv key shape documented |
| Voice budget slots | narration/teaser 1, stems 4, beds 2, accents 2, beacon 1, moment 1, spare 1 (=12) | consts `VOICE_SLOT_*` |
| Mix shed order | accents → beacon → extra stems → second bed → music | const array |
| Recovery vs shed | recovery slower (hysteresis) | consts `MIX_SHED_*_MS` / `MIX_RECOVER_*_MS` — **gap** if exact ms not decided |

DB / pack data fields (not code constants): per-grove `depth_bloom_texture_m`; cue resolve asset ids; fragment `beacon_asset_id`, `resolve_asset_id`, `teaser_locked_asset_id`; grove_sound_cues rows; `breath_points_ms` / `swell_cues_ms`; asset safe-sound checklist flag; region-pack layer fields from M4a A1.

---

## Pack compatibility decision

**Read (mobile, no edits):** `apps/mobile/src/packs/install.ts` and `sync.ts` call `GrovePack.parse` / `safeParse` and `RegionPack` from `@intell/shared`. Schemas are `.strict()` with `GrovePack.schema: z.literal(4)` and `RegionPack.schema: z.literal(2)`. Unknown keys fail; wrong `schema` fails (sync treats parse failure as reinstall).

**M4a plan review A1** said extending region layers needed a schema bump *and* a phone parser update in the same PR. **A5 cannot edit mobile.**

**Decision for A5 Part 1: optional additive fields on the current schema literals (`GrovePack` 4, `RegionPack` 2). No schema-number bump.**

Rationale:
1. Optional keys keep existing fixtures and M5a/M5b pack JSON valid under `.strict()`.
2. After Part 1 merges, the monorepo mobile workspace picks up the new shared package automatically — CI for M5 builds stays green without a Lane B PR.
3. A schema bump to 5/3 would break every current mobile parse of `schema: 4` / `2` until Lane B changed literals — forbidden by “don’t break M5a/M5b builds” while A5 owns only shared.

**Release sequencing (flag for Jordan):** any **already-shipped** binary that bundled pre-A5 `@intell/shared` will reject packs that include the new keys. Do not publish releases that emit the new fields to production until a mobile build that includes A5 shared is what devices run (or keep packing without the new keys until then). Demo/local packs after Part 1 are fine in the monorepo.

Carry into packs (all optional on schema 4/2):
- Grove: cue `resolveRootAssetSha` / `resolveBranchAssetSha` / `resolveLeafAssetSha`, stem lists (≤4), fragment `beaconAssetSha`, `resolveAssetSha`, `teaserLockedAssetSha`, breath/swell on versions, threshold motif shas (day/night), grove `depthBloomTextureM`, grove default beacon shas per tier, `edgeFadeM` on grove-pack cue zones (M4a A1).
- Region: layer months, nesting months, gain/pan/pitch ranges, intervals, `noRepeatLast`, `crossfadeMs`, asset weights, profile `density` (M4a A1).

---

## Migrations (Part 1)

One or few migrations under `supabase/migrations/` (Lane A only). Explicit grants per AGENTS.md.

### 1. Soundtrack / grove sound

```sql
-- groves
alter table public.groves
  add column depth_bloom_texture_m numeric(6,2) not null default 15
    check (depth_bloom_texture_m > 0);

-- music_cues: afterglow resolves (Day/Night from cue.time_window)
alter table public.music_cues
  add column resolve_root_asset_id uuid references public.audio_assets(id),
  add column resolve_branch_asset_id uuid references public.audio_assets(id),
  add column resolve_leaf_asset_id uuid references public.audio_assets(id);

-- fragments
alter table public.fragments
  add column beacon_asset_id uuid references public.audio_assets(id),
  add column resolve_asset_id uuid references public.audio_assets(id),
  add column teaser_locked_asset_id uuid references public.audio_assets(id);

-- grove-level sound cues (beacons + threshold motifs)
create table public.grove_sound_cues (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references public.groves(id) on delete cascade,
  kind text not null check (kind in (
    'beacon_root', 'beacon_branch', 'beacon_leaf',
    'threshold_motif_day', 'threshold_motif_night'
  )),
  asset_id uuid not null references public.audio_assets(id),
  unique (grove_id, kind)
);
```

### 2. Breath / swell

```sql
alter table public.revision_versions
  add column breath_points_ms int[] not null default '{}',
  add column swell_cues_ms int[] not null default '{}';
```

### 3. Safe sounds

```sql
alter table public.audio_assets
  add column safe_for_walkers_checked boolean not null default false,
  add column crest_factor_db numeric(5,2);  -- or onset metric; see publish TRANSIENT
```

### 4. Snapshots / pack builder / publish_check

Extend snapshot projection for new fragment/cue/grove/version/asset fields; stage through releases as today. Update `fn_publish_check` codes (below). Regenerate DB types.

**Publish checks (new):**

| Code | Severity | Rule |
|---|---|---|
| `STEMS_OVER_MAX` | failure | stems on a cue > `MUSIC_STEMS_PER_CUE_MAX` |
| `RESOLVE_MISSING` | warning | cue lacks a tier resolve the grove uses / no fallback asset |
| `RESOLVE_DURATION` | warning | resolve duration outside tier range |
| `BED_MONO` | **failure** | `sfx_bed` with `channels = 1` |
| `BED_LONG` | warning | bed `duration_ms` > `BED_DURATION_WARN_MS` |
| `REGION_AMBIENCE_BUDGET` | warning | region pack ambience bytes > 40 MB |
| `TRANSIENT` | warning | crest/onset over thresholds (plan defaults below; **gap** to confirm) |
| `NARRATION_STEREO` | warning | stereo narration with no linked characters on the version |
| `AUDIO_FORMAT` | warning | existing; extend for mono 96k / stereo 128k character rule |
| `GROWTH_STEPS_OVER_MAX` | warning or failure | >4 growth-step cues per grove+window (**gap:** warn vs fail) |

**Proposed TRANSIENT thresholds (flag if wrong):** crest factor > **12 dB** (peak vs RMS of loudest 400 ms), or onset strength above a fixed score from the existing loudness short-term path. Confirm with sound team before coding; expose as named consts.

---

## Type changes

### `MusicCondition` (`packages/shared/src/schemas/music.ts`)

Add optional keys (`.strict()` retained):

```ts
minDepthM: z.number().nonnegative().optional(),
insideTierBuffer: z.enum(["root", "branch", "leaf"]).optional(),
```

`musicConditionMatches` compares against extended `StoryState` with **5 m hysteresis** on depth and buffer entry/exit (stateful latch input — see rules).

### `StoryState` (`audio/music.ts` + AUDIO_SPEC §4.1)

```ts
depthM?: number;                    // distanceInsideMeters in current grove
insideTierBuffers: ("root"|"branch"|"leaf")[];  // playable fragments whose buffer contains the point
// existing fields unchanged
```

`storyStateOf(state, world, location?)` gains an optional location snapshot `{ lat, lng, groveBoundary, playableFragments }` so depth and buffers come from the latest fix. A4 callers without location keep today’s fields; depth keys absent ⇒ depth conditions don’t match (or treat as 0 — **gap**).

### Settings (shared)

New zod / type used by session world and (later) mobile Settings:

```ts
beaconsEnabled: z.boolean().default(true),
// existing / planned: accessibleTrigger, locationAvailable, hush, chime, bus gains…
```

Document that M7 wires the Settings Audio page; A5 only defines the shared default and Simulator toggle.

### Pack zod

- `GrovePack` / `GrovePackFragment` / music cue / revision version: optional new fields listed in Pack compatibility.
- `RegionPack` ambience layer: optional denser fields (M4a A1).
- `PackStem` unchanged shape; publish enforces ≤4 stems.
- Asset kinds: consider `resolve` / `beacon` / `threshold_motif` / `teaser` as existing kinds (`voice_cue`, `sfx_oneshot`, `music_stem`) — **gap:** which `asset_kind` for resolves and motifs.

### Session / AudioDirector contracts (no phone code)

Document how M6/M7 consume: `startAfterglow` → `pickResolve`; `groveEntered` + depth → `thresholdMotifStep`; `showTeaser{locked}` → `lockedTeaserStep`.

---

## Pure rules — signatures and tests

All in `packages/shared`; Vitest. Time as epoch ms or samples as noted.

### Depth bloom / conditions

```ts
depthConditionLatched(prev: boolean, depthM: number, thresholdM: number, hysteresisM = DEPTH_BLOOM_HYSTERESIS_M): boolean
insideTierBufferLatched(prev: Set<Tier>, point, playableFragments, buffers = GROVE_BUFFER_M, hysteresisM): Set<Tier>
musicConditionMatches(condition, story): boolean  // extend
```

**Tests:** enter/exit texture 15 m ±5 m; melody root buffer 76.2 m ±5 m; branch/leaf optional; empty arrays still “absent”; hysteresis does not chatter.

### Growth cue deferral

```ts
selectMusicCueDeferred(input & {
  pendingGrowthCueId: string | null;
  afterglowEndsAt: number | null;
  at: number;
}): … // same return as selectMusicCue; applies heardAll growth only after afterglow
```

**Tests:** completion that would raise priority waits until `at >= afterglowEndsAt`; non-growth switches unchanged; thinning (fewer stems) allowed.

### Afterglow resolve

```ts
pickResolve(input: {
  fragmentId: string;
  tier: "root"|"branch"|"leaf";
  cue: { resolveRootSha?, resolveBranchSha?, resolveLeafSha? };
  fragmentResolveSha?: string;
}): { kind: "asset"; assetSha: string } | { kind: "pause"; ms: typeof AFTERGLOW_MS }
```

**Tests:** fragment override wins; else tier; else pause 8 s; day/night comes from cue identity (caller).

### Threshold motif

```ts
thresholdMotifStep(state, event: {
  type: "groveEntered"|"fix"|"narrationStarted"|"narrationEnded"|"tick";
  at: number;
  depthM?: number;
  timeWindow: TimeWindow;
}, world): { state; effect?: { playMotifSha: string } }
```

**Tests:** once per session; depth ≥10 m; waits while narration ≤30 s then drops; day vs night asset; no replay on second `groveEntered` same session.

### Beacons

```ts
beaconMix(listener: LatLng, courseDeg: number | null, target: LatLng, lastPan: number):
  { gainDb: number; pan: number; lowpassHz: number }

chooseBeacon(input: {
  listener: LatLng;
  playableUnexplored: { id; tier; lat; lng }[];
  currentId: string | null;
  narrationPlaying: boolean;
  beaconsEnabled: boolean;
  headphones: boolean;
}): string | null
```

**Tests:** audible ≤100 m, gain falls with distance; pan L/R/front; behind → lowpass; `courseDeg` null holds `lastPan`; none while narration / speaker / disabled; nearest with Root>Branch>Leaf within 10 m; switch only if closer by >10 m.

### Breath / back / accents

```ts
suggestBreathPoints(samples: Float32Array, sampleRate: number): number[]
resumePointMs(breathPoints: readonly number[], stoppedAtMs: number): number
accentAllowed(positionMs: number, breathPoints: readonly number[]): boolean
// Back: clamp(positionMs - BACK_SKIP_MS, 0, duration) — no breath points
```

**Tests:** ≥350 ms silences; resume = last breath ≤ stop − 300 ms (floor 0); accents only in pauses; Back ignores breaths.

### Locked teaser

```ts
lockedTeaserStep(state: { playedFragmentIdsToday: Set<string>; dayKey: string }, event, meta):
  { state; playSha?: string }
```

**Tests:** only `reason: "locked"`; once per fragment per local day; never over narration; wrongTime → no audio.

### Mix ladder / voices

```ts
mixLevelFor(signals: { clockStarving: boolean; batterySaver: boolean; thermal: boolean }, prev: MixLevel): MixLevel
allocateVoices(requests: VoiceRequest[], crossfading: boolean): AllocatedVoices
```

**Tests:** shed order accents→beacon→extra stems→second bed→music; recovery slower than shed; 12 slots as tabled; during cue crossfade accents+beacon paused.

### Ambience cap

Update `ambience.ts` / oneshot scheduling so global concurrent oneshots ≤ `ONESHOT_CONCURRENT_GLOBAL_MAX` (2). **Tests** for the new cap.

---

## Proposed AUDIO_SPEC v4 (plan text for Claude)

> Specs land only after Claude approves this text. Agents do not edit `docs/AUDIO_SPEC.md` until then.

### §2.1 Requirements (budget split)
Replace the simultaneous-sources line with:

- Exactly one narration voice (or locked teaser), up to **4** synced music stems, **1–2** ambience beds with crossfade, up to **2** concurrent one-shots, **1** beacon (headphones), **1** moment voice (threshold motif or afterglow resolve), within a **12-voice** engine budget (`allocateVoices`).

### §4.1 StoryState
Add `depthM?` and `insideTierBuffers`. Document that depth bloom and buffer conditions read these; `storyStateOf` fills them from the latest fix when provided.

### §4.2 MusicCondition
Add `minDepthM?` and `insideTierBuffer?`. Document 5 m hysteresis on latches. Growth steps use `heardAll` (existing); admin “after this fragment” writes that array. At most 4 growth-step cues per grove per window (composer chooses fewer).

### §4.3 Selection
- Stem count ≤4; foundation stem keeps edge fade.
- When a completion would change the selected cue via `heardAll`, defer until afterglow ends (resolve lands with the growth).
- Depth/buffer stem rules re-evaluate with 2 s ramp (existing).

### §5 Afterglow
Afterglow may play a **resolve** asset (root 4–8 s, branch 3–6 s, leaf 2–4 s) from the active cue, overridden by `fragments.resolve_asset_id`. Missing → plain 8 s pause (`AFTERGLOW_MS`). Threshold motif: once per visit, ≥10 m inside, never over narration (wait ≤30 s then drop).

### §6 Asset standards / production
- Beds: stereo required (mono = publish **error**); warn if duration > 2 min.
- Narration: mono 96 kbps default; stereo 128 kbps **only** when the version has linked characters; narrator-only stereo = warning. **Narrator always center and close; no character dead center.**
- Safe sounds: walker checklist on upload; `TRANSIENT` warning for sharp peaks; wildlife rules unchanged.
- Directing for walking ears: paste guidelines from the Nov 23 review doc into §6 as production guidance (docs only).
- Breath points / swell cues on versions; Back = 10 s.

### §7 Budgets
Region ambience library ≤40 MB — publish **warning** when over (not only a doc target).

### §8 Simulator
Extend with depth bloom readout, beacon pan/gain, motif and resolve on the timeline, breath markers on the narration waveform, locked-teaser trigger, beacons toggle.

### §2.3 / ducking
Unchanged unless resolve/motif need the `ui` or a `moment` bus — **gap:** bus for motif/resolve (propose `ui` at −6 dB).

---

## Proposed DATA_MODEL text (plan for Claude)

- §3 `audio_assets`: `safe_for_walkers_checked`, crest/onset metric column.
- §4 `groves.depth_bloom_texture_m`; `fragments` beacon / resolve / teaser_locked FKs; `revision_versions.breath_points_ms` / `swell_cues_ms`; new `grove_sound_cues`.
- §6 `music_cues` resolve_* FKs; note stem ≤4 at publish; growth via `conditions.heardAll`.
- §11–12 snapshots and packs: list new optional camelCase fields; schema numbers stay 4 / 2.
- Device settings (wherever Settings are documented): `beaconsEnabled` default true.

---

## Part 2 — Admin screens and Simulator

Build only after Part 1 merges. Routes under `apps/admin` (shadcn, ServerActionForm, design tokens).

### Screens

| Route | Purpose |
|---|---|
| `/sound/profiles` | Ambience profiles + Day/Night layers; density; audition |
| `/sound/profiles/[id]/layers/[layerId]` | Gain/pan/pitch ranges, intervals, months, wildlife, asset weights, bed stereo check |
| `/sound/zones` | Ambience + music zone polygons (Terra Draw), priority, edge fade |
| `/sound/landcover` | Grid upload + H3 overlay (tools/landcover already exists) |
| `/sound/music` | Zones/cues list; condition builder including `heardAll` (“after this fragment”), `minDepthM`, `insideTierBuffer` |
| `/sound/music/cues/[id]` | Stems (≤4), loop points, state_gains, resolve assets per tier, growth step ordering |
| `/sound/groves/[groveId]/cues` | Threshold motifs day/night; default beacons per tier; depth bloom texture override |
| Fragment / revision editors (extend existing) | Beacon, resolve override, locked teaser asset; breath/swell on waveform |
| `/media/audio` (extend) | Safe-walker checklist; auto `suggestBreathPoints`; TRANSIENT/crest display |
| `/simulate/[groveId]` | Listening Simulator |

### Simulator layout (§8 + features)

One composition: map (walker pin, radii, zones, H3, buffer circles for depth bloom) + right rail:
- Story state: completed toggles, Day/Night, month, headphones/speaker, **beacons on/off**
- Live: profile weights, oneshot timeline (cap 2), music cue/stems, depth m, buffer flags, beacon target/pan/gain, motif/resolve/teaser events, Hush countdowns, bus meters mute/solo
- GPX replay 1× / 4×
- Breath markers on the active narration bar

Web Audio `AudioEngine` in admin implements the shared `AudioEngine` interface (types in shared); M3c N3 loudness worker reused for upload analysis + crest.

### Part 2 tests
Simulator unit/integration: depth latch, beacon choose/mix, motif once, breath suggest+edit, locked teaser once/day, timeline asserts each feature fires. Playwright smoke if the suite already covers admin maps — **gap:** whether to add Playwright now or defer to CI smoke only.

---

## Order of work

### Part 1 PR (`a/a5-sound-features` after plan approval)
1. Land approved AUDIO_SPEC v4 + DATA_MODEL edits (Claude-approved plan text).
2. Migrations + grants + types regen + seed/fixture columns as needed.
3. Zod: MusicCondition, StoryState, settings, pack optional fields; canonical-JSON pack builder tests.
4. Pure rules + tests (list above); extend `storyStateOf`; ambience oneshot cap 2.
5. `fn_publish_check` + SQL tests for each new code.
6. Report `docs/briefs/A5-report.md` (Part 1); push; stop for review.

### Part 2 PR (new branch from master after Part 1 merge)
1. Web Audio engine adapter in admin.
2. Sound admin screens (profiles → zones → music → grove cues → fragment fields).
3. Listening Simulator.
4. Upload checklist + breath waveform UX + loudness worker crest.
5. Report Part 2; BUILD_PLAN M4 acceptance + Simulator features; stop for review.

---

## Spec gaps (do not guess)

1. **TRANSIENT numeric thresholds** — proposed crest >12 dB; confirm with sound team.
2. **`GROWTH_STEPS_OVER_MAX` severity** — warning vs failure.
3. **`asset_kind` for resolves / motifs / beacons / locked teasers** — reuse `voice_cue` / `sfx_oneshot` / `music_stem` or extend the enum (enum change = migration + pack AssetKind).
4. **Bus for motif and resolve** — propose `ui`; confirm.
5. **`storyStateOf` without a fix** — depth conditions false vs depth 0.
6. **Mix shed/recover milliseconds** — Jordan approved order, not timings.
7. **`chooseBeacon` “unexplored”** — not completed for current contingency epoch (align with `completedEpoch`), confirm.
8. **Locked teaser “per day”** — device-local midnight vs UTC.
9. **Music growth “up to 4 steps”** — count only cues that use `heardAll` non-empty, or all grove cues per window?
10. **Part 2 Playwright** — required for accept or unit/Simulator tests enough?
11. **M4a A1 schema-bump note vs this plan’s no-bump decision** — Claude to confirm optional-on-4/2 is accepted.
12. **Stereo narration “linked characters”** — characters on the fragment vs on that revision version only?

---

## Accept (from brief; checked at report time)

- [ ] `pnpm lint`, `typecheck`, `test` + CI green  
- [ ] Every decided value is a named constant or data field (listed in the report)  
- [ ] Installed phone builds still parse packs (optional fields / sequencing note)  
- [ ] Part 2 meets BUILD_PLAN M4 + Simulator features  

Stop here for Claude’s plan review.
