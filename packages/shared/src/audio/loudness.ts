/**
 * ITU-R BS.1770-4 loudness measurement on planar Float32 PCM.
 *
 * Admin analysis always runs at 48 kHz (OfflineAudioContext). The K-weighting
 * coefficients below are the BS.1770-4 Annex 1 values for 48 kHz only.
 */

export type LoudnessAssetKind =
  | "narration"
  | "sfx_oneshot"
  | "sfx_bed"
  | "music_stem"
  | "music_moment"
  | "beacon"
  | "voice_cue"
  | "growth_cue";

export type LoudnessResult = {
  integrated: number;
  maxShortTerm: number;
  truePeak: number;
};

/** Target integrated LUFS (oneshot warning uses short-term vs −24; see loudnessOffTarget). */
export const LOUDNESS_TARGETS: Readonly<Record<LoudnessAssetKind, number>> = {
  narration: -16,
  sfx_oneshot: -24,
  sfx_bed: -30,
  music_stem: -23,
  music_moment: -20,
  beacon: -30,
  voice_cue: -18,
  growth_cue: -18,
};

/** Target average bitrate (kbps) per AUDIO_SPEC §6. */
export const BITRATE_TARGETS: Readonly<Record<LoudnessAssetKind, number>> = {
  narration: 96,
  sfx_oneshot: 128,
  sfx_bed: 128,
  music_stem: 160,
  music_moment: 160,
  beacon: 96,
  voice_cue: 96,
  growth_cue: 96,
};

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;
const BLOCK_SEC = 0.4;
const HOP_SEC = 0.1;
const SHORT_TERM_SEC = 3;
const LUFS_OFFSET = -0.691;
const OVERSAMPLE = 4;
const TOLERANCE_LU = 2;
const BITRATE_TOLERANCE = 0.15;

/** BS.1770-4 Annex 1 pre-filter (high shelf) at 48 kHz. */
const PRE_B = [1.53512485958697, -2.69169618940638, 1.19839281085285] as const;
const PRE_A = [1.0, -1.69065929318241, 0.73248077421585] as const;

/** BS.1770-4 Annex 1 RLB-weighting (high-pass) at 48 kHz. */
const RLB_B = [1.0, -2.0, 1.0] as const;
const RLB_A = [1.0, -1.99004745483398, 0.99007225036621] as const;

function channelWeights(channelCount: number): number[] {
  if (channelCount <= 0) return [];
  if (channelCount === 1) return [1.0];
  // Stereo L/R = 1.0 each (BS.1770). Extra channels (if any) also 1.0 here;
  // admin assets are mono or stereo only.
  return Array.from({ length: channelCount }, () => 1.0);
}

function applyBiquad(
  input: Float32Array,
  b: readonly [number, number, number],
  a: readonly [number, number, number],
): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const [b0, b1, b2] = b;
  const [, a1, a2] = a;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i] ?? 0;
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

function kWeightChannel(input: Float32Array): Float32Array {
  return applyBiquad(applyBiquad(input, PRE_B, PRE_A), RLB_B, RLB_A);
}

function meanSquare(samples: Float32Array, start: number, end: number): number {
  const n = end - start;
  if (n <= 0) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return sum / n;
}

function loudnessFromWeightedMs(weightedMs: number): number {
  if (!(weightedMs > 0)) return -Infinity;
  return LUFS_OFFSET + 10 * Math.log10(weightedMs);
}

function weightedMeanSquare(
  weighted: Float32Array[],
  weights: number[],
  start: number,
  end: number,
): number {
  let sum = 0;
  for (let c = 0; c < weighted.length; c++) {
    const ch = weighted[c];
    if (!ch) continue;
    sum += (weights[c] ?? 0) * meanSquare(ch, start, end);
  }
  return sum;
}

/**
 * Hamming-windowed sinc polyphase coefficients for 4× true-peak upsampling.
 * Cutoff at π/OVERSAMPLE; 12 taps per phase (48 total).
 */
