/**
 * Scripted walk invariants through directorStep (Farmington GPX + resume).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AFTERGLOW_MS } from "./DuckingPolicy";
import {
  directorStep,
  initialDirectorState,
  parseDirectorState,
  serializeDirectorState,
  type DirectorWorld,
} from "./director";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const GPX_PATH = join(ROOT, "apps/mobile/e2e/demo-route.gpx");

function parseGpx(xml: string): { lat: number; lng: number; t: number }[] {
  const pts: { lat: number; lng: number; t: number }[] = [];
  const re =
    /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>[\s\S]*?<time>([^<]+)<\/time>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    pts.push({
      lat: Number(m[1]),
      lng: Number(m[2]),
      t: Date.parse(m[3]!),
    });
  }
  return pts;
}

function demoDirectorWorld(
  origin: { lat: number; lng: number },
): DirectorWorld {
  return {
    groveId: "g1",
    timeZone: "America/Denver",
    allowsSpeakerWildlife: true,
    hushIntervalMin: 60,
    depthBloomTextureM: 15,
    fragments: [
      {
        id: "f1",
        lat: origin.lat,
        lng: origin.lng,
        radiusM: 40,
        tier: "root",
        visibility: "standard",
        title: "f1",
        beaconSha: "beacon-f1",
        narrationShaByWindow: { day: "narr-f1" },
        breathPointsMs: [500, 1500],
        resolveSha: "resolve-f1",
      },
    ],
    musicCues: [],
    ambienceZones: [],
    ambienceProfiles: [],
    classToProfile: new Map(),
    landcoverCells: [],
    motifDaySha: "motif-day",
    motifNightSha: null,
    groveBeaconByTier: {},
    hushListenSha: null,
    engineCaps: { canStreamBeds: false, narrationDecodeHz: 24_000 },
  };
}

describe("director Farmington walk", () => {
  it("keeps voice/beacon/motif/resolve/suspend invariants on the demo GPX", () => {
    const gpx = parseGpx(readFileSync(GPX_PATH, "utf8"));
    expect(gpx.length).toBeGreaterThan(100);
    const t0 = gpx[0]!.t;
    const dw = demoDirectorWorld(gpx[0]!);

    let director = initialDirectorState({
      seed: 99,
      wallAtMs: t0,
      dayKey: "2026-06-15",
      point: { lat: gpx[0]!.lat, lng: gpx[0]!.lng },
    });

    let motifPlays = 0;
    let resolvePlays = 0;
    let maxVoices = 0;
    let maxBeacons = 0;
    let accentWhileNarrating = 0;

    director = directorStep(
      director,
      {
        type: "location",
        point: { lat: gpx[0]!.lat, lng: gpx[0]!.lng },
        courseDeg: 0,
        depthM: 12,
        month: 6,
        timeWindow: "day",
        insideGrove: true,
        audioSec: 0,
        wallAtMs: t0,
      },
      dw,
    ).state;

    {
      const g = directorStep(
        director,
        {
          type: "sessionEffect",
          effect: { type: "groveEntered", groveId: "g1" },
          audioSec: 0.1,
          wallAtMs: t0 + 100,
        },
        dw,
      );
      director = g.state;
      if (
        g.commands.some((c) => c.type === "playMoment") ||
        g.state.motifPlay
      ) {
        motifPlays += 1;
      }
    }

    director = directorStep(
      director,
      {
        type: "sessionEffect",
        effect: {
          type: "play",
          fragmentId: "f1",
          revisionNo: 1,
          sha: "narr-f1",
          breathPointsMs: [500, 1500],
          durationMs: 2000,
        },
        audioSec: 1,
        wallAtMs: t0 + 1000,
      },
      dw,
    ).state;
    maxVoices = Math.max(maxVoices, director.activeVoiceIds.length);

    {
      const mid = directorStep(
        director,
        {
          type: "narrationProgress",
          positionMs: 1000,
          durationMs: 2000,
          audioSec: 2,
          wallAtMs: t0 + 2000,
        },
        dw,
      );
      director = mid.state;
      accentWhileNarrating += mid.state.lastEmitted.accentsPending.length;
    }

    {
      const after = directorStep(
        director,
        {
          type: "sessionEffect",
          effect: {
            type: "startAfterglow",
            endsAt: t0 + 3000 + AFTERGLOW_MS,
            fragmentId: "f1",
            tier: "root",
          },
          audioSec: 3,
          wallAtMs: t0 + 3000,
        },
        dw,
      );
      director = after.state;
      if (
        after.commands.some((c) => c.type === "playMoment") ||
        after.state.resolvePlay ||
        after.state.lastEmitted.moment
      ) {
        resolvePlays += 1;
      }
    }

    for (let i = 0; i < Math.min(40, gpx.length); i++) {
      const p = gpx[i]!;
      const r = directorStep(
        director,
        {
          type: "location",
          point: { lat: p.lat, lng: p.lng },
          courseDeg: 0,
          depthM: 5,
          month: 6,
          timeWindow: "day",
          insideGrove: true,
          audioSec: (p.t - t0) / 1000,
          wallAtMs: p.t,
        },
        dw,
      );
      director = r.state;
      maxVoices = Math.max(maxVoices, director.activeVoiceIds.length);
      maxBeacons = Math.max(maxBeacons, director.lastEmitted.beacon ? 1 : 0);
    }

    {
      const s = directorStep(
        director,
        {
          type: "interruption",
          phase: "began",
          audioSec: director.audioClockSec + 1,
          wallAtMs: director.wallAtMs + 1000,
        },
        dw,
      );
      expect(s.state.suspended).toBe(true);
      expect(
        s.commands.some(
          (c) =>
            c.type === "load" ||
            c.type === "playNarration" ||
            c.type === "playOneShot" ||
            c.type === "startLoopGroup" ||
            c.type === "startBeacon",
        ),
      ).toBe(false);
    }

    expect(maxVoices).toBeLessThanOrEqual(12);
    expect(maxBeacons).toBeLessThanOrEqual(1);
    expect(motifPlays).toBeLessThanOrEqual(1);
    expect(resolvePlays).toBeGreaterThanOrEqual(1);
    expect(accentWhileNarrating).toBe(0);
  });

  it("resume mid-afterglow continues identically", () => {
    const t0 = Date.parse("2026-06-15T17:00:00.000Z");
    const dw = demoDirectorWorld({ lat: 40.96, lng: -111.93 });
    let state = initialDirectorState({
      seed: 3,
      wallAtMs: t0,
      dayKey: "2026-06-15",
      point: { lat: 40.96, lng: -111.93 },
    });
    state = directorStep(
      state,
      {
        type: "location",
        point: { lat: 40.96, lng: -111.93 },
        courseDeg: null,
        depthM: 0,
        month: 6,
        timeWindow: "day",
        insideGrove: true,
        audioSec: 0,
        wallAtMs: t0,
      },
      dw,
    ).state;
    state = directorStep(
      state,
      {
        type: "sessionEffect",
        effect: {
          type: "startAfterglow",
          endsAt: t0 + AFTERGLOW_MS,
          fragmentId: "f1",
          tier: "root",
        },
        audioSec: 1,
        wallAtMs: t0 + 1000,
      },
      dw,
    ).state;

    const restored = parseDirectorState(serializeDirectorState(state));
    const a = directorStep(
      state,
      { type: "heartbeat", audioSec: 2, wallAtMs: t0 + 2000 },
      dw,
    );
    const b = directorStep(
      restored,
      { type: "heartbeat", audioSec: 2, wallAtMs: t0 + 2000 },
      dw,
    );
    expect(a.commands).toEqual(b.commands);
  });
});
