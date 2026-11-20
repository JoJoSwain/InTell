# InTell — Technical Spec (v3)

Behavior: `PRODUCT_SPEC.md`. Schema: `DATA_MODEL.md`. Sound: `AUDIO_SPEC.md`. This doc covers architecture and implementation. v3 incorporates ADR 0002 (Google Maps, online) and ADR 0004 (product realignment).

---

## 1. Stack
| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | `apps/mobile`, `apps/admin`, `packages/shared`, `tools/` |
| Language | TypeScript strict (`strict`, `noUncheckedIndexedAccess`) | |
| Mobile | Expo (current stable SDK), **EAS dev builds** | Native modules; no Expo Go |
| Navigation | Expo Router | The map is the root; Chronicle, Journal and Settings are full-height sheets/stacks |
| Map | `react-native-maps` with `PROVIDER_GOOGLE` on iOS and Android (ADR 0002) | Online base map with a Google cloud map style; cheap memoized markers; no offline tiles |
| Audio | `AudioEngine` interface over `react-native-audio-api` (**spike in M1**), with a custom Expo Module as the fallback | AUDIO_SPEC §2 |
| Load animation | `lottie-react-native` (or Rive) + `expo-splash-screen` | |
| Location | `expo-location` + `expo-task-manager` | While Using only |
| Sun times | `suncalc` | Day/Night for fragments, ambience and music (region sun reference) |
| Geo | `@turf/*`, `h3-js` | Point-in-polygon, distance, H3 landcover lookup |
| Storage | `expo-sqlite`, `expo-file-system`, `expo-secure-store` | DATA_MODEL §14 |
| Recording | `expo-audio` recorder (voice Journal entries) | AAC mono 96 kbps |
| State | Zustand (session, mixer), TanStack Query (network) | |
| Drawing | `react-native-svg` (Journal tree; Skia if needed) | |
| Lists | `@shopify/flash-list` | |
| i18n | `i18next`, `react-i18next`, `expo-localization` | |
| Validation | `zod` in `packages/shared` | Shared by every app and edge function |
| Backend | Supabase: Postgres + PostGIS, Auth (email + password, invite-only staff), Storage, Edge Functions, pg_cron, pg_net | Local stack for development; hosted `staging` and `prod` projects from M3 |
| Admin | Next.js App Router, Tailwind, shadcn/ui, `@supabase/ssr`, Google Maps JavaScript API (`@vis.gl/react-google-maps`) + `terra-draw` with its Google Maps adapter for polygons, `qrcode` for printable physical markers, Web Audio (simulator, loudness meter, waveform via `wavesurfer.js`) | Hosted (Vercel proposed) |
| Tools | Python script `tools/landcover/` (`rasterio`, `h3`) to build landcover grids from NLCD | Run by staff; output uploaded |
| Monitoring | Sentry (scrub PII; never location) | |
| Tests | Vitest (shared, admin), Jest + RNTL (mobile), Playwright (admin E2E), Maestro (mobile E2E), pgTAP and Vitest-on-local-Supabase (RLS, packs) | |

---

## 2. Repository layout
```
intell/
├─ apps/mobile/
│  ├─ app/
│  │  ├─ _layout.tsx            # splash → animation gate → root stack; global audio + session providers
│  │  ├─ index.tsx              # MAP
│  │  ├─ welcome.tsx
│  │  ├─ chronicle/index.tsx · chronicle/character/[id].tsx · chronicle/fragment/[id].tsx
│  │  ├─ journal/index.tsx · journal/new.tsx · journal/terms.tsx
│  │  ├─ settings/… (index, audio, accessibility, downloads, privacy, staff, about)
│  │  └─ f/[code].tsx           # physical-marker QR universal link
│  ├─ assets/{animation,map-style,fonts,sounds}/   # sounds: chime, growth motif (bundled)
│  └─ src/
│     ├─ audio/engine/          # AudioEngine interface + implementation
│     ├─ audio/director/        # binds shared ambience/music/hush logic to the engine (ticks, fades)
│     ├─ map/                   # Google MapView, markers, sheets, teaser pop-up
│     ├─ location/              # permission flow, background task, fix stream
│     ├─ session/               # exploring state machine
│     ├─ packs/                 # pack index, download, sync, asset cache
│     ├─ chronicle/  journal/  preview/  recording/  analytics/  api/  ui/  i18n/
├─ apps/admin/
│  └─ src/app/(dash)/{dashboard,regions,groves,groves/[id],fragments/[id],characters,story-notes,
│                     releases,releases/[id],assets,images,ambience/{profiles,zones},music/{zones,cues},
│                     simulate/[groveId],journal,questions,audit,staff}
│     src/app/print/marker/[fragmentId]     # printable QR for a physical marker
├─ packages/shared/src/
│  ├─ schemas/      # zod: packs, conditions, events, endpoints, L10n
│  ├─ story/        # unlock.ts, trigger.ts, revisions.ts, contingency.ts
│  ├─ time/         # timeWindow.ts (Day/Night from region sunrise/sunset)
│  ├─ audio/        # ambience.ts, music.ts, hush.ts, rng.ts, loudness.ts
│  ├─ chronicle/    # characterCards.ts, replay.ts, related.ts
│  ├─ journal/      # lineage.ts, eligibility.ts (age gate)
│  ├─ geo/          # polygons, distance, h3 lookup
│  └─ db.ts         # generated types
├─ supabase/{migrations,functions,seed.sql,config.toml}
├─ tools/landcover/
├─ docs/  (+ docs/adr/)
└─ .cursor/rules/
```
**Rule:** every piece of decision logic (unlock, trigger, contingency, time window, ambience, music, hush, Chronicle, eligibility) is a pure function in `packages/shared`, used by the mobile app *and* the admin Listening Simulator, and unit-tested.

