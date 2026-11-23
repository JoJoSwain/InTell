# M4a plan — shared story and sound logic

Lane A · M4a. Plan only. No module code in this commit.

Pure functions in `packages/shared`, injected clock and seeded RNG, no I/O. Consumers are M4b (Listening Simulator), M5b (map markers), and M6–M7 (session and sound). `unlock.ts` is first because M5b is blocked on it.

Existing code stays. `story/contingency.ts` (`contingencyRevisionNo`, `completionSatisfiesContingency`), `time/timeWindow.ts`, `audio/seededRng.ts`, `audio/DuckingPolicy.ts` (`AFTERGLOW_MS` = 8 s), and the M1 `OneShotWindowScheduler` are reused. This milestone does not change their behavior except where a new `timeWindow` test exposes a bug, which gets reported before any edit.

Out of this plan: admin sound UI, the Simulator, the Web Audio engine, M3h V1/V2, the M3c N3 loudness worker, anything under `apps/` or `supabase/`, and the CI `expo export` job. The AUDIO_SPEC §9 bullets under "Engine (device tests)" are M7/M12, not M4a.

---

## Order of work

1. `src/geo/polygon.ts` — point-in-polygon and distance-to-boundary. Trigger, ambience, and music all need it. No new dependency (see ambiguity G1).
2. `src/story/unlock.ts` — groups, contingency, marker state, Chronicle replay.
3. `src/time/timeWindow.test.ts` — extra dates and latitudes against the current function. No behavior edit unless a test fails the spec, in which case stop and report.
4. `src/story/trigger.ts` — fixes, scan, accessible trigger, queue of one. Calls the unlock predicates.
5. `src/audio/music.ts` — cue selection, hysteresis, stem gains.
6. `src/audio/ambience.ts` — profile blend, layer filters, beds, one-shots. Uses `seededRng`. Does not rewrite `oneshotSchedule.ts` (see A6).
7. `src/audio/hush.ts` — phase schedule. Uses `seededRng` and `AFTERGLOW_MS` only as a documented neighbor, not as hush timing.
8. Export every new function and type from `src/index.ts`.

Each step lands with its tests. `pnpm --filter @intell/shared test` stays green after each one. Full `pnpm lint && pnpm typecheck && pnpm test` at the end of implementation, not in this plan commit.

---

## Shared input shapes

Device rows are plain objects the phone or the Simulator passes in. Nothing here reads SQLite or the network.

```ts
type TimeWindow = "day" | "night";

type CompletionRow = {
  fragmentId: string;
  revisionNo: number;
  timeWindow: TimeWindow;
  onSite: boolean;
};

type UnlockRow = { fragmentId: string };

type FragmentInput = {
  id: string;
  groveId: string;
  tier: "root" | "branch" | "leaf";
  visibility: "standard" | "physical";
  retired: boolean;
  lat: number;
  lng: number;
  /** Metres. Physical fragments omit it. */
  radiusM?: number;
  /** AND of OR groups. Pack field `requires`. */
  requires: string[][];
  threadIds: string[];
  /** Pack field `revisions[0].contingencyRevisionNo` (the current revision). */
  contingencyRevisionNo: number;
  versions: { lang: string; timeWindow: TimeWindow }[];
};

type ExternalPrerequisite = {
  fragmentId: string;
  groveId: string;
  contingencyRevisionNo: number;
};

type LocationFix = {
  at: Date;
  lat: number;
  lng: number;
  accuracyM: number;
};
```

`FragmentInput` is assembled from a `GrovePack` fragment plus its current revision. `ExternalPrerequisite` is the pack's `externalPrerequisites` entry. `CompletionRow` / `UnlockRow` are the device tables in DATA_MODEL §14 (`completions`, `unlocks`). `progress` is display-only and is not an input.

A member id that is in neither the loaded fragments nor `externalPrerequisites` is never completed (ADR 0003 §5).

---

## `story/unlock.ts`

### Signatures

