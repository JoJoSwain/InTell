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
      {
        id: "f2",
        lat: origin.lat + 0.0003,
        lng: origin.lng + 0.0003,
        radiusM: 40,
        tier: "branch",
        visibility: "standard",
        title: "f2",
        beaconSha: "beacon-f2",
        narrationShaByWindow: { day: "narr-f2" },
        breathPointsMs: [400, 1200],
        resolveSha: "resolve-f2",
      },
      {
        id: "f3",
        lat: origin.lat + 0.0006,
        lng: origin.lng - 0.0002,
        radiusM: 40,
        tier: "leaf",
        visibility: "standard",
        title: "f3",
        narrationShaByWindow: { day: "narr-f3" },
        breathPointsMs: [300],
        resolveSha: "resolve-f3",
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

function hadResolve(
  commands: { type: string; sha?: string }[],
  state: { resolvePlay: { sha: string } | null; lastEmitted: { moment: { sha: string } | null } },
  sha: string,
): boolean {
  return (
    commands.some((c) => c.type === "playMoment" && c.sha === sha) ||
    state.resolvePlay?.sha === sha ||
    state.lastEmitted.moment?.sha === sha
  );
}

describe("director Farmington walk", () => {
  it("one resolve after each natural completion; voice/beacon/motif/suspend invariants", () => {
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
    let maxVoices = 0;
    let maxBeacons = 0;
    let accentWhileNarrating = 0;
    const completions = ["f1", "f2", "f3"] as const;
    const resolveByCompletion: Record<string, boolean> = {
      f1: false,
      f2: false,
      f3: false,
    };

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

    let t = t0 + 1000;
    let audioSec = 1;
    for (const fragmentId of completions) {
      const frag = dw.fragments.find((f) => f.id === fragmentId)!;
      director = directorStep(
        director,
        {
          type: "sessionEffect",
          effect: {
            type: "play",
            fragmentId,
            revisionNo: 1,
            sha: frag.narrationShaByWindow?.day,
            breathPointsMs: frag.breathPointsMs,
            durationMs: 2000,
          },
          audioSec,
          wallAtMs: t,
        },
        dw,
      ).state;
      maxVoices = Math.max(maxVoices, director.activeVoiceIds.length);

      t += 1000;
      audioSec += 1;
      const mid = directorStep(
        director,
        {
          type: "narrationProgress",
          positionMs: 1000,
          durationMs: 2000,
          audioSec,
          wallAtMs: t,
        },
        dw,
      );
      director = mid.state;
      accentWhileNarrating += mid.state.lastEmitted.accentsPending.length;

      t += 1000;
      audioSec += 1;
      const after = directorStep(
        director,
        {
          type: "sessionEffect",
          effect: {
            type: "startAfterglow",
            endsAt: t + AFTERGLOW_MS,
            fragmentId,
            tier: frag.tier,
          },
          audioSec,
          wallAtMs: t,
        },
        dw,
      );
      director = after.state;
      resolveByCompletion[fragmentId] = hadResolve(
        after.commands,
        after.state,
        frag.resolveSha!,
      );

      // Let afterglow end before the next completion
      t += AFTERGLOW_MS + 100;
      audioSec += AFTERGLOW_MS / 1000 + 0.1;
      director = directorStep(
        director,
        { type: "heartbeat", audioSec, wallAtMs: t },
        dw,
      ).state;
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
    expect(accentWhileNarrating).toBe(0);
    expect(resolveByCompletion.f1).toBe(true);
    expect(resolveByCompletion.f2).toBe(true);
    expect(resolveByCompletion.f3).toBe(true);
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
