# InTell — Revised System Architecture (v2)

**Audience:** Jordan (“JoJo”) Swain, Replaceplace founding team  
**Status:** Design synthesis from the v2 spec set — recommended build target  
**Date:** 2026-11-19  
**Authority:** `docs/specs/` — PRODUCT → DATA_MODEL → AUDIO → TECH on conflict  
**Supersedes (where conflict):** v0 demo architecture (`intell-architecture.md`), pre-coding product description browse/list IA  

---

## 0. One-sentence product

**InTell** is Replaceplace’s native InDigeny app: you walk real places; narrated **fragments** unlock as a **Root → Branch → Leaf** tree inside **Grove** polygons; a generative **Surroundings** layer and adaptive **Soundtrack** accompany the visit; **Hush** returns attention to the living site; and listeners **Grow** the story through **seeds**, **crossroads**, and seasonal **Rings** — anonymous, offline-first, map-home, eyes-up.

---

## 1. Product thesis (what the architecture must serve)

| Principle | Architectural consequence |
| --- | --- |
| The environment is the interface | **Map is home.** No feeds, search, nearby lists, streaks, or push. Bottom bar: Journal · Grow · Settings only. |
| You have to be there | New fragments, votes, and seed *birth* are place-gated. Journal remembers; it does not replace the visit. Echo off-site is narration-only. |
| Three audio layers + Hush | Device-side `AudioEngine` + pure `AudioDirector` logic shared with admin **Listening Simulator**. |
| People write/record everything | No AI generation path in client, admin, or publish pipeline. |
| Story belongs to walkers | Seeds → lineage → growth moment; Crossroads → canon; Ledger; Rings. |
| Consent gates playback | Rights → playability SQL → pack rebuild → mandatory local asset deletion on sync. |
| Offline first | Versioned grove + region **packs** are the delivery system; Postgres is authoring only. |
| Anonymous by default | `device_id` bearer; Journal/heard on device; location never leaves the phone. |

**Vocabulary the system must treat as first-class:** Grove, Fragment (Root/Branch/Leaf), Surroundings, Soundtrack, Hush, Seed, Ring, Crossroads, Ledger, Echo, Moment.

---

## 2. System context

```
┌────────────────────────────┐     packs / assets (CDN)     ┌────────────────────────────┐
│  apps/mobile (Expo)        │ ◄─────────────────────────── │  Supabase Storage           │
│  Map home · Session ·      │                              │  public-media/packs, a/{sha}│
│  AudioDirector · PackStore │ ── events/seeds/votes ─────► │  Edge Functions             │
│  Journal · Grow · Settings │    (no coordinates)          │  register, plant, vote, …   │
└─────────────┬──────────────┘                              └─────────────┬──────────────┘
              │ shared pure logic                                         │
              ▼                                                           ▼
┌────────────────────────────┐                              ┌────────────────────────────┐
│  packages/shared           │ ◄── same functions ───────── │  apps/admin (Next.js)       │
│  unlock, trigger, ambience, │                              │  authoring · rights ·       │
│  music, hush, journal,     │                              │  Listening Simulator        │
│  grow eligibility, zod     │                              │  Web AudioEngine impl       │
└────────────────────────────┘                              └────────────────────────────┘
                                                            ┌────────────────────────────┐
                                                            │  Postgres + PostGIS         │
                                                            │  authoring + playability    │
                                                            └────────────────────────────┘
```

**Hard boundary:** exploring never depends on live DB queries. Devices run from installed packs + SQLite. Server receives only device-scoped writes and coarse events.

---

## 3. Monorepo layout (TECH_SPEC)

Target layout (Replaceplace repo root, or an `intell/` workspace prefix — see gap doc). Preferred for this repo:

```
Replaceplace/
├─ apps/
│  ├─ mobile/                 # Expo Router — THE product client (renamed from intell v0 path over time)
│  └─ admin/                  # Next.js App Router staff tools
├─ packages/
│  └─ shared/                 # zod schemas + pure story/audio/journal/grow/geo
├─ supabase/                  # migrations, functions, seed.sql
├─ tools/
│  └─ landcover/              # NLCD → H3 grid (staff)
├─ docs/                      # PRODUCT_SPEC … BUILD_PLAN (+ adr/)
└─ .cursor/rules/
```

**Invariant:** unlock, trigger, ambience, music, hush, tree layout, storybook, and plant/vote eligibility are **pure functions in `packages/shared`**, unit-tested, and consumed by mobile **and** the Listening Simulator.

Legacy `apps/intell` (v0 list/browse demo) and `App.js/` (Firebase prototype) are **not** the v2 product surface. Keep for history; do not extend as the map-home app.