```ts
function memberSatisfied(
  memberId: string,
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
  completions: readonly CompletionRow[],
): boolean;

function isUnlocked(
  fragment: FragmentInput,
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
  completions: readonly CompletionRow[],
  unlocks: readonly UnlockRow[],
): { unlocked: boolean; shouldWriteUnlock: boolean };

function markerState(input: {
  fragment: FragmentInput;
  fragments: readonly FragmentInput[];
  external: readonly ExternalPrerequisite[];
  completions: readonly CompletionRow[];
  unlocks: readonly UnlockRow[];
  timeWindow: TimeWindow;
  lang: string;
}): {
  opacity: 1 | 0.35 | 0;
  playableNow: boolean;
  pulse: boolean;
  hidden: boolean;
};

function chronicleReplay(
  fragment: FragmentInput,
  completions: readonly CompletionRow[],
  window: TimeWindow,
): boolean;
```

### Where each field comes from

| Input | Source |
|---|---|
| `requires`, `tier`, `visibility`, `retired`, `lat`, `lng`, `radiusM`, `threadIds` | Grove pack fragment |
| `contingencyRevisionNo`, `versions[].timeWindow`, `versions[].lang` | Current revision on that fragment (`revisions` has one entry) |
| `external[].contingencyRevisionNo` | Grove pack `externalPrerequisites` |
| `completions` | Device table. `onSite` is the `on_site` column. Any `timeWindow` satisfies a prerequisite (FR-2) |
| `unlocks` | Device table. Written the first time groups are satisfied, never removed |
| `timeWindow` | `currentTimeWindow` at the region `sunReference` |
| `lang` | Device UI language. Match is exact (see U4) |

### Rules

- A group is satisfied when any member is. A fragment is satisfied now when every group is. No groups means unlocked from the start (FR-2).
- A member is satisfied when some completion has `revisionNo >= contingencyRevisionNo` for that member. The epoch comes from the member's own current revision when the member is loaded, otherwise from `externalPrerequisites`. `completionSatisfiesContingency` is the comparison.
- `isUnlocked` is true when an `unlocks` row exists **or** the groups are satisfied now. `shouldWriteUnlock` is true only in the second case when no row exists yet. An existing row stays true even if a later contingency makes a prerequisite unsatisfied (revealed stays revealed, ADR 0004 §13).
- `playableNow`: unlocked, not retired, a version exists for `timeWindow` + `lang`, and no completion satisfies the current contingency epoch. Opacity 1.
- Locked, or no version for the window: opacity 0.35, `playableNow` false. Retired: `hidden`, opacity 0 (ADR 0004 §10).
- `pulse`: the listener has a completion that does **not** satisfy the current epoch (they heard an older contingency) and does not have one that does. First-time fragments do not pulse (ADR 0005 §3). The change teaser string stays on the pack; this function only returns the flag.
- `chronicleReplay`: some `onSite` completion has `timeWindow === window` and `revisionNo >= contingencyRevisionNo`. Off-site rows do not count. Day and Night are separate (ADR 0004 §16).

### Tests (DATA_MODEL §14, ADR 0004 §10 §13 §16, ADR 0005 §3)

| Case | Spec |
|---|---|
| No groups → unlocked, `shouldWriteUnlock` | FR-2, §14 "no groups" |
| AND of groups, OR inside a group; one OR member is enough | §14, ADR 0003 §2 |
| Completion of revision 2 satisfies epoch 1; revision 1 does not satisfy epoch 3 | §14 contingency, `contingency.test.ts` already covers the epoch math |
| Correction (revision 4, epoch 3) still satisfies | ADR 0004 §13 |
| Either Day or Night completion satisfies the member | FR-2 "any time version" |
| Member only in `externalPrerequisites` uses that epoch | §14 |
| Member in neither list is never satisfied | ADR 0003 §5 |
| `unlocks` row keeps the fragment unlocked after a prerequisite contingency | §14 "never removed", ADR 0004 §13 |
| `shouldWriteUnlock` is false when the row already exists, and false while any group is open | §14 |
| Empty group never satisfies (publish forbids it; still locked without an unlocks row) | DATA_MODEL checklist `EMPTY_PREREQ_GROUP` |
| Playable now → opacity 1; locked → 0.35; out of window → 0.35; retired → hidden | ADR 0004 §10, brief |
| Completed current epoch is not `playableNow` | brief definition |
| Older completion and no current-epoch completion → `pulse`; never-heard fragment does not pulse | ADR 0005 §3 |
| On-site Day completion of the current epoch replays Day only; Night does not; off-site row does not replay | ADR 0004 §16, §14 |
| Completion of a revision below the current epoch does not replay | ADR 0004 §16 |

