# B·S1 brief (Lane B): the ADR 0001 audio protocol on the Pixel 11

**Lane:** B (Mobile) · **Branch:** `b/bs1-audio-protocol` (in `C:\dev\intell-lanes\b`, cut from the same docs commit as A3) · **No plan step.** This is a test run with Jordan. It changes no product code. If a test exposes a defect, record it, **stop and report**, and don't fix it.

**What B·S1 is:** run tests T1–T9 from `docs/spikes/M1-audio-test-results.md` on Android, with Jordan, and record the results. **ADR 0001 (the audio engine) gates M6**, which plays narration. On the Pixel, only smoke tests have passed so far.
- **iOS stays pending,** because there's no Apple Developer account yet.
- **Don't change ADR 0001's Status.** Claude reads the results and decides.

**Sources:**
- `docs/adr/0001-audio-engine.md` (Findings so far)
- `docs/spikes/M1-audio-test-results.md` (the protocol table)
- `docs/spikes/M1-audio-build-notes.md` (fixtures, the dev build, the deep link)
- `docs/briefs/M1-audio-spike-review.md` (R1 clock health)

## Who does what
- **You (Lane B):**
  - Generate the fixtures, and build and install the dev build on the Pixel.
  - Open the spike with `intell://dev/audio-spike`.
  - Run every `adb` measurement, pull the JSONL log, and analyze the clock health.
  - Fill in the results.
- **Jordan:** the physical steps: headphones, locking the screen, listening, the lock-screen and headphone buttons, another app's audio, and a phone call. Someone has to call him, so ask him early who can.
- **Talk Jordan through it one step at a time** in your replies. Say exactly what to do, then wait for him to say "done" before the next step.

## Before starting
- **Ask Jordan what headphones he has.** The Pixel 11 has no headphone jack, so Bluetooth earbuds work. USB-C wired headphones are a bonus for T4, if he has them.
- **Set up wireless debugging** (Developer options → Wireless debugging, then `adb pair` and `adb connect`). The 60-minute run needs the phone **unplugged and locked**, both for the battery reading and because "Stay awake" keeps the screen on while charging, but you still need `adb` for the memory readings. Check that wireless `adb` works before T1 starts.
- Phone above 80% charge, other apps closed, volume at 50%, and Do Not Disturb on except for calls (T5).

## Order
1. **The short interactive tests first** (about 15 minutes): **T3** ducking, **T4** route switching (pause on unplug), **T6** another app's audio, **T7** lock-screen and headphone controls, and **T5**, the phone call, whenever the caller is ready.
2. **Then the 60-minute locked run:** **T1**, with **T2** (listen for doubled clicks), **T8** (`adb shell dumpsys meminfo org.replaceplace.intell` at minutes 5, 30 and 60) and **T9** (`adb shell dumpsys battery` at the start and the end). Start it unplugged. Jordan listens at minutes 0, 15, 30, 45 and 60.

## Record
- **The Android column** in `docs/spikes/M1-audio-test-results.md`: pass or fail, plus a short note for each test.
- **The device row:** Pixel 11, Android version, build number.
- **The clock health from the log** (review R1): plot or tabulate `clockGapMs` per minute, then give the largest jump and the total growth over the run. Pass is no jump over 50 ms and growth under 250 ms. Also tabulate memory (PSS) at 5, 30 and 60 minutes.
- **The log:** commit it to `docs/spikes/logs/pixel11-<date>.jsonl`, after **replacing any device names** (Bluetooth model names can carry a person's name) with a generic label. Don't commit anything else personal.
- **ADR 0001's Results table:** the Android column, plus a dated "Android protocol" note under Findings. **Leave the Status as it is.**

## Next
Write `docs/briefs/BS1-report.md`, starting with `Lane B · B·S1`. Cover:
- the results table
- the clock-health and memory tables
- anything surprising
- whether any test failed

Then push with `git push -u origin b/bs1-audio-protocol`, open a PR titled "B·S1: ADR 0001 Android protocol", and stop for Claude's review.
