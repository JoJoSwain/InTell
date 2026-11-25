# Lane B · M6 plan: narration, session, proximity and QR

**Branch:** `b/m6-narration-session` from `master` @ `e03d662`. Brief: `docs/briefs/M6-narration-session.md`.  
**Scope:** `apps/mobile/**` only. Any `packages/shared` change is flagged for Claude — not implemented here.  
**Stop after this plan** for Claude’s review. No product code in this PR beyond the brief + plan docs.

---

## 1. Module layout (`apps/mobile`)

Wire A4 / A6 / B·S3 / M5a; do not re-implement shared rules.

```
apps/mobile/
  app/
    index.tsx                 # home → SessionProvider + HomeScreen
    f/[code].tsx              # QR / universal-link entry → hash → session scan
    settings/index.tsx        # + accessible trigger, location availability, beacons (stored)
  src/
    session/
      SessionStore.ts         # Zustand: session + director state; kv persist
      sessionShell.ts         # event → sessionStep → apply effects → director
      applySessionEffects.ts  # SQLite + teaser UI + play/stop → director
      sessionWorld.ts         # build SessionWorld from packs + completions + settings
      persist.ts              # kv keys; parseSessionState / parseDirectorState
    location/
      LocationService.ts      # expo-location; modes; start/stop; no coord logs
      locationTask.ts         # background task name + handler → session fix
    audio/
      director/
        DirectorRuntime.ts    # directorStep wake; apply DirectorCommand → engine
        m6World.ts            # DirectorWorld for M6 (narration + moments only)
      engine/                 # existing RNAudioApiEngine (+ BS2 rules)
      session/                # existing audio-session JS (B·S3)
    map/
      PlayingOverlay.tsx      # title, tier, progress, pause/resume, back 10 s
      TeaserSheet.tsx         # locked / wrongTime / change teaser / other-time hint
      AfterglowBanner.tsx     # 8 s afterglow + “Something new…” when unlocks land
      HomeScreen.tsx          # host overlays; stop exploring via grove chip
    packs/
      install.ts / sync.ts / homeModel.ts  # switch to GrovePackDevice / RegionPackDevice
    db/repos.ts               # completions, unlocks, progress, visits, met_characters, kv
```

Existing keepers: `RNAudioApiEngine`, `AudioSessionController`, MixPlaybackService (Media3), map home (M5b), pack install (M5a), `app/f/[code].tsx` stub, `e2e/demo-route.gpx`.

---

## 2. Events, effects, persistence and resume

### 2.1 Session events (shell → `sessionStep`)

| Source | Event |
|---|---|
| `LocationService` fix (foreground or background) | `fix` `{ at, lat, lng, accuracyM, sessionId? }` — coords stay in-process / in `recentFixes` only; **never** in logs, analytics props, or effects |
| `app/f/[code]` after sha256 match | `scan` `{ at, markerHash, sessionId? }` |
| Engine / director voice end | `narrationEnded` `{ reason, playedMs }` |
| Lock-screen / overlay / noisy pause | `narrationPaused` / `narrationResumed` |
| Audio-clock heartbeat (5 s) while afterglow or outside timers matter | `tick` |
| Overlay Stop / 15 min outside / 3 h (machine also emits on tick) | `stop` |
| Settings rows | `settingsChanged` `{ accessibleTrigger, locationAvailable }` |
| `timeWindow.ts` flip (region sun + timezone) | `windowChanged` |

Idle → exploring needs `sessionId` on the entering `fix` or `scan` (A4 header). Shell generates a UUID when starting.

### 2.2 Effects (shell carries every one out)