---

## 4. Domain model (compressed)

### 4.1 Places
- **Region** → **Site** (+ **site_approvals**) → **Grove** (polygon + premise + pack_version)
- Geometry in PostGIS only for authoring; packs may expose grove boundary and non-protected fragment points.

### 4.2 Story
- **Fragment** tree: Root (no parent) → Branch → Leaf; `story_order`, `gap_hint`, visibility `marked|unmarked|protected`
- **fragment_revisions** + **revision_versions** (per-language narration + transcript)
- Unlock: Root always revealed; child revealed when parent heard ≥ 80%
- Trigger: 2 consecutive fixes / 60 s / accuracy gate; defaults Root 30 m, Branch 25 m, Leaf 20 m
- Priority when competing: Root > Branch > Leaf, then nearest; queue ≤ 1
- Protected: QR only (`/f/{code}` → sha256 match); coordinates never in packs

### 4.3 Audio layers (one asset system)
All files are **content-addressed** `audio_assets` (sha256) with `asset_rights` + consents. Playable ⇒ public object exists.

| Layer | Authoring | Runtime |
| --- | --- | --- |
| Story | revisions → narration assets | proximity / tap / QR / accessible play |
| Surroundings | profiles → layers → assets; zones; landcover fallback | `ambience.evaluate` every fix / 5 s |
| Soundtrack | music zones/cues/stems + `MusicCondition` | `music.select` from `StoryState` |
| Hush | UI voice cue in region pack | `hush.step` while exploring |

### 4.4 Participation
- **Ring** seasons: planting → writing → release (Listening Day)
- **Seeds** (device-owned): kinds next/character/noticed/answer/memory/sound; lineage via `seed_links`
- **Crossroads**: place-gated votes; outcomes unlock revisions/cues; canon blocks
- **Ledger**, questions, gatherings, optional check-in

### 4.5 Device-local (never synced as Journal content)
SQLite: packs, assets cache, heard, visits, field_notes, my_seeds, my_votes, met_characters, queues, kv. Encrypted export/import for phone moves.

---

## 5. Mobile runtime architecture

### 5.1 Module graph
```
LocationService ──fix──► SessionStore ──state──► AudioDirector ──► AudioEngine
       │                      │  ▲                     ▲
       │                      ▼  │                     │
       └──────────────► MapLayers (unlock-derived)   PackStore (SQLite + files)
```

| Module | Responsibility |
| --- | --- |
| **PackStore** | Index, download (manifest sha → tiles → assets), sync, **mandatory delete** of orphan shas |
| **LocationService** | While Using; Balanced far / High near candidates; background only during exploring session |
| **SessionStore** | idle ↔ exploring; playing/queued; hush clock; visit write on end |
| **AudioDirector** | 1 s tick + state changes → ambience / music / hush → engine ramps + ducking |
| **MapLayers** | Grove polygons, markers by unlock/heard/updated/in-range; never draw sound zones |
| **Journal / Grow** | Sheets/stacks from bottom bar; pure layout/storybook from shared |

### 5.2 Session machine (summary)
`idle` → (grove enter | tap play | QR) → `exploring`  
On arrive: optional growth moment → play/queue  
≥ 80% progress → markHeard → reveal children → characters/events  
End: Stop | 15 min outside all Groves | 3 h → write visit → idle  

### 5.3 Screen IA (DESIGN + PRODUCT)
| Surface | Job |
| --- | --- |
| Splash → brand animation → welcome | Cold start only; location explainer |
| **Map (root)** | Orientation; Grove/Marker/Fork sheets; session chip; recenter |
| Playing overlay | Dark; “Look up.”; pause; afterglow; optional plant CTA |
| Journal | Grove cards → Tree / Story / Visits → Moment |
| Grow | Ring, crossroads, questions, seeds, Ledger, Circles, check-in |
| Settings | Mixer, Hush, accessibility, downloads, privacy, credits |
| `/f/[code]` | Protected fragment via universal link |

**Explicit non-screens (v1):** nearby lists, search, browse-by-region chrome, account walls, social feeds, AR overlays, gamification.

---

## 6. Audio subsystem

### 6.1 AudioEngine interface
Defined in TECH/AUDIO: load by sha, narration + now-playing, one-shots, synced loop groups, gain ramps, route/interruption callbacks. Implementation: `react-native-audio-api` spike in **M1**; Expo Module fallback behind same interface.

### 6.2 Buses
`story` (0 dB) · `music` (−8, duck −10) · `surroundings` (−10, duck −6) · `ui` (−6). Speaker: surroundings −6 more; skip non-`speaker_safe` / wildlife calls.

