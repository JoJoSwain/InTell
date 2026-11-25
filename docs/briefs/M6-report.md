# Lane B · M6 report (review-2 C1–C3; pre–Pixel walk)

Branch `b/m6-narration-session`. Review-2 C1–C3 done. **Stopped for Claude’s check before the walk.**

## What’s wired

| Item | Status |
|---|---|
| Review-1 B1–B8, R3, A7b | Done |
| **C1** `startSessionClock` / `stopSessionClock` (silent heartbeats; no focus; no tour loop); start on exploring / resume; stop on `sessionEnded`; spike tour behind `spikeMode` / `shouldRunTourLoop`; tick + afterglow on every fix; fake ticks only after clock start; tests | Done |
| **C2** Time window recomputed at the start of every `dispatch` | Done |
| **C3** Before-the-walk steps + local walk layout (below) | Done |

## Before the walk (Jordan)

Staging has no content. Use the **local** stack and a **local-only** walk layout built from two anchors Jordan chose (coordinates stay on this PC in a gitignored folder — never committed, logged, or pasted into chat).

### 1. Which build

- Install a **development client** on the Pixel (not Expo Go): from `apps/mobile`, with Maps keys in `apps/mobile/.env`, run `pnpm exec expo run:android` (rebuild if `audio-session` changed).

### 2. Point the phone at Lane A’s local Supabase (at home, Wi‑Fi)

1. Lane A’s stack must be up (`supabase start` / `pnpm db:setup-local` from **Lane A only**).
2. In `apps/mobile/.env`:
   - `EXPO_PUBLIC_SUPABASE_URL` = the PC’s **LAN IP**, e.g. `http://192.168.x.x:54321` (not `127.0.0.1` unless you also run `adb reverse tcp:54321 tcp:54321`).
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key from `supabase status` (not service role).
3. Reload/rebuild so Expo picks up env.

### 3. Walk layout on this PC (approval before leaving)

Local-only script (gitignored `local/m6-walk-test/`) already applied **draft** groves to the local DB (no db reset):

| Grove | Slug | What to check |
|---|---|---|
| **Walk test 1** | `walk-test-1` | Root at anchor 1; two Branches; one Leaf locked until Branch A; one Night-only (silent by day) |
| **Walk test 2** | `walk-test-2` | Root requires Walk test 1’s Root (cross-grove); Contingency (replays once); Correction (no replay); physical QR |

- **Admin map (approve / drag):** `pnpm dev:admin` (needs `apps/admin/.env.local` with local Supabase URL + publishable key; for the interactive map also set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAP_ID` from the password manager, then restart). Open:
  - http://localhost:3000/story/groves/cccccccc-dddd-4eee-8fff-000000000101  
  - http://localhost:3000/story/groves/cccccccc-dddd-4eee-8fff-000000000102  
  Drag any point that lands on private property or inside a building (or edit lat/lng on the fragment form if the map key isn’t set yet). Derived grove outline appears once Maps is configured.
- **Physical marker code:** `WTQR0001` (show as QR / large text on a second screen or printout for scanning).
- **After Jordan approves:** publish draft release `cccccccc-dddd-4eee-8fff-0000000001e0` from admin (needs `supabase functions serve` / build-pack so real packs land in storage). Then install both grove packs on the phone.

### 4. Download both packs onto the Pixel (Wi‑Fi, before leaving)

1. Open `intell://dev/data`.
2. **Install grove** for each of:  
   `cccccccc-dddd-4eee-8fff-000000000101` and `cccccccc-dddd-4eee-8fff-000000000102`  
   (or Sync after first install so the region pack follows).
3. Refresh counts: packs include both walk-test groves + region; **assets > 0**.
4. Do **not** use “Install demo grove” for audio — that fixture is map-only.

### 5. Confirm offline

1. Airplane mode / Wi‑Fi off.
2. Map still shows both walk-test groves; locked teasers still open.
3. Optional ear check with mock location, or wait for the outdoor walk.

### 6. QR for the physical fragment

- Encode marker code **`WTQR0001`** (or the app’s scan deep link if you use one) as a QR on a laptop/phone screen or a paper printout. Scan on site at the physical point.

### 7. On the trail — need the PC?

**No.** Once packs and audio are on the phone, leave the PC at home. Map tiles / Embark need network; narration does not. Never log or store home/origin coordinates.

## Tests / commands

- `pnpm lint && pnpm typecheck && pnpm test` — green (103 mobile tests incl. C1 clock + spike gate)
- Walk layout applied to local DB only; folder `local/` is gitignored

## Still open

1. Jordan approves / drags points on admin map, then publish + build-pack.
2. PSS (G7), R3 on-device Stop exploring, R6 resume timing, accuracy retune — on the walk.
3. No AVD Maestro this pass.

## Next

Claude reviews this push. Then Jordan map approval → publish packs → Pixel walk.