---

## `time/timeWindow.ts`

No signature change. `currentTimeWindow(at, sunReference, timeZone)` stays. Day is sunrise inclusive through sunset exclusive. Polar fallback is 06:00 inclusive through 18:00 exclusive, local.

New tests, all against the current function:

| Case | Spec §9 |
|---|---|
| Several mid-latitude dates: summer noon day, summer midnight night, winter noon day, winter evening night (Wasatch, `America/Denver`) | "several dates and latitudes" |
| Exact sunrise → day; one millisecond before sunrise → night; exact sunset → night | "sunrise and sunset" |
| Southern hemisphere winter and summer (fixture lat/lng, its timezone) | "latitudes" |
| Equator, local noon and local midnight | "latitudes" |
| Polar `alwaysUp` / `alwaysDown`: 05:59 local night, 06:00 local day, 17:59 day, 18:00 night, in a non-UTC timezone | "polar fallback 06:00–18:00" |

If a new test disagrees with the function, report it. Do not retune `suncalc` inside this milestone unless Claude says the spec wins.

---

## `story/trigger.ts`

### Signatures

```ts
type TriggerCandidate = {
  fragment: FragmentInput;
  distanceM: number;
  via: "proximity" | "accessible" | "scan";
};

function proximityCandidates(input: {
  fragments: readonly FragmentInput[];
  fixes: readonly LocationFix[];
  now: Date;
  accuracyToleranceM: number;
  unlockedIds: ReadonlySet<string>;
  completedEpochIds: ReadonlySet<string>;
  timeWindow: TimeWindow;
  lang: string;
  accessible: boolean;
}): TriggerCandidate[];

function chooseTrigger(candidates: readonly TriggerCandidate[]): TriggerCandidate | null;

function queueAfterTrigger(input: {
  chosen: TriggerCandidate | null;
  playingFragmentId: string | null;
  queued: { fragmentId: string; via: "proximity" | "accessible" | "scan" } | null;
  afterglowEndsAt: Date | null;
  now: Date;
  stillInRange: (fragmentId: string) => boolean;
}): {
  startNow: string | null;
  queued: { fragmentId: string; via: "proximity" | "accessible" | "scan" } | null;
};
```

`unlockedIds` and `completedEpochIds` come from `isUnlocked` and the completion epoch check, so trigger does not reimplement groups. `stillInRange` is a caller predicate (the phone has the latest fix). `afterglowEndsAt` is the narration end plus `AFTERGLOW_MS`.

### Rules

- Physical fragments never enter `proximityCandidates` (FR-4, ADR 0004 §9).
- A fix counts only when `accuracyM <= accuracyToleranceM`. There is no baked-in default; M6 passes the tuned value. Tests pass an explicit number.
- Two counted fixes for the same fragment, both inside `radiusM` of its point, the later within 60 s of the earlier. A fix outside the radius or over tolerance breaks that fragment's streak. Accessible mode, when `accessible` is true, uses one counted fix within `feetToMeters(35)` of the point and ignores a smaller authored radius. Still standard-only, still requires a version for the window, still requires unlocked and not completed for the epoch (FR-7, ADR 0004 §28).
- Eligible means unlocked, not retired, a version for `timeWindow` + `lang`, and not completed for the current epoch.
- `chooseTrigger`: Root, then Branch, then Leaf, then smallest `distanceM`. Tie on tier and distance: lower `id` (see T1).
- Scan is a separate entry, `scanDecision(fragment, unlocked, hasVersion)`, not a location path. Unlocked and in window → it may play. Otherwise the caller shows the teaser. A scan does not check GPS (ADR 0004 §9).
- Queue of one (PRODUCT_SPEC §5.1.5). Nothing playing and nothing in afterglow → `startNow`. Otherwise the candidate waits. After `afterglowEndsAt`, a proximity or accessible queued id starts only if `stillInRange`. A scan starts anyway. The queued slot holds one id (see T2).

