# A6 plan — AudioDirector (M7 shared logic)

**Lane A · A6** · branch `a/a6-audio-director` · plan only; **no product code until Claude approves**.

Sources: `docs/briefs/A6-audio-director.md`, AUDIO_SPEC v4, TECH_SPEC §3.1–3.2, ADR 0001 Findings, A4 `story/session.ts`, A5 rules under `packages/shared/src/audio/*`, admin harness `apps/admin/src/lib/simulate/harness.ts`.

**Out of scope (brief):** phone wiring (Lane B M6/M7), engine streaming implementation, Chronicle/Journal audio, analytics. **Lane A never edits `apps/mobile`.**

---

## 1. Exact types

All live in `packages/shared/src/audio/director.ts` (plus small helpers in sibling files if size warrants). Public API is re-exported from `@intell/shared` and documented in the module header for Lane B.

### 1.1 `DirectorWorld` (read-only pack + grove context)

Immutable for a step. Built by the Simulator from preview packs / demo world, and later by the phone from installed packs. No I/O.

```ts
type DirectorWorld = {
  groveId: string;
  timeZone: string;
  sunReference: { lat: number; lng: number };
  allowsSpeakerWildlife: boolean;
  hushIntervalMin: number;           // default 7 unless grove overrides
  depthBloomTextureM: number;
  fragments: DirectorFragment[];     // id, lat/lng, radiusM, tier, visibility,
                                     // beaconSha?, teaserLockedSha?, resolveSha?,
                                     // breathPointsMs?, narrationSha by timeWindow
  musicCues: MusicCueInput[];        // includes resolve_* shas on a narrow extension
  ambienceZones: AmbienceZoneInput[];
  ambienceProfiles: AmbienceProfileInput[];
  classToProfile: ReadonlyMap<string, string>;
  landcoverCellsAt: (point: LatLng) => (string | null)[]; // or precomputed cells + lookup
  motifDaySha?: string | null;
  motifNightSha?: string | null;
  groveBeaconByTier: Partial<Record<"root"|"branch"|"leaf", string>>; // sha
  engineCaps: {
    canStreamBeds: boolean;          // false until ADR 0001 / B·S2 says otherwise
    narrationDecodeHz: number;       // product default 24_000 (brief)
  };
};
```

`MusicCueInput` / ambience types stay as today. Resolve shas ride on a thin `DirectorMusicCue = MusicCueInput & { resolveRootSha?, resolveBranchSha?, resolveLeafSha? }` (same shape the harness already uses).

### 1.2 `DirectorState` (JSON-serializable, versioned)

```ts
type DirectorState = {
  v: 1;
  rngSeed: number;                   // session seed; advanced via SeededRng cursor
  rngCursor: number;                 // calls consumed (so resume is deterministic)
  audioClockSec: number;             // last seen audio-clock time
  wallAtMs: number;                  // last seen wall clock
  suspended: boolean;                // interruption began; no play commands until resume
  resumePointMs: number | null;      // narration seek target after interruption
  afterglowEndsAtMs: number | null;
  pendingGrowthCueId: string | null;
  currentCueId: string | null;
  cueStartedAtMs: number | null;
  depthBloomInside: boolean;
  bufferTiers: ("root"|"branch"|"leaf")[];
  hush: HushStateSerialized;         // Dates → epoch ms (see §3 / gap G2)
  motif: ThresholdMotifState;
  teaser: LockedTeaserState;
  mix: MixLevelState;
  oneshotByLayerId: Record<string, OneShotState>; // nextAtSec on audio clock
  pendingAccents: PendingAccent[];   // ≤2, each with whenSec ≤ now+20
  activeVoiceIds: string[];          // ids currently counted toward budget
  currentBeaconId: string | null;
  lastBeaconPan: number;
  lastOneShotAtSec: number | null;
  narration: {
    playing: boolean;
    fragmentId: string | null;
    sha: string | null;
    startedAtSec: number | null;
    endsAtSec: number | null;        // known duration when loaded
    positionMs: number;
    breathPointsMs: number[];
  };
  hushActive: boolean;               // derived cache: phase in fadingOut|cue|holding
  crossfading: boolean;              // true while a cue/bed crossfade window is open
  loadedShas: string[];              // director’s desired decode set (memory policy)
  lastEmitted: TargetMix;            // for diff (serializable)
  settings: DirectorSettings;        // last applied; also overridable by input
};
```

