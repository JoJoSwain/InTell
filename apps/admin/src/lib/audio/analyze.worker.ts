/// <reference lib="webworker" />

import {
  measureLoudness,
  parseM4aAudioParams,
  type LoudnessAssetKind,
  type LoudnessResult,
} from "@intell/shared";

export type AnalyzeWorkerRequest = {
  id: number;
  bytes: ArrayBuffer;
  fileName: string;
  fileSize: number;
  kind: LoudnessAssetKind;
};

export type AnalyzeWorkerResponse = {
  id: number;
  ok: true;
  durationMs: number;
  channels: number;
  sampleRate: number;
  bitrateKbps: number;
  ext: string;
  loudness: LoudnessResult | null;
  loudnessError: string | null;
  maxShortTermLufs: number | null;
  loudnessLufs: number | null;
  truePeakDbtp: number | null;
  crestFactorDb: number | null;
} | {
  id: number;
  ok: false;
  error: string;
};

const ANALYSIS_RATE = 48_000;

function finiteOrNull(n: number | null | undefined): number | null {
  return n !== null && n !== undefined && Number.isFinite(n) ? n : null;
}

async function analyze(
  req: AnalyzeWorkerRequest,
): Promise<Exclude<AnalyzeWorkerResponse, { ok: false }>> {
  const ext = (req.fileName.split(".").pop() ?? "").toLowerCase();
  const bytes = req.bytes;

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
      self.OfflineAudioContext ||
      (
        self as unknown as {
          webkitOfflineAudioContext?: typeof OfflineAudioContext;
        }
      ).webkitOfflineAudioContext;
    if (!OfflineCtx) {
      throw new Error("OfflineAudioContext unavailable");
    }

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
    durationSec > 0
      ? Math.round((req.fileSize * 8) / durationSec / 1000)
      : 0;

  return {
    id: req.id,
    ok: true,
    durationMs,
    channels: containerChannels ?? decodedChannels,
    sampleRate: containerRate ?? sampleRate,
    bitrateKbps,
    ext,
    loudness,
    loudnessError,
    maxShortTermLufs: finiteOrNull(loudness?.maxShortTerm),
    loudnessLufs: finiteOrNull(loudness?.integrated),
    truePeakDbtp: finiteOrNull(loudness?.truePeak),
    crestFactorDb: finiteOrNull(loudness?.crestFactorDb),
  };
}

self.onmessage = (ev: MessageEvent<AnalyzeWorkerRequest>) => {
  const req = ev.data;
  void analyze(req)
    .then((res) => {
      self.postMessage(res);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const fail: AnalyzeWorkerResponse = {
        id: req.id,
        ok: false,
        error: message,
      };
      self.postMessage(fail);
    });
};
