/** Minimal GPX track parser for Simulator replay. */

export type GpxPoint = { lat: number; lng: number; atMs: number };

export function parseGpxTrack(xml: string): GpxPoint[] {
  const points: GpxPoint[] = [];
  const re =
    /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<time>([^<]+)<\/time>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    points.push({
      lat: Number(m[1]),
      lng: Number(m[2]),
      atMs: Date.parse(m[3]!),
    });
  }
  return points;
}

/**
 * Replay GPX at speedMultiplier (1 or 4). Returns wall-clock sample times
 * relative to replay start (ms) mapped to track positions.
 */
export function gpxReplaySchedule(
  points: readonly GpxPoint[],
  speedMultiplier: 1 | 4,
): { tMs: number; lat: number; lng: number; sourceAtMs: number }[] {
  if (points.length === 0) return [];
  const t0 = points[0]!.atMs;
  return points.map((p) => ({
    tMs: (p.atMs - t0) / speedMultiplier,
    lat: p.lat,
    lng: p.lng,
    sourceAtMs: p.atMs,
  }));
}
