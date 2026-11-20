import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DWELL_KEYS,
  STEP_M,
  buildTrack,
  buildWaypoints,
  dwellSeconds,
  haversineM,
  ll,
} from "./track.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(root, "supabase/fixtures/farmington-bird-refuge.json"),
    "utf8",
  ),
);
const media = JSON.parse(
  fs.readFileSync(path.join(root, "supabase/seed-media.json"), "utf8"),
);

describe("demo-geometry GPX track", () => {
  const waypoints = buildWaypoints(fixture);
  const track = buildTrack(waypoints, DWELL_KEYS, media);

  it("keeps consecutive points ≤ 2 m apart (no teleport)", () => {
    for (let i = 1; i < track.length; i++) {
      const d = haversineM(track[i - 1], track[i]);
      expect(d, `jump at index ${i - 1}→${i}: ${d.toFixed(2)} m`).toBeLessThanOrEqual(2);
    }
  });

  it("dwells ≥ narration+5s inside each proximity (non-physical) fragment radius", () => {
    for (const frag of fixture.fragments) {
      // Physical fragments never proximity-trigger (ADR / PRODUCT_SPEC); GPX skips them.
      if (frag.visibility === "physical") continue;
      const center = ll(frag.at);
      const need = dwellSeconds(frag.key, media);
      let best = 0;
      let run = 0;
      for (const p of track) {
        if (haversineM(p, center) <= frag.radius_m) {
          run += 1;
          if (run > best) best = run;
        } else {
          run = 0;
        }
      }
      expect(
        best,
        `${frag.key} longest stay ${best}s < required ${need}s`,
      ).toBeGreaterThanOrEqual(need);
    }
  });

  it("never enters frag9 physical radius (marker-only)", () => {
    const frag9 = fixture.fragments.find((f) => f.key === "frag9");
    expect(frag9).toBeTruthy();
    expect(frag9.visibility).toBe("physical");
    const center = ll(frag9.at);
    for (let i = 0; i < track.length; i++) {
      const d = haversineM(track[i], center);
      expect(d, `point ${i} within frag9 (${d.toFixed(2)} m)`).toBeGreaterThan(
        frag9.radius_m,
      );
    }
  });

  it("uses 1.4 m step pacing", () => {
    expect(STEP_M).toBe(1.4);
  });
});