---

## 3. Mobile architecture

### 3.1 Runtime modules
```
LocationService ──fix──► SessionStore ──state──► AudioDirector ──► AudioEngine
       │                      │  ▲                     ▲
       │                      ▼  │                     │
       └──────────────► MapLayers (100% / 35% markers, halos)   PackStore (SQLite + files)
```
- **PackStore:** installed manifests, asset cache, `completions`, `unlocks`, `visits` and so on (DATA_MODEL §14).
- **SessionStore** (Zustand, persisted to `kv`): the session state machine (§3.2) and `StoryState` (AUDIO_SPEC §4.1).
- **AudioDirector:** ticks every 1 s plus on state changes. Calls `ambience.evaluate`, `music.select`, `hush.step` and applies their outputs to the engine with ramps. It owns ducking.
- **MapLayers:** derived from the pack, `completions`, the current time window and the session, via `unlock.ts` and `timeWindow.ts`.

### 3.2 Session state machine
```
idle
 ├─ fixInsideGrove | scan(code) → exploring
exploring { groveIds, playing?, queued?, lastInsideGroveAt, hush:{state, nextAt} }
 ├─ arrived(fragmentId)       → pick version for current window → (growthMoment?) → play if nothing is playing, else queue(1)
 │                              (exactly one narration voice ever; a queued fragment never interrupts)
 ├─ scan(locked or no version for now) → teaser pop-up
 ├─ narrationEnded(natural)   → record completion (revision, window, on site) → unlock dependents → met characters → events
 ├─ narrationEnded            → afterglow 8 s → play queued if still in range (or if it came from a scan)
 ├─ hushDue                   → hush (AUDIO_SPEC §5)
 ├─ stop | 15 min outside | 3 h → idle (write the visit record)
```

### 3.3 Location
- Foreground ("While Using") permission only. iOS `UIBackgroundModes: ["audio","location"]`, `showsBackgroundLocationIndicator: true`, `activityType: fitness`. Android foreground service: notification "InTell is playing your Grove" with a Stop action; no `ACCESS_BACKGROUND_LOCATION`.
- Accuracy: `Balanced`, 10 m interval, while > 150 m from every candidate; `High`, 5 m interval, within 150 m.
- Without a session: foreground watch only, for the puck and Grove entry.

### 3.4 Packs, download and sync (DATA_MODEL §12)
1. `get_pack_index()` → show Groves and sizes.
2. **Download:** fetch the manifest (verify its sha256) → fetch missing assets by sha (resumable, verified) → install atomically. The region pack follows on Wi-Fi. There are no map tiles to download (ADR 0002).
3. **Sync** (app foreground, Grove entry, connectivity regained):
   - flush queues
   - `GET /my-entries`
   - re-fetch the index
   - for newer versions, fetch the manifest and diff
   - download new current-revision assets (automatically on Wi-Fi, with a prompt on cellular)
   - **delete every local asset whose sha is not in any installed manifest** (mandatory)
   - Chronicle entries whose revision is no longer current leave replay (ADR 0004 §16)
   - Treat Storage **400** and **404** the same as missing (local Storage often returns `400 Object not found` instead of 404)
4. Only current revisions are in packs, so there's no cache of older revisions.
5. **Preview mode:** a signed-in staff device fetches a preview manifest from the `preview` function (DATA_MODEL §12.5) and keeps it apart from installed packs.

