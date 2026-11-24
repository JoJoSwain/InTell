# B·S2 Part 4 — narration and bed memory probe

Lane B · informational. Fixtures in `docs/spikes/fixtures/` (and pushed to  
`/sdcard/Android/data/org.replaceplace.intell/files/spikes/` for the probe screen).

## What 1.0.1 offers

| Option | Present? | Notes |
|---|---|---|
| `decodeAudioData(input, sampleRate?)` | **Yes** | Optional `sampleRate` resamples on decode. `BaseAudioContext.decodeAudioData` uses the context rate. |
| `AudioBufferQueueSourceNode` | **Yes** | `enqueueBuffer` / `dequeueBuffer` / `clearBuffers`. Takes **decoded `AudioBuffer`s**, not file paths — chunks are still PCM in memory. |
| `StreamerNode` | **No** | Not exported. Streaming is the React `<Audio>` tag → `MediaElementAudioSourceNode`. Remote HTTP/HLS needs opt‑in FFmpeg; local decode uses OS/miniaudio. |

Device: `isFfmpegEnabled=false` (release build without `enableFFmpeg`).

## Device measurements (Pixel 11, release, 2026‑11‑23)

| Case | decodeMs | sampleRate | durationSec | decodedBytes | fileBytes |
|---|---:|---:|---:|---:|---:|
| narration AAC default | 3635 | 48000 | 300.0 | **57 600 000** (55.0 MiB) | 3 656 991 |
| narration AAC → 24 kHz | 2938 | 24000 | 299.93 | **28 793 224** (27.5 MiB) | 3 656 991 |
| bed AAC default | 1281 | 48000 | 120.0 | **46 080 000** (43.9 MiB) | 1 940 288 |
| bed AAC → 24 kHz | 1255 | 24000 | 119.93 | **23 026 448** (22.0 MiB) | 1 940 288 |
| QueueSource 2× bed halves | 0* | 48000 | 120.0 | 46 080 000 (same PCM) | — |

\*QueueSource test reuses an already‑decoded bed; it only proves enqueue of two `AudioBuffer`s.

### PSS (`dumpsys meminfo`)

| When | TOTAL PSS | Native Heap PSS |
|---|---:|---:|
| Probe screen idle (before decode) | 145 787 kB (~142 MB) | 13 636 kB |
| After all decode cases (+ QueueSource) | 251 631 kB (~246 MB) | 175 220 kB |

Δ TOTAL PSS ≈ **+106 MB**; Δ Native Heap ≈ **+162 MB**. Holding several float32 buffers at once (48 kHz + 24 kHz variants) matches that jump. Downsampling at decode roughly halves PCM for that asset.

## Bed loop ×10

- API path: `AudioBufferSourceNode.loop` / `loopStart` / `loopEnd` on a fully decoded buffer (not streaming).
- Short seamless fixture: `probe-bed-6s-stereo.m4a` (440 Hz, 6 s, integer cycles) for a ~60 s listen.
- Full 2‑minute bed ×10 would be ~20 minutes; not run end‑to‑end tonight (device was contested by other apps mid‑probe).
- Streaming seamless loop of a **local** AAC file without full decode is **not** available via QueueSource (PCM chunks only) or StreamerNode (missing). `<Audio loop>` / MediaElement is the library’s file/stream player; with `isFfmpegEnabled=false` it still handles local files via OS APIs.

## Takeaway

- Use `decodeAudioData(..., 24000)` when narration/beds can tolerate half‑rate PCM — measured ~2× size cut.
- QueueSource does not avoid the memory cliff for long beds; it only schedules already‑decoded chunks.
- Planned “stream beds” need MediaElement/`<Audio>` (or a future streamer), not QueueSource alone.