| Effect | Action |
|---|---|
| `sessionStarted` / `sessionEnded` | Location start/stop; analytics queue (no coords) |
| `setLocationMode` | `idle` \| `foreground` \| `balanced` \| `high` → LocationService |
| `play` / `stopNarration` | Enrich from pack (sha, title, breath points, duration) → `directorStep` `sessionEffect` |
| `showTeaser` | TeaserSheet (locked / wrongTime); change teaser when present; other-time hint from pack when wrongTime |
| `recordCompletion` / `recordProgress` / `writeUnlocks` / `metCharacters` / `writeVisit` | SQLite repos (tables already in M5a migrations) |
| `startAfterglow` | UI afterglow; also forward to director |
| `groveEntered` | Forward to director (threshold motif path); analytics |
| `analytics` | Local queue only in M6 (ingest is M11); scrub any accidental geo |
| `growthMoment` | **Ignore** (M9); do not invent playback |

Order on natural end matches A4: completion → unlocks → metCharacters → analytics → startAfterglow.

### 2.3 Persistence and resume

- After every successful `sessionStep`, write `parseSessionState`-compatible JSON to `kv` key `session.state.v1`.
- After every successful `directorStep`, write `serializeDirectorState` / `parseDirectorState` to `kv` key `director.state.v1`.
- On cold start: restore both; if `phase === "exploring"`, re-apply `setLocationMode` and re-bind engine/session without auto-starting a new narration (wait for fix/scan/queue rules).
- Completions / unlocks / visits already live in SQLite (OS backup per TECH_SPEC §3.3 / ADR 0005).

### 2.4 Queue

Shared machine owns the one-slot queue. Shell tests assert two proximity triggers never overlap and a scan replaces the queue per A4.

---

## 3. AudioDirector wiring and M6 layer flags

### 3.1 Wake and apply

`DirectorRuntime` wakes on:

- session effects (`play`, `stopNarration`, `startAfterglow`, `groveEntered`, `showTeaser`, `sessionEnded`)
- `storyStateOf(session, world)` changes
- location (point / depth / insideGrove / month / timeWindow) — **no logging of point**
- 5 s audio-clock heartbeat (`DIRECTOR_HEARTBEAT_SEC`)
- engine: `voiceEnded`, `narrationProgress`, health
- `audio-session`: interruption began/ended, route → `settings.route`, suspend/resume

Commands go to `RNAudioApiEngine` only through the existing `AudioEngine` surface. UI never imports the library.

### 3.2 M6 layer policy

**On in M6:** narration, ducking (story bus), afterglow resolve (`moment`), threshold motif (`moment`), locked whispered teaser (`story`), interruption resume (breath points).

**Off until M7:** surroundings (beds / one-shots), music stems, beacons, Hush, Settings Audio page.

**Proposed wiring without guessing a new API:**

- `DirectorSettings`: `hushOn: false`, `beaconsEnabled: false` (beacons preference still stored in kv for M7).
- `DirectorWorld`: empty `musicCues`, empty ambience zones/profiles/landcover; motif / resolve / teaser shas still filled from the grove pack when present.
- `engineCaps`: `{ canStreamBeds: false, narrationDecodeHz: 24_000 }` (matches A6 tests / BS2 probe).
- Apply BS2 engine rules already required by ADR 0001: delay `disconnect`; never live-connect on preload; cancel overlapping automation curves.

**Flag for Claude (`packages/shared`):** A6’s public header still says “Lane B M7”, and there is **no** explicit “M6 layers” world flag today. Empty music/ambience + settings off may be enough, but the brief asks for a director world flag. Prefer Claude to add something like `DirectorWorld.layersEnabled: { surroundings, music, beacons, hush }` (defaults true for M7/admin simulator; M6 sets all false) **or** confirm empty-world + settings is the accepted gate. Lane B will not invent the flag.

### 3.3 Session module (B·S3) hooks

- Lock-screen / notification title = playing fragment title (`NowPlayingMeta` from `playNarration`).
- Back / skip-back = 10 s (Media3 custom action → engine seek; not breath-point based — AUDIO_SPEC §6).
- Overlay pause/play ↔ `setPlayback` / focus machine; remote play keeps WIU `playWhenReady` behavior from BS3.
- **Remote-play resume ~2 s:** BS3 uses `requestFocusWithRetry` 3× / 500 ms (~1–1.5 s focus window) and T6b was audible within ~3 s. Plan: keep the WIU path; if ear shows slower than ~2 s on the Pixel walk, tighten `gapMs` (e.g. 3× / 300 ms) only after measuring — do not weaken deny → paused / “audio busy”.

