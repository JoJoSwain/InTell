# InTell — Technical Spec (v2)

Behavior: `PRODUCT_SPEC.md`. Schema: `DATA_MODEL.md`. Sound: `AUDIO_SPEC.md`. This doc covers architecture and implementation.

---

## 1. Stack
| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | `apps/mobile`, `apps/admin`, `packages/shared`, `tools/` |
| Language | TypeScript strict (`strict`, `noUncheckedIndexedAccess`) | |
| Mobile | Expo (current stable SDK), **EAS dev builds** | Native modules; no Expo Go |
| Navigation | Expo Router | The map is the root; Journal, Grow and Settings are full-height sheets/stacks |
| Map | `@maplibre/maplibre-react-native` | Custom style; style-driven GeoJSON layers; offline packs |
| Tiles | MapTiler **or** self-hosted Protomaps PMTiles (PRODUCT_SPEC §9) | Decide before M5 |
| Audio | `AudioEngine` interface over `react-native-audio-api` (**spike in M1**), with a custom Expo Module as the fallback | AUDIO_SPEC §2 |
| Load animation | `lottie-react-native` (or Rive) + `expo-splash-screen` | |
| Location | `expo-location` + `expo-task-manager` | While Using only |
| Sun times | `suncalc` | Time windows for ambience and music |
| Geo | `@turf/*`, `h3-js` | Point-in-polygon, distance, H3 landcover lookup |
| Storage | `expo-sqlite`, `expo-file-system`, `expo-secure-store` | DATA_MODEL §14 |
| Recording | `expo-audio` recorder (voice and sound seeds, field notes) | AAC mono 96 kbps (voice); AAC stereo 128 kbps (sound) |
| Attestation | App Attest (iOS) / Play Integrity (Android) through a maintained Expo-compatible library or a small Expo Module | Used for votes |
| State | Zustand (session, mixer), TanStack Query (network) | |
| Drawing | `react-native-svg` (Journal tree; Skia if needed) | |
| Lists | `@shopify/flash-list` | |
| i18n | `i18next`, `react-i18next`, `expo-localization` | |
| Validation | `zod` in `packages/shared` | Shared by every app and edge function |
| Backend | Supabase: Postgres + PostGIS, Auth, Storage, Edge Functions, pg_cron, pg_net | |
| Admin | Next.js App Router, Tailwind, shadcn/ui, `@supabase/ssr`, `react-leaflet` + Geoman, Web Audio (simulator, loudness meter, waveform via `wavesurfer.js`) | |
| Tools | Python script `tools/landcover/` (`rasterio`, `h3`) to build landcover grids from NLCD | Run by staff; output uploaded |
| Monitoring | Sentry (scrub PII; never location) | |
| Tests | Vitest (shared, admin), Jest + RNTL (mobile), Playwright (admin E2E), Maestro (mobile E2E), pgTAP or Vitest-on-local-Supabase (RLS) | |

---

