import { describe, expect, it } from "vitest";
import { gpxReplaySchedule, parseGpxTrack } from "./gpx";

const SAMPLE = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="40.96122" lon="-111.93014"><time>2026-06-15T17:00:00.000Z</time></trkpt>
<trkpt lat="40.96122" lon="-111.93000"><time>2026-06-15T17:00:04.000Z</time></trkpt>
<trkpt lat="40.96122" lon="-111.92980"><time>2026-06-15T17:00:08.000Z</time></trkpt>
</trkseg></trk></gpx>`;

describe("GPX replay", () => {
  it("parses track points", () => {
    const pts = parseGpxTrack(SAMPLE);
    expect(pts).toHaveLength(3);
    expect(pts[0]?.lat).toBeCloseTo(40.96122, 5);
  });

  it("4× compresses wall-clock schedule by 4", () => {
    const pts = parseGpxTrack(SAMPLE);
    const one = gpxReplaySchedule(pts, 1);
    const four = gpxReplaySchedule(pts, 4);
    expect(one.at(-1)!.tMs).toBe(8000);
    expect(four.at(-1)!.tMs).toBe(2000);
    expect(four[1]!.lat).toBe(one[1]!.lat);
  });
});