`parseDirectorState(raw): DirectorState` via zod (`v: z.literal(1)`, …). `initialDirectorState(seed, settings, dayKey)`.

`HushStateSerialized` mirrors `HushState` with `phaseStartedAt` / `nextHushAt` / `holdEndsAt` as `number | null` (epoch ms). Adapter at the hush call site converts to/from `Date` until hush itself is migrated (preferred: small additive change in `hush.ts` to accept epoch ms — **flag G2**).

### 1.3 `DirectorInput` (discriminated union)

Every input carries clocks so the reducer stays pure:

```ts
type ClockFields = { audioSec: number; wallAtMs: number };

type DirectorInput =
  | ({ type: "heartbeat" } & ClockFields)                 // ≤5 s audio-clock wake (brief)
  | ({ type: "story"; story: StoryState } & ClockFields)  // from storyStateOf
  | ({ type: "location"; point: LatLng; courseDeg: number | null;
       depthM: number | undefined; month: number;
       timeWindow: TimeWindow; insideGrove: boolean } & ClockFields)
  | ({ type: "settings"; settings: Partial<DirectorSettings> } & ClockFields)
  | ({ type: "sessionEffect"; effect: DirectorSessionEffect } & ClockFields)
  | ({ type: "voiceEnded"; voiceId: string; kind: VoiceKind } & ClockFields)
  | ({ type: "narrationProgress"; positionMs: number; durationMs: number } & ClockFields)
  | ({ type: "interruption"; phase: "began" | "ended";
       shouldResume?: boolean } & ClockFields)            // shouldResume from host (gap G4)
  | ({ type: "health"; clockStarving: boolean } & ClockFields);
```

`DirectorSessionEffect` is the audio-relevant subset of `SessionEffect`:

- `play` | `stopNarration` | `startAfterglow` | `groveEntered` | `showTeaser` | `sessionEnded`

Other session effects (`recordCompletion`, `analytics`, …) stay with the host; the director never sees them.

`DirectorSettings`:

```ts
type DirectorSettings = {
  busGainDb: Record<BusId, number>;  // user sliders; default 0 offset from BUS_DEFAULT
  hushOn: boolean;
  beaconsEnabled: boolean;
  chimeOn: boolean;                  // UI chime; no play until product defines asset (gap G7)
  route: AudioRoute;
  batterySaver: boolean;
  thermal: boolean;
};
```

### 1.4 `DirectorCommand` (declarative → `AudioEngine`)

Prefer commands that map 1:1 onto `AudioEngine` methods. Beacon / moment / bus are thin wrappers the host applies with existing APIs.

```ts
type DirectorCommand =
  | { type: "load"; sha: string; decodeHz?: number }      // host resolves uri; decodeHz hint
  | { type: "unload"; sha: string }
  | { type: "startLoopGroup"; id: string; bus: BusId; stems: {
        sha: string; gainDb: number; loopStartMs: number; loopEndMs: number;
      }[] }
  | { type: "crossfadeBed"; id: string; bus: BusId; fromId: string | null;
      toSha: string; gainDb: number; fadeMs: number;
      loopStartMs: number; loopEndMs: number }
  | { type: "setStemGain"; groupId: string; index: number; gainDb: number; rampMs: number }
  | { type: "setBusGain"; bus: BusId; gainDb: number; rampMs: number }
  | { type: "playOneShot"; id: string; sha: string; bus: BusId;
      gainDb: number; pan: number; rate: number; whenSec: number }
  | { type: "playMoment"; id: string; sha: string; gainDb: number }  // bus=moment
  | { type: "playNarration"; id: string; sha: string; meta: NowPlayingMeta;
      startAtMs?: number }
  | { type: "startBeacon"; id: string; sha: string; gainDb: number; pan: number;
      lowpassHz: number }
  | { type: "updateBeacon"; id: string; gainDb: number; pan: number; lowpassHz: number }
  | { type: "stopBeacon"; id: string; fadeMs: number }
  | { type: "stop"; id: string; fadeMs: number }
  | { type: "suspend" }
  | { type: "resume" };
```