Narration decode at 24 kHz; respect engine LRU / voice budget (narration + moment + teaser within the 12-voice envelope; music/ambience unused).

---

## 4. Location service design

### 4.1 Decision: **two foreground services** (recommended)

| Service | Type | Role |
|---|---|---|
| `MixPlaybackService` (existing) | `mediaPlayback` | B·S3 Media3 session / notification; promote on play (Android 17 WIU); demote on hard LOSS / user pause / noisy |
| Location FGS via `expo-location` + TaskManager | `location` | Background fixes **for the whole exploring session**, including while narration is paused |

**Why not one combined `mediaPlayback|location` service:** BS3 demotes the media FGS on user pause and hard LOSS while keeping the MediaSession. If location shared that service, demotion would risk dropping background fixes mid-session. Two types / two services keep Android 14+ type rules clear and preserve BS3’s playWhenReady WIU behavior.

**Permissions:** “While Using” only. No `ACCESS_BACKGROUND_LOCATION`. iOS: `UIBackgroundModes: ["audio","location"]`, `showsBackgroundLocationIndicator: true`, `activityType: fitness` (TECH_SPEC §3.3) — declared in config when we touch location plugins; **iOS runtime deferred** (no Mac).

**Start rules:** location FGS starts from a user-visible exploring transition (grove enter or successful scan that starts a session), never from a naked boot receiver. Media FGS stays tied to play as today.

### 4.2 Modes (`setLocationMode`)

| Mode | Behavior |
|---|---|
| `foreground` | Watch for puck / grove entry; no session FGS |
| `balanced` | Session; ~10 m interval while > 150 m from every candidate (`LOCATION_HIGH_WITHIN_M`) |
| `high` | Session; ~5 m interval within 150 m |
| `idle` | Tear down updates |

Accuracy tolerance is a **world setting** (`accuracyToleranceM`) passed into `sessionStep` (A4). Product default is **not** fixed in DATA_MODEL; shared tests use `25`. Plan: ship **25 m** for emulator GPX; record any field retune from the Pixel walk in the report (FR-3).

### 4.3 Stop

On `sessionEnded` / idle: stop background updates and remove the location notification within **5 s** (acceptance). Keep a unit/integration timer assertion.

### 4.4 Privacy

No coordinates in `console`, Sentry, analytics props, kv dumps used for support, or effect payloads. Log only enums (mode, “fix accepted/skipped”, accuracy bucket if needed — not lat/lng).

---

## 5. QR and link plan

### 5.1 App path

1. Open `https://{LINK_DOMAIN}/f/{code}` or custom-scheme fallback `intell://f/{code}`.
2. Route: existing `app/f/[code].tsx`.
3. Upper-case the path segment (Crockford base32); UTF-8 sha256; match `markerHash` in installed grove packs (TECH_SPEC M5 note).
4. Emit `scan` with **hash only** (never log the raw code).
5. Unlocked + in-window → play; else teaser (`locked` / `wrongTime`).

### 5.2 Intent filters / associated hosts (app config)

- Android App Links: `https://intell.replaceplace.com/f/*` with `autoVerify`.
- iOS Universal Links: applinks for the same host (deferred until Apple account).
- Custom scheme for testing: `intell://f/{code}` until hosting exists.

### 5.3 Hosting steps for Jordan (domain not up yet)

1. DNS for `intell.replaceplace.com` → static host (or existing replaceplace web).
2. Serve `https://intell.replaceplace.com/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "org.replaceplace.intell",
    "sha256_cert_fingerprints": ["<Play App signing cert SHA-256>"]
  }
}]
```

