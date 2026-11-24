import { describe, expect, it } from "vitest";
import {
  audioFormatOffTarget,
  BITRATE_TARGETS,
  LOUDNESS_TARGETS,
  loudnessOffTarget,
  measureLoudness,
} from "./loudness";

const SR = 48000;

/** Stereo (or mono) 1 kHz sine at the given peak dBFS, duration seconds. */
function sineChannels(
  peakDbfs: number,
  durationSec: number,
  channelCount: 1 | 2,
): Float32Array[] {
  const n = Math.round(durationSec * SR);
  const amp = Math.pow(10, peakDbfs / 20);
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      ch[i] = amp * Math.sin((2 * Math.PI * 1000 * i) / SR);
    }
    channels.push(ch);
  }
  return channels;
}

describe("measureLoudness EBU Tech 3341", () => {
  it("EBU3341_stereo_1kHz_-23dBFS_integrated", () => {
    // Tech 3341 / R128: stereo 1 kHz sine at −23 dBFS → −23.0 ±0.1 LUFS.
    const channels = sineChannels(-23, 10, 2);
    const { integrated } = measureLoudness(channels, SR);
    expect(integrated).toBeCloseTo(-23.0, 1); // ±0.1
    expect(Math.abs(integrated - -23.0)).toBeLessThanOrEqual(0.1);
  });

  it("EBU3341_stereo_1kHz_-33dBFS_integrated", () => {
    const channels = sineChannels(-33, 10, 2);
    const { integrated } = measureLoudness(channels, SR);
    expect(Math.abs(integrated - -33.0)).toBeLessThanOrEqual(0.1);
  });

  it("EBU3341_short_term_max_on_tone_burst", () => {
    // 10 s: −30 dBFS bed with a 3.5 s −18 dBFS burst. Quiet stays above the
    // relative gate so integrated is pulled down; maxShortTerm tracks the burst.
    const total = Math.round(10 * SR);
    const ampQuiet = Math.pow(10, -30 / 20);
    const ampLoud = Math.pow(10, -18 / 20);
    const burstStart = Math.round(3 * SR);
    const burstEnd = Math.round(6.5 * SR);
    const L = new Float32Array(total);
    const R = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const amp = i >= burstStart && i < burstEnd ? ampLoud : ampQuiet;
      const s = amp * Math.sin((2 * Math.PI * 1000 * i) / SR);
      L[i] = s;
      R[i] = s;
    }
    const { integrated, maxShortTerm } = measureLoudness([L, R], SR);
    expect(Number.isFinite(maxShortTerm)).toBe(true);
    expect(Number.isFinite(integrated)).toBe(true);
    expect(maxShortTerm).toBeGreaterThan(integrated + 2);
    expect(Math.abs(maxShortTerm - -18.0)).toBeLessThanOrEqual(0.5);
  });

  it("EBU3341_short_oneshot_200ms_ungated_maxShortTerm", () => {
    // <400 ms: integrated is −∞; maxShortTerm is ungated whole-clip loudness.
    const channels = sineChannels(-23, 0.2, 2);
    const { integrated, maxShortTerm } = measureLoudness(channels, SR);
    expect(Number.isFinite(integrated)).toBe(false);
    expect(Math.abs(maxShortTerm - -23.0)).toBeLessThanOrEqual(0.1);
  });

  it("EBU3341_short_oneshot_1_5s_ungated_maxShortTerm", () => {
    const channels = sineChannels(-23, 1.5, 2);
    const { maxShortTerm } = measureLoudness(channels, SR);
    expect(Math.abs(maxShortTerm - -23.0)).toBeLessThanOrEqual(0.1);
  });

  it("EBU3341_true_peak_full_scale_sine", () => {
    // 1 kHz full-scale sine: sample peak = 1 → true peak ≈ 0 dBTP (±0.2).
    const channels = sineChannels(0, 1, 2);
    const { truePeak } = measureLoudness(channels, SR);
    expect(Math.abs(truePeak - 0.0)).toBeLessThanOrEqual(0.2);
  });

  it("EBU3341_true_peak_minus_6dBFS_sine", () => {
    const channels = sineChannels(-6, 1, 2);
    const { truePeak } = measureLoudness(channels, SR);
    expect(Math.abs(truePeak - -6.0)).toBeLessThanOrEqual(0.2);
  });

  it("EBU3341_true_peak_12kHz_phase45_intersample", () => {
    // 12 kHz (fs/4) sine at amp 0.5 with 45° offset: sample peak −9.03 dBFS,
    // true peak −6.02 dBTP (+0.2 / −0.4 per EBU Tech 3341).
    const n = Math.round(1 * SR);
    const amp = 0.5;
    const phase = Math.PI / 4;
    const ch = new Float32Array(n);
    let samplePeak = 0;
    for (let i = 0; i < n; i++) {
      const s = amp * Math.sin((2 * Math.PI * 12000 * i) / SR + phase);
      ch[i] = s;
      samplePeak = Math.max(samplePeak, Math.abs(s));
    }
    expect(20 * Math.log10(samplePeak)).toBeCloseTo(-9.03, 1);
    const { truePeak } = measureLoudness([ch, ch], SR);
    expect(truePeak).toBeLessThanOrEqual(-6.02 + 0.2);
    expect(truePeak).toBeGreaterThanOrEqual(-6.02 - 0.4);
  });

  it("EBU3341_true_peak_8kHz_phase60_intersample", () => {
    // Another frequency below fs/4 with phase offset → intersample peak above sample peak.
    const n = Math.round(1 * SR);
    const amp = 0.5;
    const phase = Math.PI / 3;
    const ch = new Float32Array(n);
    let samplePeak = 0;
    for (let i = 0; i < n; i++) {
      const s = amp * Math.sin((2 * Math.PI * 8000 * i) / SR + phase);
      ch[i] = s;
      samplePeak = Math.max(samplePeak, Math.abs(s));
    }
    const sampleDbfs = 20 * Math.log10(samplePeak);
    const { truePeak } = measureLoudness([ch], SR);
    expect(Number.isFinite(truePeak)).toBe(true);
    expect(truePeak).toBeGreaterThan(sampleDbfs + 0.3);
  });

  it("EBU3341_mono_channel_weight_1_0", () => {
    // Mono weight 1.0: same per-channel level as stereo → ~3.01 LU quieter.
    const mono = sineChannels(-23, 10, 1);
    const stereo = sineChannels(-23, 10, 2);
    const m = measureLoudness(mono, SR);
    const s = measureLoudness(stereo, SR);
    expect(Math.abs(s.integrated - -23.0)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(m.integrated - (s.integrated - 10 * Math.log10(2)))).toBeLessThanOrEqual(
      0.1,
    );
  });

  it("crestFactorDb is true peak minus RMS of loudest 400 ms", () => {
    const channels = sineChannels(-20, 2, 1);
    const r = measureLoudness(channels, SR);
    expect(Number.isFinite(r.crestFactorDb)).toBe(true);
    // Sine crest ≈ 3 dB (peak vs RMS); true-peak path adds a little headroom.
    expect(r.crestFactorDb).toBeGreaterThan(2);
    expect(r.crestFactorDb).toBeLessThan(8);
  });
});