### Tests (PRODUCT_SPEC §5.1, FR-3, FR-4, FR-7)

| Case | Spec |
|---|---|
| One fix inside the radius does not fire; a second within 60 s does | FR-3 |
| Second fix at 60 s fires; at 60 s + 1 ms does not | FR-3 |
| Accuracy over the parameter is ignored and breaks the streak | FR-3, brief |
| Physical fragment with two fixes inside a radius does not fire | FR-4 |
| Accessible off: one fix inside 35 ft but inside a smaller radius does not fire until the second | FR-7 |
| Accessible on: one accurate fix within 35 ft of the point fires; beyond 35 ft does not; physical still does not | FR-7 |
| Locked, out of window, retired, or already completed for the epoch does not fire | brief, FR-6 |
| Two candidates: Root beats nearer Leaf; same tier, nearer wins | §5.1.5 |
| While one plays, the next waits; before afterglow ends, `startNow` is null | §5.1.5 |
| After afterglow, proximity starts only if still in range; scan starts after leaving | §5.1.5 |
| Scan of a locked or out-of-window fragment does not play | FR-4, §5.1.3 |

---

## `audio/music.ts`

### Signatures

```ts
type MusicCueInput = {
  id: string;
  timeWindow: TimeWindow;
  priority: number;
  conditions: MusicCondition;
  minDwellS: number;
  boundary: GeoJsonPolygon;
  edgeFadeM: number;
  stems: { assetSha: string; gainDb: number; stateGains: StemRulePack[] }[];
};

type MusicStoryState = {
  groveId?: string;
  playingFragmentId?: string;
  playingTier?: "root" | "branch" | "leaf";
  playingThreadIds: string[];
  lastFragmentId?: string;
  lastTier?: "root" | "branch" | "leaf";
  lastThreadIds: string[];
  /** Fragment ids completed for their latest contingency. */
  heard: ReadonlySet<string>;
  timeWindow: TimeWindow;
  narrationPlaying: boolean;
};

function selectMusicCue(input: {
  cues: readonly MusicCueInput[];
  point: { lat: number; lng: number };
  story: MusicStoryState;
  current: { cueId: string; startedAt: Date } | null;
  now: Date;
}): {
  cue: MusicCueInput | null;
  edgeGain: number;
  crossfadeMs: number;
};

function stemGainDb(stem: MusicCueInput["stems"][number], story: MusicStoryState): number;
```

### Where each field comes from

| Input | Source |
|---|---|
| Cue `timeWindow`, `priority`, `conditions`, `minDwellS`, `crossfadeMs`, stems | Grove pack `music.cues` or region pack `musicCues` |
| `boundary`, `edgeFadeM` | The cue's music zone, or the grove boundary when `useGroveBoundary` (see M3) |
| `conditions` | Existing `MusicCondition` (threadIds, tiers, heardAll, heardAny, notHeard, narrationPlaying). Empty object matches |
| `heard`, last fragment, last tier, last threads | Device completions (epoch-satisfied) and the session |
| `playingThreadIds`, `playingTier` | The fragment that is playing, when `narrationPlaying` |

`timeWindow` is not a condition. Cues whose window is not current are dropped before conditions run (AUDIO_SPEC §4.2).

### Rules