Host mapping notes (no engine interface change required in A6 unless Claude wants them added):

- `playMoment` → `playOneShot(..., { bus: "moment", whenSec: now })`
- `startBeacon` / `updateBeacon` → looped oneshot or bed on `surroundings` + pan/gain ramps (host detail; director only emits intents)
- `setBusGain` → `engine.setGain(bus, …)`
- `suspend` / `resume` → host pauses graph / `AudioContext.suspend|resume` (engine today has narration pause/resume only — **gap G5**)

### 1.5 Reducer signature

```ts
function directorStep(
  state: DirectorState,
  input: DirectorInput,
  world: DirectorWorld,
): { state: DirectorState; commands: DirectorCommand[] };

function initialDirectorState(...): DirectorState;
function parseDirectorState(raw: unknown): DirectorState;
```

No clocks, timers, I/O, or `Math.random` inside. RNG only via seeded state.

---

## 2. Target-mix-and-diff design

Each step (after applying the input’s state transitions) builds a **`TargetMix`**, then diffs against `state.lastEmitted`.

### 2.1 `TargetMix`

```ts
type TargetMix = {
  busDb: Record<BusId, number>;
  busRampMs: Record<BusId, number>;       // attack vs release from DuckingPolicy
  music: null | {
    cueId: string;
    groupId: string;                      // stable id for the loop group
    stems: { sha: string; gainDb: number; loopStartMs: number; loopEndMs: number }[];
    crossfadeMs: number;                  // >0 ⇒ replace group with crossfade
    edgeGain: number;                     // applied into stem gains (foundation)
  };
  beds: { id: string; sha: string; gainDb: number; fadeMs: number;
          loopStartMs: number; loopEndMs: number }[];  // ≤2
  accentsPending: { id: string; sha: string; whenSec: number;
                    gainDb: number; pan: number; rate: number }[]; // ≤2, ≤ now+20
  beacon: null | { id: string; fragmentId: string; sha: string;
                   gainDb: number; pan: number; lowpassHz: number };
  narration: null | { id: string; sha: string; startAtMs?: number; meta: NowPlayingMeta };
  moment: null | { id: string; sha: string; gainDb: number }; // resolve or motif
  hushCue: null | { sha: string; gainDb: number };           // "Listen." on ui/story
  desiredLoaded: string[];                // memory policy output
  suspended: boolean;
};
```

### 2.2 Diff → commands

| Change | Commands |
|---|---|
| `suspended` false→true | `suspend`; suppress all start/play commands this step |
| true→false | `resume`; then apply remaining diffs |
| `desiredLoaded` add/remove | `load` / `unload` |
| busDb / ramp | `setBusGain` only when Δ > ε (0.1 dB) |
| music null→cue / cue change | `startLoopGroup` or stop + start with `crossfadeMs` |
| stem gain change | `setStemGain` (2 s ramp per AUDIO_SPEC §4.3) |
| bed set change | `crossfadeBed` / `stop` |
| new accent with `whenSec` | `playOneShot` (idempotent by `id`) |
| accent cancelled (hush / shed / suspend) | `stop` if already started; drop from pending |
| beacon identity / params | `startBeacon` / `updateBeacon` / `stopBeacon` |
| narration start/stop | `playNarration` / `stop` |
| moment oneshot | `playMoment` once (edge-triggered via state flags) |
| hush cue | oneshot on `ui` (or `story`) when `playCue` |

While `suspended`, diff emits **no** load/play/oneshot/beacon/moment commands (brief: no command while suspended). Unloads may still run if memory policy says so — **gap G6** (prefer: freeze loads too while suspended; only `suspend`/`resume`).

Idempotency: command `id`s are stable (`beacon:{fragmentId}`, `bed:{layerId}`, `accent:{seq}`, `narration:{fragmentId}:{revision}`, `moment:resolve:{fragmentId}`, `moment:motif:{visit}`). Re-emitting the same target produces zero commands.

