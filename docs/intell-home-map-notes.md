# InTell home map — Google Maps integration

**Date:** 2026-11-19  
**Scope:** Code integration only (no Pixel install / no device demo this pass).  
**Repo:** `C:\Users\jorda\source\Replaceplace\apps\mobile`

## What shipped

Replaced the M0 “Map home (M0 stub)” with a full-bleed Google Map home:

- `react-native-maps` **1.29.11** with `provider={PROVIDER_GOOGLE}` (Android Google Maps SDK)
- `expo-location` for While-Using permission + user location puck
- Product chrome: recenter control, session status chip, bottom bar **Journal · Grow · Settings**
- Demo **Salt Marsh** Grove polygon + two **Root** markers (fixed Farmington Bay WMA coords — not device location)
- Muted Google Maps `customMapStyle` (paper land, water tint, POIs off) — DESIGN-aligned, not full MapLibre paper tiles
- API key wiring via `app.config.js` + `GOOGLE_MAPS_API_KEY` (no key invented)

### Files

| Path | Role |
|---|---|
| `apps/mobile/app/index.tsx` | Home route → `MapHome` |
| `apps/mobile/src/map/MapHome.tsx` | Map + chrome |
| `apps/mobile/src/map/demoContent.ts` | Demo Grove/Roots + muted style |
| `apps/mobile/src/ui/tokens.ts` | DESIGN light tokens |
| `apps/mobile/app.config.js` | `react-native-maps` + `expo-location` plugins; reads key |
| `apps/mobile/.env.example` | Placeholder for Maps SDK key |
| Root `.env.example` | Documents `GOOGLE_MAPS_API_KEY` |

Dependencies added: `react-native-maps`, `expo-location`.

## API key (still needed for real tiles on a native build)

No Maps key was present in env / `app.json` / secrets. Wiring is ready; JoJo must paste a key.

1. Google Cloud Console → enable **Maps SDK for Android**
2. Create an API key; restrict to Android apps:
   - package: `org.replaceplace.intell`
   - SHA-1: debug keystore fingerprint (after a local prebuild/signingReport)
3. Create `apps/mobile/.env` (gitignored):

```env
GOOGLE_MAPS_API_KEY=paste_key_here
```

4. Re-run prebuild so the key lands in the Android manifest:

```powershell
cd C:\Users\jorda\source\Replaceplace\apps\mobile
pnpm exec expo prebuild --platform android
```

Empty key at prebuild time leaves no `com.google.android.geo.API_KEY` meta-data (expected).

## How to run later (when JoJo asks)

```powershell
cd C:\Users\jorda\source\Replaceplace\apps\mobile
pnpm typecheck
# After key in .env:
pnpm exec expo prebuild --platform android
# Native install only when JoJo requests device work:
# pnpm exec expo run:android --device <adb-id>
# Metro reload: shake device → Reload, or press r in the Metro terminal
```

**Note:** A prior native build hit a Windows path-length failure under `react-native-reanimated` CMake. Workarounds when building later: enable Windows long paths, or build from a short subst drive (e.g. `subst R: C:\Users\jorda\source\Replaceplace`). Expo Go may show maps with Expo’s key but custom native config still wants a **dev client**.

## Demo locating coords

Fixed **Farmington Bay WMA, Utah** (~40.9897, −111.9083): Grove polygon + Roots “Marsh Edge” / “Causeway Light”. Initial camera centers there; recenter flies to the user puck when location is granted.

## PRODUCT / DESIGN deviations (intentional for this pass)

| Spec | This pass |
|---|---|
| TECH_SPEC MapLibre / PMTiles | **Google Maps** per JoJo preference (2026-11-19); PRODUCT map-home chrome kept |
| Custom MapLibre paper style | Google `customMapStyle` approximation only |
| Tier glyphs / MapLibre layers | Default Google pins (Root color via `pinColor`); custom markers later |
| Branch / Leaf / Crossroads / seed sprouts | Roots + Grove polygon only |
| Sheets (Marker / Grove / Fork) | Not yet |
| Session Stop exploring | Chip copy only; no SessionStore |

## Verification

- `pnpm typecheck` in `apps/mobile` — passes
- Device screenshot / Pixel install — **not done** (JoJo scope lock)