- A cue is a candidate when its window matches, its conditions match, and the point is inside `boundary`.
- Conditions are AND of the keys that are present. `threadIds` matches if any id is in `lastThreadIds` or `playingThreadIds`. `tiers` matches `playingTier` while narration is playing, otherwise `lastTier`. `heardAll` / `heardAny` / `notHeard` use `heard`. `narrationPlaying` matches the boolean when the key is present.
- Highest `priority` wins. Keep the current cue when it is still a candidate and `now - startedAt < minDwellS`. After dwell, keep it when its priority equals the best (see M1).
- `edgeGain = clamp(distanceInside / edgeFadeM, 0, 1)`. Outside every cue, the result is null and the engine plays silence.
- `stemGainDb`: see M2. First matching `stateGains` rule wins; later rules are ignored.

### Tests (AUDIO_SPEC §9 music bullets)

| Case | Spec |
|---|---|
| Empty conditions match | §4.2 |
| `heardAll` fails when one id is missing; `heardAny` passes on one; `notHeard` fails when one is heard | §4.2 |
| `threadIds` matches `lastThreadIds` and, separately, the playing fragment's threads | §4.2 |
| `narrationPlaying: true` fails while idle | §4.2 |
| Day cue dropped at night even if conditions match | §4.2 |
| Point outside every boundary → null | §4.3 silence |
| Higher priority wins over a lower one that also contains the point | §4.3 |
| Current cue kept before `minDwellS` even if a higher priority appears; replaced after dwell | §4.3 hysteresis |
| Equal priority does not replace the current cue | §4.3 |
| `edgeGain` is 1 deeper than `edgeFadeM` inside, 0 at the boundary | §4.3 |
| Stem with no matching rule uses `gainDb`; first matching rule wins over a later one | §4.3, pending M2 |

---

## `audio/ambience.ts`

### Signatures

```ts
type AmbienceLayerInput = {
  id: string;
  kind: "bed" | "oneshot";
  timeWindow: TimeWindow;
  months: number[];
  wildlifeCall: boolean;
  nestingMuteMonths: number[];
  speakerSafe: boolean;
  gainDbMin: number;
  gainDbMax: number;
  noRepeatLast: number;
  crossfadeMs: number;
  meanIntervalS?: number;
  minIntervalS?: number;
  maxConcurrent?: number;
  assets: { sha: string; weight: number }[];
};

type AmbienceProfileInput = {
  slug: string;
  density: number;
  layers: readonly AmbienceLayerInput[];
};

type AmbienceZoneInput = {
  id: string;
  boundary: GeoJsonPolygon;
  profileSlug: string;
  priority: number;
  edgeFadeM: number;
};

function activeProfiles(input: {
  zones: readonly AmbienceZoneInput[];
  point: { lat: number; lng: number };
  /** Class code for the H3 cell and each of its 6 neighbors, center first. Null if the grid has no cell. */
  landcoverCells: readonly (string | null)[];
  classToProfile: ReadonlyMap<string, string>;
}): { profileSlug: string; weight: number }[];

function eligibleLayers(input: {
  profile: AmbienceProfileInput;
  weight: number;
  timeWindow: TimeWindow;
  month: number;
  route: "speaker" | "headphones";
  /** True when any grove containing the listener has allowsSpeakerWildlifeSounds false. */
  muteAllSurroundingsOnSpeaker: boolean;
  hushActive: boolean;
}): AmbienceLayerInput[];

function pickBed(input: {
  layer: AmbienceLayerInput;
  profileWeight: number;
  recentShas: readonly string[];
  rng: SeededRng;
}): { sha: string; gainDb: number } | null;

function nextOneShot(input: {
  layer: AmbienceLayerInput;
  profileWeight: number;
  density: number;
  nowSec: number;
  recentShas: readonly string[];
  concurrent: number;
  narrationPlaying: boolean;
  narrationStartedAtSec: number | null;
  narrationEndsAtSec: number | null;
  lastOneShotAtSec: number | null;
  rng: SeededRng;
}): { sha: string; atSec: number; gainDb: number; pan: number; rate: number } | null;
```

### Where each field comes from