describe("loudnessOffTarget / audioFormatOffTarget", () => {
  it("flags null loudness as off-target", () => {
    expect(loudnessOffTarget("narration", null, null)).toBe(true);
    expect(loudnessOffTarget("sfx_oneshot", -24, null)).toBe(true);
  });

  it("oneshot uses maxShortTerm vs −24±2", () => {
    expect(loudnessOffTarget("sfx_oneshot", -30, -24)).toBe(false);
    expect(loudnessOffTarget("sfx_oneshot", -24, -20)).toBe(true);
    expect(LOUDNESS_TARGETS.sfx_oneshot).toBe(-24);
  });

  it("other kinds use integrated ±2", () => {
    expect(loudnessOffTarget("narration", -16, null)).toBe(false);
    expect(loudnessOffTarget("narration", -13, -16)).toBe(true);
  });

  it("format checks ext, rate, channels, bitrate±15%", () => {
    expect(
      audioFormatOffTarget("narration", {
        ext: "m4a",
        channels: 1,
        sampleRate: 48000,
        bitrateKbps: BITRATE_TARGETS.narration,
      }),
    ).toBe(false);
    expect(
      audioFormatOffTarget("narration", {
        ext: "wav",
        channels: 1,
        sampleRate: 48000,
        bitrateKbps: 96,
      }),
    ).toBe(true);
    expect(
      audioFormatOffTarget("music_stem", {
        ext: "m4a",
        channels: 1,
        sampleRate: 44100,
        bitrateKbps: 160,
      }),
    ).toBe(true);
    expect(
      audioFormatOffTarget("sfx_oneshot", {
        ext: "m4a",
        channels: 2,
        sampleRate: 44100,
        bitrateKbps: 128 * 1.1,
      }),
    ).toBe(false);
    expect(
      audioFormatOffTarget("sfx_bed", {
        ext: "m4a",
        channels: 2,
        sampleRate: 48000,
        bitrateKbps: 200,
      }),
    ).toBe(true);
  });
});