## 2. Repository layout
```
intell/
├─ apps/mobile/
│  ├─ app/
│  │  ├─ _layout.tsx            # splash → animation gate → root stack; global audio + session providers
│  │  ├─ index.tsx              # MAP
│  │  ├─ welcome.tsx
│  │  ├─ journal/index.tsx · journal/[groveId].tsx · journal/moment/[fragmentId].tsx · journal/characters.tsx
│  │  ├─ grow/index.tsx · grow/plant.tsx · grow/ledger/[groveId].tsx · grow/canon/[groveId].tsx · grow/terms.tsx
│  │  ├─ settings/… (index, audio, accessibility, downloads, privacy, credits, about)
│  │  └─ f/[code].tsx           # QR universal link
│  ├─ assets/{animation,map-style,fonts,sounds}/   # sounds: chime, growth motif (bundled)
│  └─ src/
│     ├─ audio/engine/          # AudioEngine interface + implementation
│     ├─ audio/director/        # binds shared ambience/music/hush logic to the engine (ticks, fades)
│     ├─ map/                   # MapView, layer styles, sheets, offline tile packs
│     ├─ location/              # permission flow, background task, fix stream
│     ├─ session/               # exploring state machine
│     ├─ packs/                 # pack index, download, sync, asset cache
│     ├─ journal/  grow/  recording/  analytics/  api/  ui/  i18n/
├─ apps/admin/
│  └─ app/(dash)/{dashboard,sites,groves,groves/[id],fragments/[id],rings,bible,assets,
│                 ambience/{profiles,zones},music/{zones,cues},simulate/[groveId],
│                 seeds,ring-board,crossroads,questions,ledger,contributors,consents,approvals,
│                 exports,audit,staff}
│     app/print/grove/[groveId]
├─ packages/shared/src/
│  ├─ schemas/      # zod: packs, conditions, events, endpoints, L10n
│  ├─ story/        # unlock.ts, trigger.ts, revisions.ts
│  ├─ audio/        # ambience.ts, music.ts, hush.ts, rng.ts, loudness.ts
│  ├─ journal/      # treeLayout.ts, storybook.ts
│  ├─ grow/         # lineage.ts, eligibility.ts (vote/plant gating)
│  ├─ geo/          # polygons, distance, h3 lookup
│  └─ db.ts         # generated types
├─ supabase/{migrations,functions,seed.sql,config.toml}
├─ tools/landcover/
├─ docs/  (+ docs/adr/)
└─ .cursor/rules/
```
**Rule:** every piece of decision logic (unlock, trigger, ambience, music, hush, tree layout, storybook, eligibility) is a pure function in `packages/shared`, used by the mobile app *and* the admin Listening Simulator, and unit-tested.

---

## 3. Mobile architecture

### 3.1 Runtime modules
```
LocationService ──fix──► SessionStore ──state──► AudioDirector ──► AudioEngine
       │                      │  ▲                     ▲
       │                      ▼  │                     │
       └──────────────► MapLayers (revealed markers, halos)   PackStore (SQLite + files)
```
- **PackStore:** installed manifests, asset cache, `heard`, `visits` and so on (DATA_MODEL §14).
- **SessionStore** (Zustand, persisted to `kv`): the session state machine (§3.2) and `StoryState` (AUDIO_SPEC §4.1).
- **AudioDirector:** ticks every 1 s plus on state changes. Calls `ambience.evaluate`, `music.select`, `hush.step` and applies their outputs to the engine with ramps. It owns ducking.
- **MapLayers:** derived from the pack, `heard` and the session, via `unlock.ts`.

### 3.2 Session state machine
```
idle
 ├─ fixInsideGrove | tapPlay(inRange|accessible) | qr(code) → exploring
exploring { groveIds, playing?, queued?, lastInsideGroveAt, hush:{state, nextAt} }
 ├─ arrived(fragmentId)       → (growthMoment?) → play | queue(1)
 ├─ narrationProgress(p≥0.8)  → markHeard → reveal children → met characters → events
 ├─ narrationEnded            → afterglow 8 s → play queued if still in range
 ├─ hushDue                   → hush (AUDIO_SPEC §5)
 ├─ stop | 15 min outside | 3 h → idle (write the visit record)
```

### 3.3 Location
- Foreground ("While Using") permission only. iOS `UIBackgroundModes: ["audio","location"]`, `showsBackgroundLocationIndicator: true`, `activityType: fitness`. Android foreground service: notification "InTell is playing your Grove" with a Stop action; no `ACCESS_BACKGROUND_LOCATION`.
- Accuracy: `Balanced`, 10 m interval, while > 150 m from every candidate; `High`, 5 m interval, within 150 m.
- Without a session: foreground watch only, for the puck and Grove entry.

