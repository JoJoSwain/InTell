# Lane B · M6 report (review-2 C1–C4 + walk prep W1–W4; pre–Pixel walk)

Branch `b/m6-narration-session`. **Stopped for Claude’s check. Do not publish the walk release until Claude gives the OK and Jordan approves the map.**

## What’s wired

| Item | Status |
|---|---|
| Review-1 B1–B8, R3, A7b | Done |
| **C1** `startSessionClock` / `stopSessionClock` (silent heartbeats; no focus; no tour loop); spike tour gated; tick + afterglow on fixes; fake ticks only after clock start | Done |
| **C2** Time window recomputed at the start of every `dispatch` | Done |
| **C3** Local walk layout (two anchors Jordan chose; gitignored) + before-the-walk | Done |
| **C4** Second session after Stop: `startSessionClock` resumes suspended context (no focus); narration start requests focus, resumes, restores master gain; fake models suspended-after-stopAll; test session 1 → Stop → session 2 | Done |
| **W1** Release build for the trail (JS baked in; no Metro) | Documented below |
| **W2** USB `adb reverse` + cleartext localhost only behind `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT` | Plugin + steps below |
| **W3** QR encodes `intell://f/WTQR0001`; PNG in gitignored `local/`; QR fragment has **no** prerequisites | Done |
| **W4** Before-the-walk rewritten as USB click-by-click | Below |

## Before the walk (Jordan) — USB, click by click

Staging has no content. Use Lane A’s **local** Supabase + the **local-only** walk layout (two anchors Jordan chose; coordinates stay on this PC under gitignored `local/` — never commit, log, or paste them). Narration is spoken Windows TTS test audio (~90–110 s), clearly test-only.

**Prereqs on the PC:** Lane A’s stack is up (`supabase start` from Lane A only — never reset from Lane B). Walk layout + spoken audio already applied. Admin map approved (or lat/lng fixed). **Do not publish** until Claude says OK.

### A. Bake a local RELEASE build (once, before pack download)

A **dev client** loads JS from Metro on this PC and will not work on the trail. Use a **release** APK (ADR 0001).

1. Pixel on USB; USB debugging on. In a terminal: `adb devices` — device listed.
2. From **Lane B** repo root, set env for **this test build only** (do not leave these on for store builds):
   - `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` *(Publishable key from `pnpm exec supabase status` — not service role)*
   - `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT=1` *(enables cleartext HTTP to localhost / 127.0.0.1 only)*
   - Keep existing `GOOGLE_MAPS_API_KEY_ANDROID` in `apps/mobile/.env`
3. In PowerShell (from `apps/mobile`), with those vars in the environment (or temporarily in `.env` for this build, then remove the cleartext flag afterward):

```powershell
cd apps/mobile
$env:EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "<publishable key from supabase status>"
$env:EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT = "1"
pnpm exec expo run:android --variant release
```

4. Wait until the release build installs and launches on the Pixel. Confirm the app opens without Metro.
5. **After this walk test:** unset `EXPO_PUBLIC_ALLOW_LOCAL_CLEARTEXT` (and do not ship a store build with it).

### B. USB tunnel so the phone hits local Supabase at 127.0.0.1

1. Pixel still on USB. PC: Lane A’s Supabase listening on port **54321**.
2. Run:

```powershell
adb reverse tcp:54321 tcp:54321
```

3. Leave the cable connected for pack download. Manifest and asset URLs use the baked `http://127.0.0.1:54321/...` base, so they go through this reverse (no LAN IP).

### C. Download both walk packs (USB + reverse; before leaving)

**Only after Claude OK + publish + build-pack** (packs must exist in local storage). Until then, skip to map approval / QR printout prep.

1. On the Pixel, open Chrome or the address bar and go to: `intell://dev/data`  
   (or open the app → Dev → Data if you use that entry).
2. Tap **Install grove**.
3. Paste grove id `cccccccc-dddd-4eee-8fff-000000000101` (Walk test 1) → install → wait until **Done**.
4. Tap **Install grove** again.
5. Paste grove id `cccccccc-dddd-4eee-8fff-000000000102` (Walk test 2) → install → wait until **Done**.  
   (Or Sync after the first install so the region pack follows.)
6. Tap refresh / reload counts on that screen.
7. Confirm: packs include both walk-test groves (+ region); **assets > 0**.
8. Do **not** use “Install demo grove” — that fixture is map-only (no real audio).

### D. At-home QR audio check (USB still fine)

1. On the PC, open the gitignored QR image:  
   `local/m6-walk-test/qr/walk-test-qr.png`  
   (regenerate with `node local/m6-walk-test/generate-qr.mjs` if missing).  
   Payload is **`intell://f/WTQR0001`** — not the bare code, not the https link domain.
2. Display that PNG full-screen on a laptop/second phone, or print it.
3. On the Pixel, use the camera / app scan path so the phone opens `intell://f/WTQR0001`.
4. Confirm spoken test narration starts (Walk 2 QR has **no** prerequisites — this is a quick home ear check).

### E. Unplug and confirm offline

1. Unplug USB (`adb reverse` drops — fine; packs are already on disk).
2. Turn **Wi‑Fi off** (or Airplane mode; keep Bluetooth off if it interferes).
3. Open the map home: both walk-test groves still show; locked teasers still open.
4. Optional: scan the same QR again offline — narration should still play from on-device assets.

### F. On the trail

Leave the PC at home. Narration does not need the PC. Map tiles / Embark need network. Never log or store home/origin coordinates.

### G. Admin map (approval — before publish)

`pnpm --filter @intell/admin dev` reads **`C:\dev\intell-lanes\b\apps\admin\.env.local`**. For the interactive map add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_GOOGLE_MAP_ID`, then restart.

- Walk test 1: http://localhost:3000/story/groves/cccccccc-dddd-4eee-8fff-000000000101  
- Walk test 2: http://localhost:3000/story/groves/cccccccc-dddd-4eee-8fff-000000000102  

Drag points off private property / buildings. Draft release id: `cccccccc-dddd-4eee-8fff-0000000001e0` — **publish only after Claude’s OK**.

## Tests / commands

- `pnpm lint && pnpm typecheck && pnpm test` — green (104 mobile tests incl. C1 + C4)
- Walk layout + TTS audio + QR PNG: gitignored `local/m6-walk-test/`
- Cleartext: `apps/mobile/plugins/withLocalCleartext.ts` (flag off by default)

## Still open

1. Claude OK → publish walk release + build-pack → Jordan runs §C–§F.
2. PSS (G7), R3 on-device Stop exploring, R6 resume timing, accuracy retune — on the walk.
3. No AVD Maestro this pass.

## Next

Claude reviews this push. Then OK → publish → Pixel release install → USB pack download → walk.
