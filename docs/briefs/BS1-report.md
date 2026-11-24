# Lane B · B·S1

ADR 0001 Android protocol on Pixel 11 (Beats Studio Buds + Bluetooth). Spike fixture loading fixed, then T1–T9 run with Jordan. ADR Status left **Proposed**.

## Spike fix

**Cause:** M5a’s custom `resolver.resolveRequest` in `apps/mobile/metro.config.js` (missing-WAV → `missingAsset.js` sentinel) broke numeric asset ids for spike WAVs that *do* exist on disk. `expo start --clear` alone did not fix it; temporarily disabling the custom resolver did (fixtures present).

**Change:** extract `resolveSpikeAudioRequest` + `SPIKE_WAV_NAMES`; install the custom resolver **only when at least one fixture WAV is missing**. When all 12 are on disk, Metro uses Expo’s default asset pipeline. Upstream chaining is kept for the missing-fixtures path. Jest covers missing / present / non-spike (`resolveSpikeAudioRequest.test.ts`). Tip: `6330c67`.

**Checks:**
- Fixtures on disk: Pixel opens `intell://dev/audio-spike`, **Status: ready**, `decodedBytes` ≈ 60.5 MB (12 WAVs as numeric ids).
- Fixtures moved aside: `expo export --platform android` exits 0 (CI clean-checkout path).

## Setup
- Headphones: Bluetooth earbuds (Jordan). No wired USB-C headphones.
- Wireless debugging: paired (`192.168.1.49`); T1 used `192.168.1.49:39445` unplugged.
- Phone: Pixel 11, Android 17 (`CD1A.261005.003`); start charge 89%; volume ~50%; DND with calls allowed.
- Fixtures generated; debug APK already installed from earlier B·S1 setup.

## Results

| # | Test | Android | Notes |
|---|---|---|---|
| T1 | 60-minute locked run + clock health | **fail** | All three layers kept playing ~60 min locked/unplugged. Quality collapsed **immediately on lock**, then worsened until barely recognizable (fragmented / choppy / jittery) by 8:35. `clockGapMs` after T1 `mixStarted` grew from ~37 ms to ~**1.7e6 ms** (pass: jumps ≤50 ms, growth &lt;250 ms). |
| T2 | Stem alignment (ear) | **fail** | Audio too degraded under lock to judge flams; `maxStemDriftMs` stays null in the engine. |
| T3 | Ducking | **fail** | Starts smooth; toggles introduce clicks/choppiness; `clockGapMs` climbs after narration toggles. |
| T4 | Route switching | **pass** | BT disconnect → `suspend route-unplug`; stayed paused after reconnect (wildlife-safety). Wired not tested. |
| T5 | Phone call | **pass** | Mix paused for the call and resumed after hang-up. Progressive distortion still noted around the session. |
| T6 | Other app audio | **fail** | Spike did **not** pause for another app’s audio; became distorted/choppy; no clean interruption. |
| T7 | Lock-screen controls | **fail** | Pause worked; playback continued when locked but was immediately extremely distorted. Notification visible; title not confirmed by ear. |
| T8 | Memory &lt; 150 MB | **fail** | TOTAL PSS ~507 / 536 / 552 MB at 5 / 30 / 60 min (manual 60 ≈ 611 MB). Far above 150 MB; mild climb. |
| T9 | Battery (informational) | recorded | 89% → 76% over ~60 min unplugged (**−13%**). M7 product target &lt;12%. |

### Clock health (T1 mix, from `docs/spikes/logs/pixel11-2026-11-23.jsonl`)

Diagnostics while locked are sparse (JS timers pause; samples mainly from engine callbacks). After the T1 `mixStarted`:

| wallElapsed ≈ | max `clockGapMs` in bucket |
|---|---|
| 0 min | ~37 |
| 1 min | ~46 000 |
| 5 min | ~210 000 |
| 15 min | ~690 000 |
| 30 min | ~1 310 000 |
| ~38 min (last samples) | ~1 714 000 |

Largest jump / total growth: **orders of magnitude over the 50 ms / 250 ms pass bars.** Matches audible lock-screen collapse.

### Memory (TOTAL PSS)

| Minute | Battery | TOTAL PSS |
|---|---|---|
| 0 (start) | 89% | ~531 MB |
| 5 | 88% | ~507 MB |
| 30 | 83% | ~536 MB |
| 60 | 76% | ~552 MB (manual ~611 MB) |

### Log
- `docs/spikes/logs/pixel11-2026-11-23.jsonl` (Bluetooth device display names redacted to `Bluetooth earbuds`).
- Supporting mem notes: `docs/spikes/logs/bs1-meminfo.txt`.

## Device
| Platform | Device | OS | Build |
|---|---|---|---|
| Android | Pixel 11 | 17 | CD1A.261005.003 |

## Surprises
- Custom Metro resolver only broke **existing** fixture `require`s; CI missing-fixture export still needs the sentinel path.
- Moving `spike-audio/` for the export check while Metro was running left Metro unable to resolve WAVs until restart (config decided “fixtures present” at boot).
- Progressive / lock-triggered distortion is the dominant Android finding; interruption (call) and pause-on-BT-unplug behave better than locked continuous mix quality.
- Decoded fixture set alone is ~60.5 MB; process PSS stayed ~500–600 MB for the whole hour.

## Failed?
Yes — Android protocol **completed** but **does not pass** Appendix A as written: T1/T2/T3/T6/T7/T8 fail; T4/T5 pass; T9 informational (−13%). iOS still pending. Status of ADR 0001 left **Proposed** for Claude.