### 3.4 Packs, download and sync (DATA_MODEL §12)
1. `get_pack_index()` → show Groves and sizes.
2. **Download:** fetch the manifest (verify its sha256) → create the MapLibre offline pack (Grove bbox + 500 m, zoom 12–18) → fetch missing assets by sha (resumable, verified) → install atomically. The region pack follows on Wi-Fi.
3. **Sync** (app foreground, Grove entry, connectivity regained):
   - flush queues
   - `GET /my-seeds` and `/my-votes`
   - re-fetch the index
   - for newer versions, fetch the manifest and diff
   - download new current-revision assets (automatically on Wi-Fi, with a prompt on cellular)
   - **delete every local asset whose sha is not in any installed manifest** (mandatory)
   - Journal rows whose revision vanished show the "no longer available" state
   - Treat Storage **400** and **404** the same as missing (local Storage often returns `400 Object not found` instead of 404)
4. **LRU** for older heard revisions: keep their audio only while still playable and referenced by `heard`.

### 3.5 Recording (seeds and field notes)
- Hold-to-record UI → an `expo-audio` recorder → a temp file → stored in `my_seeds` / `field_notes`.
- Voice seed upload: `plant-seed` returns a signed upload URL → upload when online (retry with backoff).
- Show a level meter while recording. Under-13 devices never see the record UI for seeds.

---

## 4. Admin architecture
- Server actions with the staff session; RLS enforces roles (DATA_MODEL §13). Mutations that touch playability go through edge functions.
- **Audio upload:** the browser computes sha256, duration, channels, sample rate and loudness (`loudness.ts` via Web Audio) → uploads to `staging-audio/{sha}.{ext}` → inserts the `audio_assets` row. Duplicate shas reuse the existing asset.
- **Editors:**
  - Grove (polygon and fragment tree, story order, gap hints)
  - Revision (per-language narration and transcript, credits, seed links, scheduling)
  - Ambience (profiles, layers with an audition button that runs the scheduler for 60 s)
  - Music (cue condition builder → zod JSON; stems with state-gain rules; loop-point editor on a waveform)
  - Zones (polygon drawing with layer toggles: groves, ambience, music, H3 landcover overlay)
- **Listening Simulator:** AUDIO_SPEC §8, built on the shared logic and a Web Audio `AudioEngine` implementation (`apps/admin/lib/webAudioEngine.ts`) with the same interface as mobile.
- **Participation tools:** PARTICIPATION_SPEC §7.

---

## 5. Edge functions
| Function | Caller | Purpose |
|---|---|---|
| `publish` / `unpublish` | Admin | Two-phase publish / unpublish per DATA_MODEL §10 (check → copy → commit; enqueues rebuild/purge jobs) |
| `build-pack` | Internal | Builds a grove or region manifest (DATA_MODEL §12) |
| `purge-assets` | Internal (pg_net) | Removes non-playable public objects |
| `export-archive` | Admin | Zip of revisions, transcripts, metadata, credits, seed links (internal) |
| `register-device` | Mobile | Upsert a device (platform, version, language, age gate) |
| `attest` | Mobile | Verify App Attest / Play Integrity |
| `ingest-events` | Mobile | Batched events (≤ 200), idempotent, 600/h |
| `plant-seed`, `seed-addendum`, `my-seeds` | Mobile | PARTICIPATION_SPEC §8 |
| `vote`, `my-votes` | Mobile | PARTICIPATION_SPEC §8 |
| `submit-checkin` | Mobile | Optional connection check-in, 5/day |
| `delete-device-data` | Mobile | Cascades a device's events, seeds (and voice files), votes and check-ins; returns counts |

Every mobile endpoint is zod-validated, rate limited per `device_id`, and returns only that device's data. **The service role key never ships to clients.**

---

## 6. Security checklist
- `anon` has no table grants (only `get_pack_index`, public storage and the edge functions).
- Protected fragments: no coordinates or codes in packs, logs or Sentry; QR codes matched by sha256.
- `device_id` is a bearer secret: never displayed, never logged in full.
- No raw coordinates leave the device; seeds and votes send anchor ids, and the server checks a recent session event.
- Seed voice files live in a private bucket on a retention schedule; `memory_contact` is encrypted.
- Admin: a PII column-level policy, an audit log on every playability change, and 2FA required for the editor and admin roles (Supabase MFA).