3. Serve `apple-app-site-association` (iOS later) with `appID` + `/f/*`.
4. Fallback page at `/f/{code}`: open/install app copy (TECH_SPEC §10); no marker codes stored server-side beyond the path echo for deep link.
5. Set `LINK_DOMAIN=intell.replaceplace.com` in mobile extra / `.env.example` (empty in example; never commit secrets). **Never print Maps keys.**

Until (1–4) land, Maestro / device tests use `adb shell am start` with `intell://f/...` or Expo linking.

---

## 6. Overlay and teaser design proposal

MOBILE_HOME_STANDARDS names the playing overlay and teaser as transient chrome but does **not** specify layout. PRODUCT_SPEC §5.1 supplies copy. **Minimal proposal for Claude + Jordan before build:**

### Playing overlay
- Full-bleed dimmer over the map (`surface` / ink at ~70% night-safe), not a floating card stack.
- Center stack (system font for reading): **title** (Questrial), **tier** label, thin progress, copy **“Look up. We'll keep playing.”**
- Controls: Pause / Resume, Back 10 s. **No control that starts a first listen** (hands-free only).
- Stop exploring stays on the grove-name chip sheet (standards §2.1), not on the overlay.
- Lock-screen mirrors title; same pause / back.

### Afterglow
- After natural end: hold overlay ~8 s (`AFTERGLOW_MS`); then dismiss.
- When `writeUnlocks` lands: brief non-modal line **“Something new has opened nearby”** (i18n); markers already refresh via map model.

### Teaser sheet
- Bottom sheet (`surface`, tokens): teaser text only when locked / wrongTime — **never** title, transcript, or audio for locked (hard constraint).
- Change teaser when `changeTeaser` present (contingency).
- Wrong-time: show writers’ other-time hint when the pack has one (ADR 0005 §4); else teaser only.
- Physical locked scan uses the same sheet.

### Settings (minimal rows)
- Accessible trigger (on/off) → `settingsChanged`.
- Location available (reflect permission / user toggle that disables proximity + accessible trigger; scans still work).
- Beacons on/off → kv only for M7 (director `beaconsEnabled` stays false in M6).

**Claude checks this with Jordan before implementation.**

---

## 7. Pack parsers

Replace every product parse of grove/region manifests with **`GrovePackDevice` / `RegionPackDevice`** (`strip()`):

- `src/packs/install.ts`
- `src/packs/sync.ts`
- `src/map/homeModel.ts`
- any session world builder that `JSON.parse`s `manifest_json`

Keep **strict** `GrovePack` / `RegionPack` only in fixture builders / tests that intentionally assert schema. Required before packs carry new optional keys (A5). Preview path: confirm with Claude whether preview manifests should use device strip too when unknown keys appear (today `PreviewManifest` embeds strict grove packs).

---

## 8. Test plan

### 8.1 Unit / integration (CI)

- Event mapping: location / scan / engine / settings / window → correct `SessionEvent`.
- Each `SessionEffect` applied (SQLite mocks; director/engine fakes).
- Persist + cold resume (`parseSessionState` / director).
- Queue: second trigger waits; no overlap; scan replaces queue.
- Marker hash: upper-case → sha256 → `scan` (code never logged).
- Location stop ≤ 5 s after session end (fake timers).
- Director M6 world: no music/ambience/beacon/hush commands when layers off.
- Pack install/sync still green on Device parsers.

### 8.2 Android emulator + demo GPX

Use `apps/mobile/e2e/demo-route.gpx` (Farmington demo; avoids frag9). Mock locations / Maestro (or equivalent) against installed demo pack.

Acceptance checklist (BUILD_PLAN M6 + brief):

- [ ] Each unlocked fragment plays once, tier order
- [ ] Locked never play
- [ ] Contingency replays; correction does not
- [ ] Day-only silent at night
- [ ] Locked marker scan → teaser only
- [ ] No overlap (queue of one)
- [ ] No tap to start narration
- [ ] Location denied: scans work; proximity + accessible trigger off
- [ ] Accessible trigger: single fix within 35 ft (`ACCESSIBLE_RADIUS_M`)
- [ ] Location stops within 5 s of session end

