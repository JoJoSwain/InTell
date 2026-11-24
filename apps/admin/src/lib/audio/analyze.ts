import {
  measureLoudness,
  parseM4aAudioParams,
  type LoudnessAssetKind,
  type LoudnessResult,
} from "@intell/shared";
import type {
  AnalyzeWorkerRequest,
  AnalyzeWorkerResponse,
} from "./analyze.worker";

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
  crestFactorDb: number | null;
};

const ANALYSIS_RATE = 48_000;

function finiteOrNull(n: number | null | undefined): number | null {
  return n !== null && n !== undefined && Number.isFinite(n) ? n : null;
}

/** Main-thread fallback (tests / browsers without Worker). */
async function analyzeOnMainThread(
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
    maxShortTermLufs: finiteOrNull(loudness?.maxShortTerm),
    loudnessLufs: finiteOrNull(loudness?.integrated),
    truePeakDbtp: finiteOrNull(loudness?.truePeak),
    crestFactorDb: finiteOrNull(loudness?.crestFactorDb),
  };
}

let workerSingleton: Worker | null = null;
let nextId = 1;

function getAnalyzeWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }
  if (workerSingleton) return workerSingleton;
  try {
    workerSingleton = new Worker(
      new URL("./analyze.worker.ts", import.meta.url),
    );
    return workerSingleton;
  } catch {
    return null;
  }
}

function analyzeInWorker(
  worker: Worker,
  file: File,
  kind: LoudnessAssetKind,
): Promise<AudioAnalysis> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const onMessage = (ev: MessageEvent<AnalyzeWorkerResponse>) => {
      if (ev.data.id !== id) return;
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      if (!ev.data.ok) {
        reject(new Error(ev.data.error));
        return;
      }
      const r = ev.data;
      resolve({
        durationMs: r.durationMs,
        channels: r.channels,
        sampleRate: r.sampleRate,
        bitrateKbps: r.bitrateKbps,
        ext: r.ext,
        loudness: r.loudness,
        loudnessError: r.loudnessError,
        maxShortTermLufs: r.maxShortTermLufs,
        loudnessLufs: r.loudnessLufs,
        truePeakDbtp: r.truePeakDbtp,
        crestFactorDb: r.crestFactorDb,
      });
    };
    const onError = (err: ErrorEvent) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      reject(err.error ?? new Error(err.message));
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);

    void file.arrayBuffer().then((bytes) => {
      const req: AnalyzeWorkerRequest = {
        id,
        bytes,
        fileName: file.name,
        fileSize: file.size,
        kind,
      };
      worker.postMessage(req, [bytes]);
    });
  });
}

/**
 * Decode via OfflineAudioContext at 48 kHz for loudness; parse m4a container
 * for native sample rate / channels (M3c B2). Runs in a Web Worker when
 * available (N3); falls back to the main thread otherwise.
 */
export async function analyzeAudioFile(
  file: File,
  kind: LoudnessAssetKind,
): Promise<AudioAnalysis> {
  const worker = getAnalyzeWorker();
  if (worker) {
    try {
      return await analyzeInWorker(worker, file, kind);
    } catch {
      // Fall through to main thread if the worker fails to start/decode.
    }
  }
  return analyzeOnMainThread(file, kind);
}

/** Test helper: measure crest without a File / Worker. */
export { analyzeOnMainThread as _analyzeOnMainThreadForTests };
