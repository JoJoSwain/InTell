/** Linear amplitude from dB. −Infinity → 0. */
export function dbToGain(db: number): number {
  if (!Number.isFinite(db) || db <= -120) return 0;
  return Math.pow(10, db / 20);
}

/** dB from linear amplitude. 0 → −Infinity (represented as −Infinity). */
export function gainToDb(g: number): number {
  if (!Number.isFinite(g) || g <= 0) return -Infinity;
  return 20 * Math.log10(g);
}

/**
 * Equal-power crossfade at normalized progress t ∈ [0, 1].
 * fromGain² + toGain² ≈ 1 (constant power).
 */
export function equalPowerCrossfade(t: number): {
  fromGain: number;
  toGain: number;
} {
  const x = Math.min(1, Math.max(0, t));
  const angle = (x * Math.PI) / 2;
  return {
    fromGain: Math.cos(angle),
    toGain: Math.sin(angle),
  };
}