| Input | Source |
|---|---|
| Zone boundary, `profileSlug`, `priority`, `edgeFadeM` | Region pack `ambienceZones` |
| Profile `slug`, `density` | Region snapshot has `density`; the current region pack omits it (see A1) |
| Layer window, wildlife, speaker, assets | Region pack layer |
| `months`, `nestingMuteMonths`, gain range, intervals, `noRepeatLast`, `crossfadeMs`, asset `weight` | SQL `ambience_layers` / `ambience_layer_assets`. Not on today's `RegionPack` (see A1) |
| `landcoverCells`, `classToProfile` | Caller. The pack stores `gridSha` and `classes`, not the cell map. M4a does not fetch or decode the grid |
| `month`, `timeWindow` | Injected clock in the region timezone; `currentTimeWindow` |
| `muteAllSurroundingsOnSpeaker` | Grove pack `allowsSpeakerWildlifeSounds` for groves containing the point |
| `hushActive` | `hush.ts` |
| `route` | Session |

### Rules

- Zones containing the point only. `weight = clamp(distanceInside / edgeFadeM, 0, 1)` (see A2). Sort priority descending, tie-break `id` ascending.
- Top zone weight `w`. If `w < 1`, the other entry is the next containing zone, else the landcover profile, with weight `1 - w`. At most two entries. If nothing contains the point, one landcover entry at weight 1, or none when the grid misses.
- Landcover class is the majority of the center cell plus six neighbors. A tie goes to the center cell's class (see A3).
- Filters, in order: wrong `timeWindow`; month not in `months`; `wildlifeCall` during `nestingMuteMonths`; on speaker, `wildlifeCall` or not `speakerSafe`; `muteAllSurroundingsOnSpeaker`; `hushActive` skips every layer.
- Bed: weighted pick among assets, excluding the last `noRepeatLast` shas when alternatives remain. Gain is uniform between min and max, times profile weight, via the seeded RNG.
- One-shot: `nextAt = now + max(minIntervalS, exponential(meanIntervalS / (density * weight)))`. Fire only when `concurrent < maxConcurrent`. While narration plays, at most one one-shot across layers per 4 s, and none in the 1.5 s after narration starts or the 1.5 s before it ends. The "across layers" cap is the caller's `lastOneShotAtSec`.

### Tests (AUDIO_SPEC §9 ambience bullets)

| Case | Spec |
|---|---|
| Deep inside the top zone → one profile, weight 1 | §3.1 |
| Inside the fade band → top zone plus next zone, weights sum to 1 | §3.1 |
| Fade band with no second zone → remainder is landcover | §3.1 |
| No zone → landcover at weight 1; missing grid → empty | §3.1 |
| Majority of 7 cells; center wins a 3–3 tie | §3.1 |
| Wrong window, wrong month, nesting month, wildlife on speaker, non-speaker-safe on speaker, grove mute, hush | §3.2 |
| Headphones still play wildlife and non-speaker-safe | §3.2 |
| Bed avoids the last `noRepeatLast` shas; gain stays inside min/max times weight | §3.3 |
| One-shot respects min interval, mean, density, weight, and `maxConcurrent` | §3.4 |
| Same seed → same picks | §9 "seeded RNG" |
| Narration: 1.5 s guard at both ends; no two one-shots closer than 4 s | §3.4 |

---

## `audio/hush.ts`

### Signature

```ts
type HushPhase = "idle" | "fadingOut" | "cue" | "holding" | "fadingIn";

function hushStep(input: {
  settingOn: boolean;
  insideGrove: boolean;
  narrationPlaying: boolean;
  queuedFragment: boolean;
  lastNarrationEndedAt: Date | null;
  now: Date;
  phase: HushPhase;
  phaseStartedAt: Date | null;
  /** Minutes. Default the caller passes is 7. */
  intervalMin: number;
  /** Seeded, so the ±2 minutes and the 60–90 s hold are repeatable. */
  rng: SeededRng;
  triggerArrived: boolean;
}): {
  phase: HushPhase;
  fadeMs: number;
  playCue: boolean;
};
```

