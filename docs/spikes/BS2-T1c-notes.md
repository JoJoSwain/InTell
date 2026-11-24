# B·S2 T1c — MediaElement bed inside the full mix (informational)

After T1b. ~10 minutes, phone locked.

## Setup
1. Release spike build (`EXPO_PUBLIC_AUDIO_SPIKE=1`).
2. Push the bed:  
   `adb push docs/spikes/fixtures/probe-bed-2min-stereo.m4a /sdcard/Android/data/org.replaceplace.intell/files/spikes/`
3. Cold-launch `intell://dev/audio-spike`.
4. Leave **Narration: 24 kHz (ON)** (T1 default).
5. Enable **T1c: MediaElement bed**.
6. Start full mix → lock. Jordan listens for loop clicks/gaps.

## What it does
- Full mix (narration @ 24 kHz, stems, one-shots) with the surroundings bed coming from `<Audio loop>` → `MediaElementAudioSourceNode` into the surroundings bus (local file, `isFfmpegEnabled=false`).
- Log rows: `streamBedStart`, `streamBedReady`, `streamBedLoop` (wall + context time, `via`), plus the usual minute `diagnostics` (`clockRate`).

## Capture
- PSS: `dumpsys meminfo org.replaceplace.intell` at start, 5 min, 10 min → `docs/spikes/logs/bs2-adb-t1c-{0,5,10}.txt`
- Share / pull the spike JSONL for `streamBedLoop` times and `clockRate`.
