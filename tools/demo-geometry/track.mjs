/**
 * Pure GPX track builders for Farmington demo route.
 * Pace: 1.4 m/s → one point per second, 1.4 m apart.
 */

export const STEP_M = 1.4;

export function ll([lat, lng]) {
  return { lat, lng };
}

export function haversineM(a, b) {
  const R = 6371000;
  const toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const la1 = toR(a.lat);
  const la2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Points from a toward b, including a, excluding b. */
export function interpolate(a, b, stepM = STEP_M) {
  const dist = haversineM(a, b);
  if (dist < 1e-6) return [{ lat: a.lat, lng: a.lng }];
  const n = Math.max(1, Math.ceil(dist / stepM));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    out.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    });
  }
  return out;
}

export function narrationMsFor(fragKey, media) {
  const map = {
    frag1: "narration_frag1",
    frag2: "narration_frag2",
    frag3: "narration_frag3",
    frag4: "narration_frag4",
    frag5: "narration_frag5",
    frag6: "narration_frag6",
    frag7: "narration_frag7",
    frag8: "narration_frag8",
    frag9: "narration_frag9",
    frag10: "narration_frag10",
  };
  const asset = media.assets[map[fragKey]];
  if (!asset) throw new Error(`missing media for ${fragKey}`);
  return asset.duration_ms;
}

export function dwellSeconds(fragKey, media) {
  return Math.ceil(narrationMsFor(fragKey, media) / 1000) + 5;
}

/**
 * Build the walk track. Dwell happens on arrival at a waypoint,
 * before interpolating toward the next (no teleport back).
 */
export function buildTrack(waypoints, dwellKeys, media, stepM = STEP_M) {
  const track = [];
  for (let i = 0; i < waypoints.length; i++) {
    const here = waypoints[i];
    // Arrive
    track.push({ lat: here.lat, lng: here.lng, key: here.key });

    // Dwell at arrival, before leaving
    if (dwellKeys.has(here.key)) {
      const dwellSec = dwellSeconds(here.key, media);
      // Arrival counts as second 0; add remaining dwellSec-1 copies
      for (let s = 1; s < dwellSec; s++) {
        track.push({ lat: here.lat, lng: here.lng, key: here.key });
      }
    }

    if (i >= waypoints.length - 1) break;

    const next = waypoints[i + 1];
    const seg = interpolate(here, next, stepM);
    // Skip seg[0] (already at here); approach next without including it
    // (next iteration pushes next on arrival)
    for (let j = 1; j < seg.length; j++) {
      track.push({ ...seg[j], key: undefined });
    }
  }
  return track;
}

export function buildWaypoints(fixture) {
  const start = ll(fixture.gpx.start);
  const keyToPt = Object.fromEntries(
    fixture.fragments.map((f) => [f.key, { key: f.key, ...ll(f.at) }]),
  );
  for (const [k, v] of Object.entries(fixture.trail_points)) {
    keyToPt[k] = { key: k, ...ll(v) };
  }
  keyToPt.start = { key: "start", ...start };

  const routeKeys = [
    "start",
    "frag1",
    "frag2",
    "frag4",
    "frag3",
    "frag5",
    "frag6",
    "P2",
    "P3",
    "frag7",
    "P10",
    "P8",
    "frag8",
    "P6",
    "P5",
    "frag10",
    "P3",
    "P2",
    "P1",
    "start",
  ];

  return routeKeys.map((k) => {
    if (!keyToPt[k]) throw new Error(`missing route point ${k}`);
    return keyToPt[k];
  });
}

export const DWELL_KEYS = new Set([
  "frag1",
  "frag2",
  "frag3",
  "frag4",
  "frag5",
  "frag6",
  "frag7",
  "frag8",
  "frag10",
]);