### 8.3 iOS simulator

**Deferred** — no Mac / Apple account. Stated in the eventual report.

### 8.4 Pixel walk with Jordan (end)

Phone in pocket, screen locked: real proximity triggers, lock-screen controls, call mid-story (T5-style). **Pass by Jordan’s ear**, not instrumentation alone. No coord logs in captured logcat.

---

## 9. Order of work

1. **Pack Device parsers** (unblock forward-compatible manifests).
2. **SessionStore + persist** + effect applicator (SQLite) with fakes — no audio yet.
3. **LocationService** (foreground + background FGS) + mode mapping; privacy review.
4. **DirectorRuntime** + M6 world + engine command apply (narration path); BS2 engine rules audit.
5. **Hook B·S3 audio-session** (meta, back 10 s, interruption, route).
6. **QR route** (`f/[code]`) + custom scheme; document Jordan hosting.
7. **Playing overlay / teaser / afterglow** after Claude+Jordan design OK.
8. **Settings rows** (accessible trigger, location available, beacons kv).
9. **Emulator GPX acceptance** → fix → **Pixel walk** → report.

---

## 10. Spec gaps and `packages/shared` flags

### Spec / product gaps (do not guess)

| # | Gap | Notes |
|---|---|---|
| G1 | **`accuracyToleranceM` product default** | FR-3: tuned in M6 field tests. Shared tests use 25. No DATA_MODEL constant. Propose 25 m until Pixel walk says otherwise. |
| G2 | **Playing overlay / teaser visuals** | MOBILE_HOME_STANDARDS silent; only PRODUCT_SPEC copy. §6 proposal needs Jordan sign-off via Claude. |
| G3 | **Chime + haptic on trigger** | PRODUCT_SPEC §5.1 mentions them; M6 brief list centers on narration/moments. Confirm whether M6 plays the UI chime (`DirectorSettings.chimeOn` is currently a no-op per A6) + `expo-haptics`, or defer. |
| G4 | **Director “M6 layers” flag** | Brief asks for a world flag; A6 has settings + empty inputs only. Claude: add explicit flag or bless empty-world approach (§3.2). |
| G5 | **Preview manifests + Device strip** | Product packs → Device parsers. Preview embedding strict `GrovePack` — Claude confirm. |
| G6 | **`LINK_DOMAIN` hosting** | App can ship filters + custom scheme; App Links verification waits on Jordan’s `assetlinks.json`. |
| G7 | **Whole-app memory target** | ADR 0001: re-measure in M6 with map + real assets; 150 MB was spike bar. Record number; don’t invent a new hard fail line without Claude. |

### Likely `packages/shared` asks for Claude (Lane B will not edit)

1. Optional **`DirectorWorld` / settings layer gate** for M6 (G4).
2. Only if empty-world still emits music/ambience commands — fix in shared tests + director (unexpected if A6 is correct).
3. Anything missing to map session `play` → director (sha/title/breath) belongs in the **mobile shell**, not shared — unless Claude wants a helper.

### Explicitly out of scope (per brief)

Surroundings, music, beacons playback, Hush, Settings Audio page (M7); Chronicle (M8); iOS builds; Journal growth moment playback (M9).

---

## 11. Definition of done (implementation PR, later)

- [ ] `pnpm lint`, `typecheck`, `test` green; both CI jobs green
- [ ] Every BUILD_PLAN M6 acceptance item on Android emulator; Pixel walk pass by ear
- [ ] No coordinates in logs, effects, or analytics
- [ ] Report notes iOS deferred; any shared flags resolved by Claude first

---

**This PR:** brief + plan only. Push `b/m6-narration-session`, open “M6: narration and session (plan)”, **stop for plan review.**
