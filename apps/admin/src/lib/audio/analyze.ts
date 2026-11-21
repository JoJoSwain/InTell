import {
  measureLoudness,
  parseM4aAudioParams,
  type LoudnessAssetKind,
  type LoudnessResult,
} from "@intell/shared";

export type AudioAnalysis = {
  durationMs: number;
  channels: number;
  /** Native sample rate from container when m4a; else decoded buffer rate. */
  sampleRate: number;
  bitrateKbps: number;
  ext: string;
  loudness: LoudnessResult | null;
  loudnessError: string | null;
  maxShortTermLufs: number | null;
  loudnessLufs: number | null;
  truePeakDbtp: number | null;
};

const ANALYSIS_RATE = 48_000;

/**
 * Decode via OfflineAudioContext at 48 kHz for loudness; parse m4a container
 * for native sample rate / channels (M3c B2).
 */
export async function analyzeAudioFile(
  file: File,
  kind: LoudnessAssetKind,
): Promise<AudioAnalysis> {
  void kind;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const bytes = await file.arrayBuffer();

  let containerChannels: number | null = null;
  let containerRate: number | null = null;
  if (ext === "m4a") {
    const params = parseM4aAudioParams(new Uint8Array(bytes));
    if (params) {
      containerChannels = params.channels;
      containerRate = params.sampleRate;
    }
  }

  let loudness: LoudnessResult | null = null;
  let loudnessError: string | null = null;
  let durationMs = 0;
  let decodedChannels = containerChannels ?? 1;
  let sampleRate = containerRate ?? ANALYSIS_RATE;

  try {
    const OfflineCtx =
      globalThis.OfflineAudioContext ||
      (
        globalThis as unknown as {
          webkitOfflineAudioContext?: typeof OfflineAudioContext;
        }
      ).webkitOfflineAudioContext;
    if (!OfflineCtx) {
      throw new Error("OfflineAudioContext unavailable");
    }

    // Probe duration with a 1-second stub context; decodeAudioData resamples
    // to the context rate (48 kHz) per M3c B2.
    const probe = new OfflineCtx(2, ANALYSIS_RATE, ANALYSIS_RATE);
    const decoded = await probe.decodeAudioData(bytes.slice(0));
    durationMs = Math.round(decoded.duration * 1000);
    decodedChannels = decoded.numberOfChannels;
    sampleRate = containerRate ?? decoded.sampleRate;

    const planar: Float32Array[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      planar.push(decoded.getChannelData(c));
    }
    loudness = measureLoudness(planar, decoded.sampleRate);
  } catch {
    loudness = null;
    loudnessError =
      "Couldn't measure loudness in this browser. Use Chrome or Edge.";
  }

  const durationSec = durationMs > 0 ? durationMs / 1000 : 0;
  const bitrateKbps =
    durationSec > 0 ? Math.round((file.size * 8) / durationSec / 1000) : 0;

  return {
    durationMs,
    channels: containerChannels ?? decodedChannels,
    sampleRate: containerRate ?? sampleRate,
    bitrateKbps,
    ext,
    loudness,
    loudnessError,
    maxShortTermLufs: loudness?.maxShortTerm ?? null,
    loudnessLufs: loudness?.integrated ?? null,
    truePeakDbtp: loudness?.truePeak ?? null,
  };
}