---

## 7. Configuration
- Environments: `dev` (local Supabase), `staging`, `prod`, with separate EAS channels.
- **Mobile** `extra`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAP_STYLE_URL`, `MAP_TILE_KEY?`, `SENTRY_DSN`, `LINK_DOMAIN`, `WEBSITE_URL`, `PRIVACY_URL`, `SEED_GUIDE_URL`.
- **Admin:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_MAP_TILE_URL`, `SENTRY_DSN`.
- **Universal links:** `apple-app-site-association` and `assetlinks.json` on `LINK_DOMAIN`, with a fallback web page at `/f/{code}`.

---

## 8. Telemetry events (zod schemas in `packages/shared/src/schemas/events.ts`)
| Area | Events (props) |
|---|---|
| App | `app_opened`, `pack_downloaded {scope, bytes}` |
| Session | `grove_entered`, `session_started`, `session_ended {fragments_heard, minutes}` |
| Story | `fragment_triggered {trigger: proximity|tap|qr|accessible}`, `fragment_heard`, `fragment_revealed`, `growth_moment_played` |
| Audio | `hush_started`, `hush_skipped`, `mixer_changed {bus}` (no values), `route_changed {route}` |
| Journal | `journal_opened`, `moment_opened`, `echo_played {scope}`, `show_on_map_tapped`, `field_note_saved`, `field_note_shared_as_seed` |
| Grow | `grow_opened`, `seed_planted {kind, on_site, voice}`, `vote_cast`, `question_viewed`, `ledger_opened`, `checkin_submitted`, `checkin_skipped` |

Never include coordinates, free text, credit names or audio.

---

## 9. Dashboard (SQL views; America/Denver months)
- **Visits** (`session_started`) and **fragments heard** per Grove and tier.
- **Depth:** the share of sessions with ≥ 1 branch heard and with ≥ 1 leaf heard (show n).
- **Return (6 months):** cohort = devices first seen (first `session_started`) in month M with M + 6 ≤ today; returned = another session 1–183 days later. Show `returned/cohort`, captioned "Counts devices, not people."
- **Participation:** seeds by kind, unique planters, % on site, % read within 14 days, % grown, median days to grown; votes per crossroads and the share of anchor listeners who voted.
- **Ownership-return effect:** the return rate for planters vs non-planters within the same cohort (n for each).
- **Check-ins:** n, response rate, mean before→now change (with n). Captioned "Self-reported, optional, not causal."
- CSV export for every view.

---

## 10. Testing
| Area | Must prove |
|---|---|
| Shared logic | Every rule in AUDIO_SPEC §9; unlock and trigger (tier priority, accuracy gate, 2-fix, replay on new revision, protected excluded); tree layout and storybook (gaps, canon, protected hints); vote/plant eligibility |
| RLS | `anon` reads no tables; protected coordinates never reachable; each role's write limits; PII columns hidden |
| Publish and packs | Each checklist code; pack contents exclude forbidden fields (DATA_MODEL §12.4); revocation → pack rebuilt and public object 404s within 60 s |
| Edge functions | zod rejection, rate limits, idempotency, PII stripping, device scoping, age-gate enforcement, attestation required for votes, delete cascade |
| Admin E2E | Grove → fragments → revision → publish; ambience profile → zone → simulator plays; cue with conditions → simulator switches cue on a heard toggle; crossroads → decide → dependent revision becomes playable |
| Mobile E2E (Maestro + GPX) | Download → airplane mode → walk the route: root plays with ambience and music → branch revealed → music stem change → leaf → Hush occurs → Journal tree and storybook correct → plant a voice seed offline → online → seed status syncs |
| Device audio | 60-minute locked-screen run, route switch, call interruption, memory < 150 MB, battery < 12% |
| Field | Every real Grove on iOS and Android, phone in pocket |