### Rules

- Start only when the setting is on, the listener is inside a grove, narration is not playing, nothing is queued, and the draw `intervalMin + random(-2..+2)` minutes has passed since `lastNarrationEndedAt` (or since session start if none).
- Fade music and surroundings to silence over 4 s (`fadingOut`), wait 1 s (`cue`, `playCue` true), hold a seeded 60–90 s (`holding`), fade back over 6 s (`fadingIn`), then `idle`.
- `triggerArrived` from any phase returns `fadingIn` with `fadeMs` 1000, then idle. Hush does not start during narration or while a fragment is queued.
- The function does not choose the cue asset. The caller plays the region pack `uiCues` entry with key `hush_listen`.

### Tests (AUDIO_SPEC §9 hush bullets)

| Case | Spec |
|---|---|
| Setting off, or outside every grove → stays idle | §5 |
| Narration playing, or a fragment queued → does not start | §5 |
| Starts once the seeded interval has elapsed with no narration | §5 |
| Phase order and durations: 4 s out, 1 s to the cue, hold in 60–90 s, 6 s back | §5 |
| Same seed → same interval offset and same hold | §5 |
| A trigger during hold requests a 1 s return | §5 |

---

## `geo/polygon.ts`

```ts
function pointInPolygon(point: { lat: number; lng: number }, polygon: GeoJsonPolygon): boolean;
function distanceInsideMeters(point: { lat: number; lng: number }, polygon: GeoJsonPolygon): number;
```

Ray cast for inclusion. Distance is metres from an interior point to the nearest edge, using an equirectangular projection around the point. Exterior points return 0 from `distanceInsideMeters`. Holes in the GeoJSON polygon count as outside. Tests: square contains its center, rejects a point outside, a point on the edge is inside, a hole rejects, distance is about 0 at the edge and grows inward.

---

## Spec ambiguities

Proposed answers. Claude decides. Nothing below is implemented until then.

**U1. Completed fragment, in its window.** The brief defines `playableNow` as not completed for the latest contingency. ADR 0004 §10 only names 100% and 35%. Proposed: `playableNow` false, opacity 1, `pulse` false. Out of window stays 0.35. M5b designs any further completed-marker treatment.

**U2. Pulse while out of window.** ADR 0005 §3 says pulse until the new version is heard in situ, and a tap shows the change teaser. Proposed: pulse even at 0.35. Hearing still waits for the window.

**U3. Empty prerequisite group.** Publish rejects it. Proposed: the group is unsatisfied, so the fragment stays locked unless an `unlocks` row exists.

**U4. Language.** Packs can carry `lang` on a version. The spec never says what happens when the device language has no version. Content is English only. Proposed: exact `lang` match, no fallback. Missing version means not playable (same as out of window).

**T1. Same tier, same distance.** Proposed: lower fragment `id` wins, so the choice is stable.

**T2. Queue replacement.** The spec says a queue of one and does not say whether a newer trigger replaces it. Proposed: the first proximity candidate keeps the slot until it starts or leaves range. A scan replaces whatever is waiting, because a qualified scan always plays.

**T3. "Consecutive" fixes.** Proposed: the last two accuracy-qualified fixes for that fragment, both inside the radius, no rejected fix for that fragment between them, newer minus older ≤ 60 s.

**T4. Scan versus "always plays".** §5.1.5 says a scanned fragment always plays. FR-4 and §5.1.3 say prerequisites and the time window still apply. Proposed: the scan qualifies only when unlocked and a version exists for the window. "Always" means the queue does not re-check range later.

**T5. Accuracy default.** FR-3 leaves the tolerance to M6. Proposed: the parameter is required. Tests use 10 as a fixture and the constant is not exported as a product default.

**M1. Hysteresis versus a louder cue.** §4.3 says keep the current cue while it is still a candidate and has played for less than `min_dwell_s`, or when its priority equals the best. Proposed: before dwell, keep it even against a higher priority. After dwell, a strictly higher priority replaces it. Equal priority never replaces it.

