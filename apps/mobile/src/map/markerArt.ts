/** Marker canvas geometry. The PNG script and the tests both use this. */
export const MARKER_CANVAS_PT = 48;
export const MARKER_SCALE = 3;
export const PULSE_FRAMES = 8;
export const PULSE_STROKE_PT = 2;
export const PULSE_START_EXTRA_PT = 6;
/** Tunable floor for the grove outline breathe (§4.3). */
export const OUTLINE_FADE_MIN = 0.6;
/** Cap on-screen pulsing markers; above this, all use the still look (D1). */
export const MAX_PULSING_ON_SCREEN = 40;

export const RING = {
  root: { diameterPt: 22, strokePt: 2.5 },
  branch: { diameterPt: 16, strokePt: 2.5 },
  leaf: { diameterPt: 12, strokePt: 2.5 },
} as const;

export const PULSE_GROWTH = {
  root: 1.8,
  branch: 1.48,
  leaf: 1.24,
} as const;

export type MarkerTier = keyof typeof RING;
export type MarkerThemeName = "day" | "night";

export function canvasPx(scale = MARKER_SCALE): number {
  return MARKER_CANVAS_PT * scale;
}

export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 2;
}

export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - (-2 * clamped + 2) ** 2 / 2;
}

/** Frame 0 is the start of the second. The last frame is the faded end. */
export function pulseFrame(tier: MarkerTier, frame: number): { radiusPt: number; opacity: number } {
  const steps = Math.max(1, PULSE_FRAMES - 1);
  const t = frame / steps;
  const eased = easeOut(t);
  const diameter = RING[tier].diameterPt;
  const start = (diameter + PULSE_START_EXTRA_PT) / 2;
  const end = (diameter * PULSE_GROWTH[tier]) / 2;
  return {
    radiusPt: start + (end - start) * eased,
    opacity: 0.95 * (1 - t),
  };
}

/**
 * Outline opacity over the shared beat: 100% → OUTLINE_FADE_MIN → 100%,
 * brightest at the start of each beat. Reduce Motion stays at 100%.
 */
export function outlineOpacity(frame: number, reduceMotion: boolean): number {
  if (reduceMotion) return 1;
  const t = frame / PULSE_FRAMES;
  const dip = easeInOut(Math.sin(Math.PI * t));
  return 1 - (1 - OUTLINE_FADE_MIN) * dip;
}

export function markerImageName(
  tier: MarkerTier,
  theme: MarkerThemeName,
  pulse: "tier" | "changed" | "none",
  frame: number,
  opts: { reduceMotion?: boolean; locked?: boolean; pulsesCapped?: boolean } = {},
): string {
  if (opts.locked) return `${tier}-${theme}-locked`;
  if (pulse === "none") return `${tier}-${theme}-ring`;
  const kind = pulse === "changed" ? "changed" : "pulse";
  if (opts.reduceMotion || opts.pulsesCapped) return `${tier}-${theme}-${kind}-0`;
  return `${tier}-${theme}-${kind}-${frame}`;
}