### 3.5 Recording (Journal entries)
- Hold-to-record UI → an `expo-audio` recorder → a temp file → stored in `my_entries`.
- Voice upload: the Journal endpoint returns a signed upload URL → upload when online (retry with backoff).
- Show a level meter while recording. Under-13 devices never see the Journal entry UI.

---

## 4. Admin architecture
- **Hosted** (Vercel proposed) against a hosted Supabase project; staff use their own computers. Server actions run with the staff user's session; RLS enforces roles (DATA_MODEL §13). The service role key is **never** used in the admin, in the browser or on the server: anything elevated goes through an edge function or a guarded SQL function.
- **Sign-in:** email and password, invite-only. An admin invites a staff member through the `invite-staff` edge function; they set their password from the email link. Deactivation is one switch. No two-factor (ADR 0004).
- **Audio upload:** the browser computes sha256, duration, channels, sample rate, bitrate, loudness and true peak (`loudness.ts` via Web Audio) → uploads to `staging-audio/{sha}.{ext}` → inserts the `audio_assets` row. Duplicate shas reuse the existing asset. Off-spec files get a visible warning.
- **Image upload:** sha256, dimensions and alt text → `staging-images/{sha}.{ext}` → `image_assets`.
- **Editors:**
  - Regions (timezone, sun reference, bounds)
  - Grove (Google map with Terra Draw polygon or pasted GeoJSON; access notes; fragments placed on the map or by coordinates; tier, visibility, radius in feet, teaser, story order; the prerequisite-group editor with fragments from any grove; validation badges)
  - Physical markers: generate the code and print a QR page (`/print/marker/[fragmentId]`)
  - Revision (Day/Night versions with narration and transcript; Story Contingency or Correction)
  - Story Notes (threads, private character notes, Indigeny notes) and characters (public intro, portrait, card lines per fragment link)
  - Releases (add items, run the checklist, publish now or schedule, see history)
  - Ambience (profiles, Day/Night layers with an audition button that runs the scheduler for 60 s) and music (Day/Night cues, condition builder → zod JSON; stems with state-gain rules; loop-point editor on a waveform) in M4
  - Zones (polygon drawing with layer toggles: groves, ambience, music, H3 landcover overlay) in M4
- **Listening Simulator:** AUDIO_SPEC §8, built on the shared logic and a Web Audio `AudioEngine` implementation (`apps/admin/src/lib/webAudioEngine.ts`) with the same interface as mobile.
- **Journal tools** (M9): the Journal inbox and questions.

---

## 5. Edge functions
| Function | Caller | Purpose |
|---|---|---|
| `publish` | Admin (editor+) or `run-jobs` for scheduled releases | Publish a release: check → copy → commit (DATA_MODEL §10) |
| `unpublish` | Admin (editor+) | Unpublish entities; warns about stranded prerequisites |
| `build-pack` | Internal | Builds a grove or region manifest from published snapshots (DATA_MODEL §12) |
| `purge-assets` | Internal | Reconciles public media to the live manifests |
| `run-jobs` | pg_cron via pg_net | The outbox worker: scheduled releases, rebuilds, reconciles |
| `invite-staff` | Admin (admin role) | Invites a staff member by email and creates their `staff` row; deactivates staff |
| `export-archive` | Admin (editor+) | A zip of revisions, transcripts, Story Notes and metadata for preservation outside InTell (M11) |
| `preview` | Staff (signed in on the phone) | Returns a preview manifest for a draft release with short-lived signed URLs (DATA_MODEL §12.5) |
| `register-device` | Mobile | Upsert a device (platform, version, language, age gate) |
| `ingest-events` | Mobile | Batched events (≤ 200), idempotent, 600/h |
| `journal-entry`, `my-entries` | Mobile | Submit a Journal entry (text, or reserve a voice upload); list your entries and their lineage (M9) |
| `submit-checkin` | Mobile | Optional connection check-in, 5/day |
| `delete-device-data` | Mobile | Cascades a device's events, Journal entries (and voice files) and check-ins; returns counts |

Every mobile endpoint is zod-validated, rate limited per `device_id`, and returns only that device's data. **The service role key never ships to clients.** Removed in v3: `attest`, `vote`, `my-votes`, `plant-seed`, `seed-addendum`, `my-seeds`.

---

## 6. Security checklist
- `anon` has no table grants (only `get_pack_index`, public storage and the device edge functions).
- Marker codes never leave Postgres: packs carry sha256 hashes, and codes are never logged or sent to Sentry. QR codes are matched by hash.
- `device_id` is a bearer secret: never displayed, never logged in full.
- No raw coordinates leave the device; Journal entries send anchor ids.
- Journal voice files live in a private bucket on a retention schedule.
- Staff: invite-only accounts, Supabase password protections on (minimum length, leaked-password rejection, session expiry), an audit log on every publish, unpublish and staff change. No two-factor (ADR 0004).
- Preview manifests and signed URLs are issued only to active staff and expire quickly.