---

## 3. Composing existing rules (and changes each needs)

Director **calls** these; it does not reimplement their math.

| Concern | Existing API | Director composition | Change needed? |
|---|---|---|---|
| Profile blend | `activeProfiles` | on `location` / `heartbeat` | No |
| Layer filters | `eligibleLayers` | after profiles; hush + route + month | No |
| Bed pick / gain | weighted pick + `scaleGainDb` (inline today in harness) | director owns bed switch on loop end via `voiceEnded` | Extract tiny `pickBedAsset` helper if missing — optional |
| Accents | `nextOneShot` | see §3.1 below | **Yes — look-ahead (G1)** |
| Breath gate | `accentAllowed` | before promoting a pending accent to command | No |
| Music select | `selectMusicCueDeferred` | story + afterglow + pending growth | Prefer epoch ms over `Date` in music API long-term (G2-adjacent); adapter OK for A6 |
| Stem gains | `stemGainDb` | every story/location tick; 2 s ramp | No |
| Depth / buffers | `depthConditionLatched`, `insideTierBuffersLatched` | on location | No |
| Duck / afterglow | `computeDuckingLevels`, `AFTERGLOW_MS` | narration \|\| afterglow → busDb; moment not held | No |
| Resolve | `pickResolve` | on `startAfterglow` effect → moment target | No |
| Growth deferral | `selectMusicCueDeferred` + harness bookkeeping | keep `pendingGrowthCueId` / `afterglowEndsAtMs` in director state | No |
| Hush | `hushStep` | heartbeat + trigger from `play` / location | **Serialize Dates (G2)** |
| Motif | `thresholdMotifStep` | `groveEntered`, ticks, narration start/end | No |
| Locked teaser | `lockedTeaserStep` | on `showTeaser` (never over narration) | No |
| Beacon | `chooseBeacon` + `beaconMix` | headphones only; off if narration or hush | Course from `location.courseDeg` (harness used `0`) |
| Voices | `allocateVoices` | build request list from TargetMix; deny → drop from mix before diff | No |
| Mix health | `mixLevelFor` + `shedLayers` | on `health` + settings battery/thermal; shed accents→beacon→extra stems→2nd bed→music; never narration | Heartbeat windows ≈5 s; shed-after-2 windows ≈10 s still holds |
| Interruptions | `resumePointMs` | began → suspend + stop fades; ended+shouldResume → resume narration at breath point | Host must pass `shouldResume` (G4) |
| Spike oneshot planner | `OneShotWindowScheduler` | **not** used for product accents (M1 spike only) | Keep for engine tests; director uses ambience `nextOneShot` + look-ahead layer |
| Decode LRU | `DecodedBufferLruAccounting` | engine-side; director only emits load/unload set | No |
| Loudness / container | n/a | out of director | — |

### 3.1 Accent look-ahead (brief §4)

Brief: cap 2 concurrent, **at most 2 pending**, **≤ 20 s ahead**, audio-clock scheduled, breath-gated, wildlife/speaker via `eligibleLayers`.

Today `nextOneShot` emits `atSec: nowSec` (immediate). A6 adds a thin director (or ambience) helper:

```ts
// proposed
fillAccentHorizon({ layers, ..., nowSec, horizonSec: 20, maxPending: 2, state, rng })
  → { state, pending: OneShotEvent[] }
```

Pending shots that fall outside a breath pause at fire-time are **dropped** (not shifted), matching “accents only in pauses.” Wildlife/speaker already excluded by eligibility.