function designTruePeakPhases(): Float64Array[] {
  const tapsPerPhase = 12;
  const totalTaps = OVERSAMPLE * tapsPerPhase;
  const fc = 1 / OVERSAMPLE;
  const half = (totalTaps - 1) / 2;
  const h = new Float64Array(totalTaps);
  let sum = 0;
  for (let i = 0; i < totalTaps; i++) {
    const x = i - half;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * fc * x) / (Math.PI * fc * x);
    const hann = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (totalTaps - 1));
    const v = sinc * hann * fc * OVERSAMPLE;
    h[i] = v;
    sum += v;
  }
  // Each polyphase branch needs unity DC gain → whole filter sums to OVERSAMPLE.
  for (let i = 0; i < totalTaps; i++) {
    h[i] = ((h[i] ?? 0) * OVERSAMPLE) / sum;
  }
  const phases: Float64Array[] = [];
  for (let p = 0; p < OVERSAMPLE; p++) {
    const phase = new Float64Array(tapsPerPhase);
    for (let k = 0; k < tapsPerPhase; k++) {
      phase[k] = h[k * OVERSAMPLE + p] ?? 0;
    }
    phases.push(phase);
  }
  return phases;
}

const TRUE_PEAK_PHASES = designTruePeakPhases();

function truePeakDbTp(channels: Float32Array[]): number {
  let peak = 0;
  const tapsPerPhase = TRUE_PEAK_PHASES[0]?.length ?? 0;
  for (const ch of channels) {
    if (ch.length === 0) continue;
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i] ?? 0);
      if (a > peak) peak = a;
    }
    // Polyphase 4× interpolation (omit leading history → treat as zeros).
    for (let n = 0; n < ch.length; n++) {
      for (let p = 0; p < OVERSAMPLE; p++) {
        const phase = TRUE_PEAK_PHASES[p];
        if (!phase) continue;
        let y = 0;
        for (let k = 0; k < tapsPerPhase; k++) {
          const idx = n - k;
          const x = idx >= 0 ? (ch[idx] ?? 0) : 0;
          y += (phase[k] ?? 0) * x;
        }
        const a = Math.abs(y);
        if (a > peak) peak = a;
      }
    }
  }
  if (!(peak > 0)) return -Infinity;
  return 20 * Math.log10(peak);
}

/**
 * Measure integrated loudness, max short-term loudness, and true peak.
 * Expects planar PCM already at the admin analysis rate (48 kHz).
 */