---

## 7. Configuration
- Environments: `dev` (local Supabase), `staging` and `prod` (hosted Supabase + hosted admin), with separate EAS channels.
- **Mobile** `extra`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_MAPS_API_KEY_IOS`, `GOOGLE_MAPS_API_KEY_ANDROID`, `GOOGLE_MAP_ID`, `SENTRY_DSN`, `LINK_DOMAIN`, `WEBSITE_URL`, `PRIVACY_URL`, `JOURNAL_GUIDE_URL`.
- **Admin:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`, `NEXT_PUBLIC_LINK_DOMAIN`, `SENTRY_DSN`. No service role key.
- **Universal links:** `LINK_DOMAIN` is on replaceplace.com (proposed `intell.replaceplace.com`). It serves `apple-app-site-association` and `assetlinks.json`, plus a fallback web page at `/f/{code}` that points to the app stores.

---

## 8. Telemetry events (zod schemas in `packages/shared/src/schemas/events.ts`)
| Area | Events (props) |
|---|---|
| App | `app_opened`, `pack_downloaded {scope, bytes}` |
| Session | `grove_entered`, `session_started`, `session_ended {fragments_completed, minutes}` |
| Story | `fragment_triggered {trigger: proximity|scan|accessible, time_window}`, `fragment_completed {time_window, change_kind}`, `fragment_unlocked`, `teaser_opened`, `growth_moment_played` |
| Audio | `hush_started`, `hush_skipped`, `mixer_changed {bus}` (no values), `route_changed {route}` |
| Chronicle | `chronicle_opened`, `character_opened`, `replay_played {scope, time_window}`, `show_on_map_tapped` |
| Journal | `journal_opened`, `entry_submitted {kind, on_site, voice}`, `question_viewed`, `checkin_submitted`, `checkin_skipped` |

Never include coordinates, free text, credit names or audio.

---

## 9. Dashboard (SQL views; America/Denver months)
- **Visits** (`session_started`) and **fragments completed** per Grove, tier and time window.
- **Depth:** the share of sessions with ≥ 1 branch completed and with ≥ 1 leaf completed (show n).
- **Return (6 months):** cohort = devices first seen (first `session_started`) in month M with M + 6 ≤ today; returned = another session 1–183 days later. Show `returned/cohort`, captioned "Counts devices, not people."
- **Participation:** Journal entries by kind, unique contributors, % on site, % read within 14 days, % grown, median days to grown.
- **Contribution-return effect:** the return rate for Journal contributors vs non-contributors within the same cohort (n for each).
- **Check-ins:** n, response rate, mean before→now change (with n). Captioned "Self-reported, optional, not causal."
- CSV export for every view.

---

## 10. Testing
| Area | Must prove |
|---|---|
| Shared logic | Every rule in AUDIO_SPEC §9; unlock (AND of ORs across groves, completion per contingency, corrections carry forward, revealed stays revealed); trigger (tier priority, accuracy gate, 2-fix, physical excluded from proximity); Day/Night windows; Chronicle replay per completed version; age-gate eligibility |
| RLS | `anon` reads no tables; marker codes never reachable; each role's write limits; Story Notes never reachable outside staff |
| Publish and packs | Each checklist code; releases publish atomically across groves; scheduled releases publish or fail with a reason; staged edits don't reach packs until released; packs exclude forbidden fields (DATA_MODEL §12.4); unpublish → pack rebuilt and public object gone within 60 s |
| Edge functions | zod rejection, rate limits, idempotency, PII stripping, device scoping, age-gate enforcement, delete cascade; `invite-staff` admin-only; `preview` staff-only with expiring URLs |
| Admin E2E | Invite a writer → writer can't publish; grove → fragments (one physical, one cross-grove prerequisite) → Day/Night revisions → release → publish; a Story Contingency release; ambience profile → zone → simulator plays (M4) |
| Mobile E2E (Maestro + GPX) | Walk the route: root plays with ambience and music → branch unlocks → music stem change → leaf → Hush occurs → a locked marker's teaser → Chronicle replay of a completed fragment; a contingency resets the fragment for new unlocks |
| Device audio | 60-minute locked-screen run, route switch, call interruption, memory < 150 MB, battery < 12% |
| Field | Every real Grove on iOS and Android, phone in pocket, by day and by night |
