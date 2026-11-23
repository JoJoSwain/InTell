# M1 audio spike — device test results

**Protocol source:** `docs/briefs/M1-audio-spike.md` Appendix A, amended by `docs/briefs/M1-audio-spike-review.md` (R1).
**Fill this in on device; attach `audio-spike-log.jsonl`.**

## Setup
Charge above 80%, close other apps, volume 50%, Do Not Disturb (except calls for T5). Open `intell://dev/audio-spike` and tap **Start full mix**.

## Devices
| Platform | Device | OS |
|---|---|---|
| Android | Pixel 11 | 17 (CD1A.261005.003) |
| iOS | pending | |

## Results

**B·S1 (2026-11-23):** Android protocol **blocked** before any T-test. Spike screen crashes on `require(…/narration_90s.wav)` (`TypeError: undefined is not a function` in `assets.ts`). Fixtures were generated and the debug APK installed. See `docs/briefs/BS1-report.md`.

| # | Test | How | Pass if | Android | iOS | Notes |
|---|---|---|---|---|---|---|
| T1 | 60-minute locked run | Lock the screen. Keep the phone in a pocket or on a table for 60 minutes with headphones on; listen at minutes 0, 15, 30, 45 and 60 | No dropouts or stutters; audio still playing at 60 minutes; **clockGapMs stable** (no jumps &gt; 50 ms; total growth &lt; 250 ms) | blocked | pending | spike UI crash |
| T2 | Stem alignment | During T1, listen for doubled clicks | **No audible flams** (Web Audio cannot log a real maxStemDriftMs) | blocked | pending | |
| T3 | Ducking | Toggle narration several times | Music and surroundings dip and recover smoothly; no clicks or pops | blocked | pending | |
| T4 | Route switching | Unplug wired headphones, connect and disconnect Bluetooth, switch to speaker | Every switch is logged; **pause on unplug** (wildlife-safety) | blocked | pending | Bluetooth earbuds only |
| T5 | Phone call | Have someone call you mid-mix; answer, then hang up | Audio pauses for the call and resumes (or can be resumed) after it | blocked | pending | |
| T6 | Other app audio | Play a song in another app, then return | An interruption is logged; the spike resumes cleanly | blocked | pending | |
| T7 | Lock-screen controls | Use play/pause on the lock screen and headphone buttons | The commands work; metadata shows "InTell audio spike" | blocked | pending | |
| T8 | Memory | Android: `adb shell dumpsys meminfo org.replaceplace.intell` at minutes 5, 30 and 60. iOS: Instruments / EAS memory display if available | Total PSS / footprint &lt; 150 MB, no steady climb | blocked | pending | |
| T9 | Battery (informational) | Note battery % at start and at 60 minutes | Record it; M7 product target is &lt; 12% | blocked | pending | |

## Log attachment
- [ ] `audio-spike-log.jsonl` shared from the test screen (not collected — blocked)

## First JSONL line (optional paste)
```
```