**M2. Stem gain.** §4.3 says "gain = gainDb plus the first matching rule". The example says a strings stem defaults to -60 and fades up while a Branch plays, with a rule `gain_db: 0`. Adding 0 to -60 does not fade up. Proposed: no matching rule → stem `gainDb` (the resting level, -60 in the example). First matching rule → that rule's `gainDb` replaces the resting level (0 while a Branch plays). This follows the example and the "fades up" sentence. Tests will be written to this reading if Claude agrees; they will be written to the sum if Claude prefers the word "plus".

**M3. Grove-boundary edge fade.** Music zones carry `edgeFadeM`. A cue with `useGroveBoundary` has no fade of its own. Proposed: the caller passes the grove boundary and a fade of 60 m (the SQL default for music zones) until a pack field exists.

**M4. `tiers` and `threadIds` while a fragment is playing.** `StoryState` in the spec lists `lastTier` and `lastThreadIds` only. The thread sentence also names the playing fragment's threads. Proposed: the input adds `playingTier` and `playingThreadIds`, used only while `narrationPlaying`.

**M5. Empty condition arrays.** Proposed: `heardAll: []` matches, `heardAny: []` does not, `notHeard: []` matches.

**A1. Pack fields the scheduler needs and the pack does not carry.** `RegionPack` layers have id, name, kind, time window, wildlife, speaker, and asset shas. SQL also has months, nesting months, gain range, pan range, intervals, `no_repeat_last`, `crossfade_ms`, asset weight, and profile `density`. The landcover grid is a file (`gridSha`), not cells. Proposed: M4a defines its own input types with the SQL fields and does not change `RegionPack` or the builder. Tests construct those inputs directly. The Simulator and the phone cannot fill the missing fields until a later brief extends the pack. Widening the zod schema here would make current region packs fail to parse.

**A2. `distanceToEdge`.** The weight formula does not say which side of the boundary. Proposed: distance from an interior point to the nearest edge, in metres. Weight is 1 when that distance is at least `edgeFadeM`, and 0 on the boundary. Points outside the zone are not candidates.

**A3. Landcover ties, and the second profile's own fade.** Proposed: majority of the seven cells; the center cell wins a tie. The remainder weight `1 - w` goes entirely to the second entry. The second zone's own edge weight is not applied again. At most two entries.

**A4. Overlapping groves and the speaker mute.** Proposed: if any grove containing the listener has `allowsSpeakerWildlifeSounds` false, skip every surroundings layer on the speaker. Wildlife and non-speaker-safe layers are skipped on the speaker regardless.

**A5. One-shot pan and rate.** §3.4's formula names the asset and the interval, not pan or rate. The M1 spike uses pan in [-1, 1] and rate in [0.9, 1.1]. Proposed: same ranges, drawn from the seeded RNG, so the Simulator has a number to play. Gain stays inside the layer min/max.

**A6. `oneshotSchedule.ts`.** The M1 class uses a fixed interval and a fixed gain. It cannot express the exponential draw, density, or the narration guards. Proposed: leave it untouched. `ambience.ts` implements §3.4 with `seededRng`.

**H1. Hush interval draw.** Proposed: integer minutes, inclusive, uniform in `[intervalMin - 2, intervalMin + 2]`, from the seeded RNG. Hold is an integer second, inclusive, uniform in `[60, 90]`.

**H2. "None is pending".** Proposed: a queued fragment counts as pending. Afterglow does not, because narration has ended and the queue slot is empty. Hush may start during afterglow only when nothing is queued.

**G1. Geometry dependency.** `packages/shared` has no polygon library. Proposed: the two functions in `geo/polygon.ts`, no new package. Adding `h3-js` is not required because the caller passes the seven class codes.

**G2. Device-test bullets in AUDIO_SPEC §9.** Lock-screen playback, interruption, speaker routing, and the 60-minute session are engine tests. They are not functions in this milestone.
