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

**B·S1 (2026-11-23):** Spike Metro fix landed (`6330c67`); Android T1–T9 run completed. See `docs/briefs/BS1-report.md`. Log: `docs/spikes/logs/pixel11-2026-11-23.jsonl`.

**B·S2 / Android run 2 (2026-11-24):** Spike stability fixes + release protocol. See `docs/briefs/BS2-report.md`. Log: `docs/spikes/logs/pixel11-2026-11-24-run2.jsonl`; adb: `docs/spikes/logs/bs2-adb-*.txt`.

| # | Test | How | Pass if | Android run 1 | Android run 2 | iOS | Notes |
|---|---|---|---|---|---|---|---|
| T1 | 60-minute locked run | Lock the screen. Keep the phone in a pocket or on a table for 60 minutes with headphones on; listen at minutes 0, 15, 30, 45 and 60 | No dropouts or stutters; audio still playing at 60 minutes; **clockGapMs stable** (no jumps &gt; 50 ms; total growth &lt; 250 ms) | **fail** | **pass** | pending | Run 2: clean hour; `clockRate` ~0.9998–1.0008; underruns flat 80→80; PSS ~155–171 MB |
| T2 | Stem alignment | During T1, listen for doubled clicks | **No audible flams** (Web Audio cannot log a real maxStemDriftMs) | **fail** | **pass** | pending | Run 2: no flams reported |
| T3 | Ducking | Toggle narration several times | Music and surroundings dip and recover smoothly; no clicks or pops | **fail** | **pass*** | pending | *Narration fixture has a hot attack (chirp in file), not duck clicks |
| T4 | Route switching | Unplug wired headphones, connect and disconnect Bluetooth, switch to speaker | Every switch is logged; **pause on unplug** (wildlife-safety) | **pass** | **partial** | pending | Run 2: pause-on-unplug OK; play-after-reconnect fail (earbud/lock remote) |
| T5 | Phone call | Have someone call you mid-mix; answer, then hang up | Audio pauses for the call and resumes (or can be resumed) after it | **pass** | **partial** | pending | Run 2: pause OK; no resume after hang-up |
| T6 | Other app audio | Play a song in another app, then return | An interruption is logged; the spike resumes cleanly | **fail** | **partial** | pending | Run 2: pause OK; no resume; Start disabled until Stop→Start |
| T7 | Lock-screen controls | Use play/pause on the lock screen and headphone buttons | The commands work; metadata shows "InTell audio spike" | **fail** | **partial** | pending | Metadata OK; no pause control; play auth-gated; audio clean while playing |
| T8 | Memory | Android: `adb shell dumpsys meminfo org.replaceplace.intell` at minutes 5, 30 and 60. iOS: Instruments / EAS memory display if available | Total PSS / footprint &lt; 150 MB, no steady climb | **fail** | **marginal fail** | pending | Run 2 T1: ~155–171 MB stable (over 150 bar, not climbing). T1c informational: →1124 MB |
| T9 | Battery (informational) | Note battery % at start and at 60 minutes | Record it; M7 product target is &lt; 12% | 89%→76% (−13%) | end 49% | pending | Run 2 restart end level only |

## Log attachment
- [x] `docs/spikes/logs/pixel11-2026-11-23.jsonl` (pulled via `run-as`; BT names redacted)
- [x] `docs/spikes/logs/pixel11-2026-11-24-run2.jsonl` (from logcat; BT names redacted)

## First JSONL line (optional paste)
```
(see log files — run 1 multi-session append; run 2 extracted from Part 3 logcat)
```