**Gap G1:** confirm whether look-ahead belongs in `ambience.ts` (preferred, with unit tests) or only inside the director. Brief’s “oneshotSchedule (including B·S2's short look-ahead)” names a module that today is the M1 fixed-interval spike planner — product path is `nextOneShot`, not that class.

### 3.2 `voiceLedger`

Named in the brief; **no file exists**. A6 introduces `packages/shared/src/audio/voiceLedger.ts`: pure accounting of active `VoiceRequest`s + ids granted/denied, fed by start/end commands and `voiceEnded` inputs. `allocateVoices` stays the budget gate; the ledger is the durable set the director diffs against.

---

## 4. Time model

| Clock | Unit | Source | Used for |
|---|---|---|---|
| **Audio clock** | seconds (`audioSec`) | `AudioContext.currentTime` (admin) / engine clock (phone) | oneshot `whenSec`, bed/music alignment, accent horizon, narration start/end guards in `nextOneShot` |
| **Wall clock** | epoch ms (`wallAtMs`) | host `Date.now()` / GPX schedule | hush intervals, afterglow end, motif wait 30 s, mix recover 60 s, teaser day key, music dwell, session effect times |

Rules:

- Every `DirectorInput` carries both.
- Director never reads `Date.now()` or `performance.now()`.
- `heartbeat` is the only periodic wake: **audio-clock aligned ≤ 5 s** (AUDIO_SPEC §3.1 “at least every 5 s”; brief). Location fixes and session effects are event wakes.
- **Gap G3:** TECH_SPEC §3.1 still says “ticks every 1 s”. Plan follows the brief / AUDIO_SPEC **5 s**. Ask Claude to amend TECH_SPEC when A6 merges (docs are Claude-owned).

Suspend: audio clock may keep running in the engine while JS is paused (ADR 0001). On wake, host sends `heartbeat` with the true `audioSec`; pending accents with `whenSec < audioSec` are dropped (too late), not fired late.

---

## 5. Memory policy

Director computes `desiredLoaded` each step; host/`WebAudioEngine` perform decode + LRU.

1. **Always consider:** currently playing narration sha; current music stem shas; active bed shas; current beacon sha; pending accent shas; pending moment sha.
2. **Narration prefetch:** current fragment + the single nearest playable-unexplored fragment by distance (same candidate set as beacons). Unload every other narration sha.
3. **Decode hint:** `load` for narration includes `decodeHz: world.engineCaps.narrationDecodeHz` (brief: 24 kHz). Beds: if `canStreamBeds`, do not decode full PCM (host streams); else decode under engine LRU (96 MB spike cap remains engine-side until retuned).
4. **Failure:** missing/undecodable asset → host warns and stays silent (A5 P2b `tryLoad` behaviour); director does not crash; on `voiceEnded`/failed load the host may send a future `health` or we add `assetFailed` input later (**gap G8** — optional).

This follows the brief’s B·S2-oriented policy. **Gap G9:** no B·S2 results file is in this repo yet (only `BS1-audio-protocol.md`). Numbers (24 kHz, stream flag default false) are taken from the A6 brief; do not invent further caps.

---

## 6. Simulator → `directorStep`

1. Keep `SimulatorWorld` / demo world / pack loader (`worldFromPacks`) as the content source.
2. Map `SimulatorWorld` → `DirectorWorld` once per load (including `engineCaps: { canStreamBeds: false, narrationDecodeHz: 24_000 }`).
3. Replace the body of `simulatorTick` (or wrap it) so each tick:
   - translates the patch into one or more `DirectorInput`s (`location`, `settings`, `sessionEffect`, `narrationProgress`, `heartbeat`, …);
   - calls `directorStep` sequentially;
   - appends rail events derived from **commands + state** (preserve today’s `SimEvent` shapes so UI and harness tests stay stable);
   - returns harness-facing state mirrored from `DirectorState` (completed set still owned by the Simulator UI / session layer — director does not own unlocks).
4. UI already drives `WebAudioEngine` for real playback: add a small `applyDirectorCommands(engine, commands, urlBySha)` that performs the 1:1 mapping (including `tryLoad`).
5. **Harness tests** keep their assertions; they run through the director. Demo switch / empty-grove path unchanged.
6. Do **not** delete the old composition until the redirected tests are green; then delete dead helpers inside `harness.ts`.

Session machine stays outside: the Simulator may keep patching narration start/end directly (as today) **or** feed real `sessionStep` effects in the walk test. Product path for the phone is always `sessionStep` → effects → `directorStep`.

---

## 7. Walk test setup

New file: `packages/shared/src/audio/directorWalk.test.ts` (mirrors `sessionWalk.test.ts`).

| Piece | Source |
|---|---|
| GPX | `apps/mobile/e2e/demo-route.gpx` (A4 Farmington route; Lane A **reads** only) |
| Session | `sessionStep` + same world fixture pattern as `sessionWalk.test.ts` |
| Story | `storyStateOf(state, world)` each fix |
| Director | `directorStep` on effects + location + heartbeats between fixes |
| Clocks | wall ms from GPX schedule; audioSec advances monotonically (e.g. `wallDelta / 1000`) |

Assertions (brief):

- never > 12 granted voices (`allocateVoices` / ledger)
- accents only when `accentAllowed` (or none while narration without pause)
- ≤ 1 beacon at a time
- motif plays at most once per visit
- resolve (asset or pause) after each natural completion / afterglow start
- while `suspended`, command list is empty of play/load/start kinds

Also:

- **Resume test:** serialize mid-afterglow and mid-Hush → `parseDirectorState` → continue; commands match a control run.
- **Determinism:** fixed seed + identical inputs → identical command lists (deep equality).

---

## 8. Order of work

After plan approval, one implementation PR on this branch (or split only if Claude asks):

1. **Types + zod + `initial`/`parse` + empty `directorStep`** (passthrough state, no commands) + module API docs stub.
2. **`TargetMix` + `diffMix`** unit tests (pure diff cases).
3. **Ducking, afterglow, resolve, growth deferral** wired to session effects + story.
4. **Music stems + edge gain.**
5. **Ambience profiles/beds + accent horizon (G1 resolution) + breath gate.**
6. **Hush** (with serialized state / hush adapter).
7. **Motif, locked teaser, beacon.**
8. **`voiceLedger` + `allocateVoices` + mix health shed/recover.**
9. **Interruptions + memory `desiredLoaded`.**
10. **Simulator switch + `applyDirectorCommands` + keep harness tests green.**
11. **Walk / resume / determinism tests.**
12. **`pnpm lint && typecheck && test`**, both CI jobs green, `docs/briefs/A6-report.md`, stop for review.

No migrations expected. **Ask Jordan before any db reset** (none planned).

---

## 9. Spec gaps (do not guess — need Claude)

| ID | Gap | Options / ask |
|---|---|---|
| **G1** | Accent 20 s look-ahead vs current immediate `nextOneShot` | Extend `ambience.ts` vs director-only wrapper? |
| **G2** | `HushState` / music APIs use `Date` | Migrate hush to epoch ms in A6, or adapter-only? |
| **G3** | TECH_SPEC “1 s” tick vs brief/AUDIO_SPEC “5 s” heartbeat | Confirm 5 s; Claude amends TECH_SPEC on merge |
| **G4** | `onInterruption` is only began/ended; brief wants `shouldResume` | Confirm host-supplied boolean on input (recommended) |
| **G5** | No engine `suspend`/`resume` beyond narration pause | Commands stay host-interpreted in A6; extend `AudioEngine` later? |
| **G6** | Commands allowed while suspended | Brief: none — confirm unload/load also suppressed |
| **G7** | Settings `chime` with no asset/spec hook in A6 sources | Ignore chime playback until specified? |
| **G8** | Failed decode feedback into director | Rely on silent host, or add `assetFailed` input? |
| **G9** | B·S2 probe not in repo | Treat brief’s 24 kHz + stream capability flag as enough for A6? |
| **G10** | `voiceLedger` named as existing | Confirm A6 creates it as described in §3.2 |
| **G11** | Beacon lowpass | `beaconMix` returns `lowpassHz`; WebAudioEngine may lack a filter param today — host approximates or engine gains a filter in A6 admin only? |

---

## 10. Accept criteria (from brief; post-implementation)

- [ ] `pnpm lint`, `typecheck`, `test` green; CI `check` + `db` green
- [ ] Simulator runs on `directorStep`; every A5 harness test still passes through it
- [ ] Public API (inputs, commands, state, world) documented in the module for Lane B M7

---

## Stop

Plan only. Push + PR titled **“A6: AudioDirector (plan)”**, then wait for Claude’s plan review before any code.
