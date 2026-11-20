# Spike audio fixtures (M1)

Synthetic WAV fixtures for the audio-engine spike. **Not product audio.**

## Generate before building

WAV files are gitignored (review R2). From the repo root:

```bash
pnpm --filter @intell/audio-fixtures generate
```

This writes:

| File | Spec |
|---|---|
| `narration_90s.wav` | 90 s mono 22.05 kHz |
| `stem_a/b/c.wav` | 16.000 s stereo 44.1 kHz, click-aligned @ 120 BPM |
| `bed_wind/water.wav` | 30 s stereo 22.05 kHz, seamless |
| `oneshot_1..6.wav` | short chirps/taps |
| `generated.json` | sentinel + size summary |

Target total **&lt; 20 MB** on disk.

If `generated.json` is missing, the hidden test screen (`intell://dev/audio-spike`) shows a clear “run the generator” message instead of starting the mix.
