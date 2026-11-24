import {
  BACK_SKIP_MS,
  BREATH_SILENCE_MIN_MS,
  RESUME_PREROLL_MS,
} from "./soundFeatures";

/**
 * Suggest breath points at silences of at least BREATH_SILENCE_MIN_MS.
 * `samples` is mono Float32 PCM.
 */
export function suggestBreathPoints(
  samples: Float32Array,
  sampleRate: number,
): number[] {
  if (sampleRate <= 0 || samples.length === 0) return [];
  const minSamples = Math.floor((BREATH_SILENCE_MIN_MS / 1000) * sampleRate);
  const threshold = 0.01;
  const out: number[] = [];
  let silentRun = 0;
  let silentStart = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!);
    if (a < threshold) {
      if (silentRun === 0) silentStart = i;
      silentRun++;
    } else {
      if (silentRun >= minSamples) {
        const mid = silentStart + Math.floor(silentRun / 2);
        out.push(Math.round((mid / sampleRate) * 1000));
      }
      silentRun = 0;
    }
  }
  if (silentRun >= minSamples) {
    const mid = silentStart + Math.floor(silentRun / 2);
    out.push(Math.round((mid / sampleRate) * 1000));
  }
  return out;
}

/**
 * bp = max(breathPoint ≤ stoppedAtMs) or 0 if none;
 * resume = max(0, bp − RESUME_PREROLL_MS).
 */
export function resumePointMs(
  breathPoints: readonly number[],
  stoppedAtMs: number,
): number {
  let bp = 0;
  for (const p of breathPoints) {
    if (p <= stoppedAtMs && p >= bp) bp = p;
  }
  return Math.max(0, bp - RESUME_PREROLL_MS);
}

/** Accents only inside a pause (at a breath point ± small window). */
export function accentAllowed(
  positionMs: number,
  breathPoints: readonly number[],
  windowMs = 200,
): boolean {
  return breathPoints.some((p) => Math.abs(p - positionMs) <= windowMs);
}

/** Podcast Back: 10 s; does not use breath points. */
export function backSkipMs(positionMs: number): number {
  return Math.max(0, positionMs - BACK_SKIP_MS);
}