### 6.3 Shared pure logic (must be simulator-identical)
- `ambience.ts` — zone weights, landcover fallback, time/month/route filters, bed/oneshot scheduling
- `music.ts` — condition match, priority + hysteresis, stem state_gains, edge fade
- `hush.ts` — schedule, hold, cancel on arrival
- `trigger.ts` / `unlock.ts` — FR-2/FR-3 and tier priority

Admin **Listening Simulator** = Web Audio `AudioEngine` + walker pin + GPX replay + story-state toggles — primary integration harness for sound/story teams.

---

## 7. Backend & packs

### 7.1 Authoring vs delivery
| Authoring (Postgres) | Delivery (Storage packs) |
| --- | --- |
| Draft → review → publish | Grove pack JSON + asset files by sha |
| Rights, approvals, geometry | Region pack: ambience library, landcover, UI cues |
| Live playability functions | `get_pack_index` only live read for devices |

### 7.2 Sync / revocation
On foreground / grove entry / reconnect: flush queues → my-seeds/votes → index → diff manifests → fetch new assets → **delete every local sha not in installed manifests**. This is how consent revocation reaches every phone.

### 7.3 Edge surface (mobile)
`register-device`, `attest`, `ingest-events`, `plant-seed`, `seed-addendum`, `my-seeds`, `vote`, `my-votes`, `submit-checkin`, `delete-device-data`. Zod-validated, rate-limited, device-scoped. Service role never on clients.

### 7.4 Admin
Story editors, sound editors, Simulator, seed inbox / ring board / crossroads / ledger, contributors/consents, dashboard, archive export, audit. RLS by `staff_role`. MFA for editor/admin.

---

## 8. Design system implications (DESIGN.md)

| Area | Decision |
| --- | --- |
| Tokens | Paper light / quiet dark overlay; tier colors + **size/glyph/label** (never color alone) |
| Map | Paper land, muted roads, no POIs; Grove fill 10% primary dashed; night variant; sound zones invisible |
| Type | Source Serif 4 for display/transcript; system UI + Dynamic Type |
| Motion | Short easings; reveal 600 ms; reduced motion → static |
| Copy | Grove/Root/Branch/Leaf/Seed/Ring/Crossroads/Ledger/Hush/Echo — warm, second person; avoid academic “Indigeny” in UI |
| Components | Sheet, BottomBar, PlayingOverlay, HoldToRecord, TreeCanvas, MixerSliders, … (DESIGN §3) |

v0 demo’s wetland-dusk list UI was atmospheric but **wrong IA**. Tokens and copy should migrate toward DESIGN; map becomes the brand surface.

---

## 9. Privacy, safety, accessibility

- Location: on-device only; While Using; background indicator during session only  
- Telemetry: event names + ids only — never coordinates or free text  
- No third-party analytics/ad SDKs; Sentry scrubbed  
- Children: age gate; under-13 vote/view only, no seed planting  
- Accessibility: transcripts, accessible play, list equivalents for trees, 48 dp targets, reduced motion, WCAG AA tokens  
- Wildlife: speaker-safe rules; nesting months; site approval can ban speaker wildlife  

---

## 10. Build sequence (aligned to BUILD_PLAN)

| Milestone | Intent | Why this order |
| --- | --- | --- |
| **M0** | Monorepo scaffold, empty mobile/admin, shared stub, Supabase init, CI | Foundation every later PR assumes |
| **M1** | AudioEngine spike on real devices | Highest technical risk; blocks M7 |
| **M2** | DB, rights, playability, packs, demo Grove seed | Delivery contract |
| **M3–M4** | Admin story + sound + Simulator + shared audio tests | Authoring before mobile polish |
| **M5–M7** | Map home, packs, session/trigger, three layers + Hush | Core exploring experience |
| **M8–M10** | Journal, Grow/seeds, Crossroads | Memory + participation |
| **M11–M12** | Analytics, hardening, field test | Ship readiness |

**Do not** jump to M5 map work before M0–M2 exist; do not treat the v0 Expo list demo as M5 progress.

---

## 11. Success metrics (architecture must emit)

Per TECH_SPEC §9: visits, fragments heard, depth (branch/leaf share), 6-month device return, participation (seeds/votes/grown), ownership-return effect, optional check-ins — captioned honestly, never clinical.

---

## 12. Document control

| Field | Value |
| --- | --- |
| Path | `docs/intell-v2-architecture.md` (Project Library) |
| Companion | `docs/intell-v2-gap-and-decisions.md` |
| Specs | `docs/specs/*.md` (and repo `docs/` once copied) |
| Prior | `docs/intell-architecture.md` (v0 demo — historical) |
| Revision | 2026-11-19 — first v2 synthesis |
