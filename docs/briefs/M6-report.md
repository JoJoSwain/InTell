# Lane B · M6 report (review-2 fixes; pre–Pixel walk)

Branch `b/m6-narration-session`. Review-2 (C1–C3) applied on top of review-1. **Stopped before the Pixel walk for Claude’s check.**

## What’s wired now

| Item | Status |
|---|---|
| Review-1 B1–B8, R3, A7b preview | Done (prior push) |
| **C1** `startSessionClock` / `stopSessionClock` (silent heartbeats, no focus, no tour loop); start on exploring / resume; stop on `sessionEnded`; spike tour behind `spikeMode`; tick + afterglow on every fix; fake ticks only after clock start | Done |
| **C2** Time window recomputed at the start of every `dispatch` | Done |
| **C3** “Before the walk” steps below | Done |

## Before the walk (Jordan)

Staging has no content, and the phone’s `.env` often has no Supabase URL. Do this **at home on Wi‑Fi before leaving** for Farmington.

### 1. Which build

- Install a **development client** on the Pixel (not Expo Go): from `apps/mobile`, with Android SDK + Maps keys already in `apps/mobile/.env`, run `pnpm exec expo run:android` (or your usual debug install of this branch).
- Rebuild if native modules changed (`audio-session` Stop exploring). A JS-only OTA is not enough for that.

### 2. Point the phone at Lane A’s local Supabase

Lane A’s stack must already be up (`supabase start` / `pnpm db:setup-local` from **Lane A only**). Staging is empty — use local.

1. On the PC, get the API URL and **Publishable** key: `pnpm exec supabase status` in Lane A.
2. In `apps/mobile/.env` on this lane:
   - `EXPO_PUBLIC_SUPABASE_URL` = the PC’s **LAN IP**, e.g. `http://192.168.x.x:54321` (not `127.0.0.1` — the phone cannot reach the PC that way). Same Wi‑Fi as the Pixel.
   - Optional shortcut on USB: `adb reverse tcp:54321 tcp:54321` and use `http://127.0.0.1:54321` instead.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key from `supabase status` (not the anon/service role key).
3. Rebuild or reload the app so env is picked up (`app.config` → Expo).

### 3. Download the Farmington demo pack + audio

1. Open **`intell://dev/data`** (or Dev → Data).
2. Tap **Install grove** with grove id  
   `aaaaaaaa-bbbb-4ccc-8ddd-000000000010`  
   (Farmington demo from seed), **or** use Sync after a first install so the region pack follows.
3. Wait until status is **Done**. Refresh counts: packs ≥ 2 (grove + region), **assets** > 0.
4. **Do not** rely on **“Install demo grove”** for the walk — that fixture writes map manifests only (no real audio files). You need the published local pack + media from Supabase storage.

### 4. Confirm it works offline

1. Airplane mode (or turn Wi‑Fi off).
2. Open the map home: Farmington markers still show; tapping a locked one still shows a teaser.
3. Optional ear check at home: mock/fake location into a fragment radius if you have a mock-location build, or wait for the trail — either way, assets must already be on disk (`assets` count unchanged offline).

### 5. On the trail — does the phone need the PC?

**No.** Once packs and audio are installed, progress and playback are on-device. Leave the PC at home. Keep Wi‑Fi/cellular optional (map tiles / Embark need network; narration does not). Do not log or store home/origin coordinates.

### Walk itself

Farmington Bird Refuge / Eccles Wildlife Education Center trails (demo GPX loop). Ear-check: auto-start narration, afterglow → next story, pocket/lock, call interruption, notification **Stop exploring**.

## Tests / commands

- `pnpm lint && pnpm typecheck && pnpm test` — green
- Mobile: session-clock tests + spikeMode gate tests added

## Still open / not claimed

1. **PSS (G7)** — record on the walk.
2. **R3 on device** — confirm Stop exploring on lock screen / notification after native rebuild.
3. **R6** remote resume timing — measure on Pixel.
4. **Accuracy (G1)** — 25 m until field retune.
5. No AVD Maestro run this pass.

## Next

Claude reviews this push. Then Pixel walk with Jordan.