export function measureLoudness(
  channels: Float32Array[],
  sampleRate: number,
): LoudnessResult {
  if (
    channels.length === 0 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  ) {
    return { integrated: -Infinity, maxShortTerm: -Infinity, truePeak: -Infinity };
  }

  const length = channels.reduce(
    (min, ch) => Math.min(min, ch.length),
    channels[0]?.length ?? 0,
  );
  if (length === 0) {
    return { integrated: -Infinity, maxShortTerm: -Infinity, truePeak: -Infinity };
  }

  const planar = channels.map((ch) =>
    ch.length === length ? ch : ch.subarray(0, length),
  );
  const weights = channelWeights(planar.length);
  const weighted = planar.map(kWeightChannel);
  const durationSec = length / sampleRate;
  const truePeak = truePeakDbTp(planar);

  const blockSamples = Math.max(1, Math.round(BLOCK_SEC * sampleRate));
  const hopSamples = Math.max(1, Math.round(HOP_SEC * sampleRate));
  const shortSamples = Math.max(1, Math.round(SHORT_TERM_SEC * sampleRate));

  // --- Integrated (gated) ---
  const blockMs: number[] = [];
  for (
    let start = 0;
    start + blockSamples <= length;
    start += hopSamples
  ) {
    blockMs.push(
      weightedMeanSquare(weighted, weights, start, start + blockSamples),
    );
  }

  // Absolute gate −70 LUFS, then relative −10 LU.
  const absThresh = Math.pow(10, (ABSOLUTE_GATE_LUFS - LUFS_OFFSET) / 10);
  const afterAbs = blockMs.filter((z) => z > absThresh);
  let integrated: number;
  if (afterAbs.length === 0) {
    integrated = -Infinity;
  } else {
    const absMean =
      afterAbs.reduce((s, z) => s + z, 0) / afterAbs.length;
    const relThresh =
      absMean * Math.pow(10, RELATIVE_GATE_LU / 10);
    const gated = afterAbs.filter((z) => z > relThresh);
    if (gated.length === 0) {
      integrated = -Infinity;
    } else {
      const gatedMean = gated.reduce((s, z) => s + z, 0) / gated.length;
      integrated = loudnessFromWeightedMs(gatedMean);
    }
  }

  // --- Max short-term (ungated 3 s windows) ---
  // Clips under 3 s: ungated K-weighted mean square of the whole clip (C3).
  // integrated stays gated BS.1770 (may be −∞ when shorter than one 400 ms block).
  let maxShortTerm: number;
  if (durationSec < SHORT_TERM_SEC) {
    const z = weightedMeanSquare(weighted, weights, 0, length);
    maxShortTerm = loudnessFromWeightedMs(z);
  } else {
    let maxMs = 0;
    let found = false;
    for (
      let start = 0;
      start + shortSamples <= length;
      start += hopSamples
    ) {
      const z = weightedMeanSquare(
        weighted,
        weights,
        start,
        start + shortSamples,
      );
      if (!found || z > maxMs) {
        maxMs = z;
        found = true;
      }
    }
    // Also cover a final window ending at EOF if not aligned.
    if (length >= shortSamples) {
      const z = weightedMeanSquare(
        weighted,
        weights,
        length - shortSamples,
        length,
      );
      if (!found || z > maxMs) {
        maxMs = z;
        found = true;
      }
    }
    maxShortTerm = found ? loudnessFromWeightedMs(maxMs) : -Infinity;
  }

  return { integrated, maxShortTerm, truePeak };
}

/**
 * True when loudness is missing or more than ±2 LU from the kind target.
 * sfx_oneshot compares maxShortTerm to −24; all other kinds use integrated.
 */
export function loudnessOffTarget(
  kind: LoudnessAssetKind,
  integrated: number | null,
  maxShortTerm: number | null,
): boolean {
  const target = LOUDNESS_TARGETS[kind];
  if (kind === "sfx_oneshot") {
    if (maxShortTerm === null || !Number.isFinite(maxShortTerm)) return true;
    return Math.abs(maxShortTerm - target) > TOLERANCE_LU;
  }
  if (integrated === null || !Number.isFinite(integrated)) return true;
  return Math.abs(integrated - target) > TOLERANCE_LU;
}

export type AudioFormatParams = {
  ext: string;
  channels: number;
  sampleRate: number;
  bitrateKbps: number;
};

/**
 * True when container/format params miss AUDIO_SPEC §6 expectations:
 * m4a only; 44.1/48 kHz; bitrate within ±15% of kind target; channel layout
 * by kind (mono / mono|stereo / stereo).
 */
export function audioFormatOffTarget(
  kind: LoudnessAssetKind,
  params: AudioFormatParams,
): boolean {
  const ext = params.ext.replace(/^\./, "").toLowerCase();
  if (ext !== "m4a") return true;

  if (params.sampleRate !== 44100 && params.sampleRate !== 48000) return true;

  const targetBr = BITRATE_TARGETS[kind];
  if (
    !Number.isFinite(params.bitrateKbps) ||
    params.bitrateKbps <= 0 ||
    Math.abs(params.bitrateKbps - targetBr) / targetBr > BITRATE_TOLERANCE
  ) {
    return true;
  }

  const ch = params.channels;
  switch (kind) {
    case "narration":
      // Stereo allowed when the fragment has character links (checked at publish).
      return ch !== 1 && ch !== 2;
    case "voice_cue":
    case "growth_cue":
    case "beacon":
      return ch !== 1;
    case "sfx_oneshot":
      return ch !== 1 && ch !== 2;
    case "sfx_bed":
    case "music_stem":
    case "music_moment":
      return ch !== 2;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
