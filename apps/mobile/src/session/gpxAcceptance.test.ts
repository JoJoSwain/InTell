/**
 * M6 BUILD_PLAN acceptance via the mobile shell (GPX + simulated ends).
 * Emulator Maestro still used for UI; this covers the machine + effect wiring.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AFTERGLOW_MS,
  OUTSIDE_END_MS,
  groveShape,
  initialSessionState,
  parseSessionState,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
  type SessionWorld,
  type CompletionRow,
  type FragmentInput,
  type UnlockRow,
} from "@intell/shared";
import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { applySessionEffects } from "./applySessionEffects";
import { sessionJsonForDisk } from "./persist";
import { stepSession, withSessionId } from "./sessionShell";

const MOBILE = process.cwd(); // jest runs with cwd apps/mobile
const REPO = join(MOBILE, "../..");
const GPX_PATH = join(MOBILE, "e2e/demo-route.gpx");
const FIXTURE_PATH = join(REPO, "supabase/fixtures/farmington-bird-refuge.json");
const MEDIA_PATH = join(REPO, "supabase/seed-media.json");
const GROVE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SESSION_ID = "walk-session-1";
const T0 = Date.parse("2026-06-15T17:00:00.000Z");

type FixtureFrag = {
  key: string;
  tier: "root" | "branch" | "leaf";
  at: [number, number];
  visibility: "standard" | "physical";
  radius_m: number;
  requires: string[][];
  marker_code?: string;
};

function parseGpx(xml: string): { lat: number; lng: number; at: number }[] {
  const points: { lat: number; lng: number; at: number }[] = [];
  const re =
    /<trkpt lat="([^"]+)" lon="([^"]+)"><ele>[^<]*<\/ele><time>([^<]+)<\/time><\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    points.push({ lat: Number(m[1]), lng: Number(m[2]), at: Date.parse(m[3]!) });
  }
  return points;
}

function markerHash(code: string): string {
  return createHash("sha256").update(code.toUpperCase(), "utf8").digest("hex");
}

function buildWorld(): {
  world: SessionWorld;
  durations: Record<string, number>;
} {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as { fragments: FixtureFrag[] };
  const media = JSON.parse(readFileSync(MEDIA_PATH, "utf8")) as {
    assets: Record<string, { duration_ms: number }>;
  };
  const fragments: FragmentInput[] = fixture.fragments.map((f) => {
    const versions =
      f.key === "frag8"
        ? [{ lang: "en" as const, timeWindow: "day" as const }]
        : [
            { lang: "en" as const, timeWindow: "day" as const },
            { lang: "en" as const, timeWindow: "night" as const },
          ];
    return {
      id: f.key,
      groveId: GROVE_ID,
      tier: f.tier,
      visibility: f.visibility,
      retired: false,
      lat: f.at[0]!,
      lng: f.at[1]!,
      ...(f.visibility === "standard" ? { radiusM: f.radius_m } : {}),
      requires: f.requires.map((g) => [...g]),
      threadIds: [],
      contingencyRevisionNo: f.key === "frag10" ? 2 : 1,
      versions,
    };
  });
  const boundary = groveShape(
    fragments.map((f) => ({ id: f.id, tier: f.tier, lat: f.lat, lng: f.lng })),
  );
  if (!boundary) throw new Error("groveShape null");
  const markers: Record<string, string> = {};
  const frag9 = fixture.fragments.find((f) => f.key === "frag9");
  if (frag9?.marker_code) markers[markerHash(frag9.marker_code)] = "frag9";
  const fragmentMeta: Record<string, { revisionNo: number; changeTeaser?: string }> = {};
  const durations: Record<string, number> = {};
  for (const f of fixture.fragments) {
    fragmentMeta[f.key] = {
      revisionNo: f.key === "frag10" ? 2 : f.key === "frag4" ? 2 : 1,
      ...(f.key === "frag10" ? { changeTeaser: "the path forked again" } : {}),
    };
    durations[f.key] = media.assets[`narration_${f.key}`]?.duration_ms ?? 2_000;
  }
  return {
    world: {
      groves: [{ id: GROVE_ID, boundary }],
      fragments,
      fragmentMeta,
      externalPrerequisites: [],
      markers,
      completions: [],
      unlocks: [],
      timeWindow: "day",
      lang: "en",
      settings: {
        accessibleTrigger: false,
        locationAvailable: true,
        accuracyToleranceM: 25,
      },
    },
    durations,
  };
}

function applyWorldEffects(world: SessionWorld, effects: SessionEffect[]): SessionWorld {
  let completions: CompletionRow[] = [...world.completions];
  let unlocks: UnlockRow[] = [...world.unlocks];
  for (const e of effects) {
    if (e.type === "recordCompletion") {
      completions = [
        ...completions,
        {
          fragmentId: e.fragmentId,
          revisionNo: e.revisionNo,
          timeWindow: e.timeWindow,
          onSite: true,
        },
      ];
    }
    if (e.type === "writeUnlocks") {
      for (const id of e.fragmentIds) {
        if (!unlocks.some((u) => u.fragmentId === id)) unlocks = [...unlocks, { fragmentId: id }];
      }
    }
  }
  return { ...world, completions, unlocks };
}

type Pending = { kind: "end"; at: number; playedMs: number } | { kind: "afterglow"; at: number };

async function runWalk(opts?: {
  nightAfterFrag7?: boolean;
  locationDenied?: boolean;
}): Promise<{ plays: string[]; allEffects: SessionEffect[]; state: SessionState }> {
  let { world, durations } = buildWorld();
  if (opts?.locationDenied) {
    world = {
      ...world,
      settings: { ...world.settings, locationAvailable: false },
    };
  }
  const gpx = parseGpx(readFileSync(GPX_PATH, "utf8"));
  const db = openNodeSqlite();
  await migrate(db);

  let state = initialSessionState();
  const allEffects: SessionEffect[] = [];
  const plays: string[] = [];
  const pending: Pending[] = [];
  let nightFlipped = false;
  let locationMode = "foreground";
  let locationStoppedAt: number | null = null;
  let sessionEndedAt: number | null = null;

  async function dispatch(event: SessionEvent): Promise<void> {
    const enriched = withSessionId(event, state.phase, () => SESSION_ID);
    const result = stepSession(state, enriched, world);
    state = result.state;
    allEffects.push(...result.effects);
    world = applyWorldEffects(world, result.effects);
    await applySessionEffects(result.effects, {
      db,
      nowIso: () => new Date().toISOString(),
      setLocationMode: (m) => {
        locationMode = m;
        if (m === "idle") locationStoppedAt = enriched.type === "tick" || enriched.type === "stop" || enriched.type === "fix" ? (enriched as { at: number }).at : Date.now();
      },
      onPlay: async (play) => {
        plays.push(play.fragmentId);
      },
      onStopNarration: async () => undefined,
      onTeaser: () => undefined,
      onAfterglow: () => undefined,
      onUnlockBanner: () => undefined,
      resolveTeaserCopy: () => ({ teaserText: "teaser" }),
      onAnalytics: () => undefined,
    });
    for (const e of result.effects) {
      if (e.type === "play" && state.playing) {
        const dur = durations[e.fragmentId] ?? 2_000;
        pending.push({ kind: "end", at: state.playing.startedAt + dur, playedMs: dur });
      }
      if (e.type === "startAfterglow") pending.push({ kind: "afterglow", at: e.endsAt });
      if (e.type === "sessionEnded") sessionEndedAt = e.at;
    }
    pending.sort((a, b) => a.at - b.at);
    // R1: disk JSON has no recentFixes coords
    const disk = sessionJsonForDisk(state);
    expect(parseSessionState(JSON.parse(disk)).recentFixes).toEqual([]);
  }

  async function drainUntil(until: number): Promise<void> {
    while (pending.length > 0 && pending[0]!.at <= until) {
      const p = pending.shift()!;
      if (p.kind === "end" && state.playing) {
        await dispatch({
          type: "narrationEnded",
          at: p.at,
          reason: "natural",
          playedMs: p.playedMs,
        });
      } else if (p.kind === "afterglow") {
        await dispatch({ type: "afterglowElapsed", at: p.at });
      }
    }
  }

  for (let i = 0; i < gpx.length; i++) {
    const pt = gpx[i]!;
    const at = pt.at || T0 + i * 1000;
    await drainUntil(at);
    if (
      opts?.nightAfterFrag7 &&
      !nightFlipped &&
      plays.includes("frag7") &&
      !state.playing &&
      state.afterglowEndsAt === null
    ) {
      world = { ...world, timeWindow: "night" };
      await dispatch({ type: "windowChanged", at, timeWindow: "night" });
      nightFlipped = true;
    }
    await dispatch({
      type: "fix",
      at,
      lat: pt.lat,
      lng: pt.lng,
      accuracyM: 5,
    });
  }
  if (pending.length > 0) await drainUntil(pending[pending.length - 1]!.at);

  const leaveAt = (state.lastInsideGroveAt ?? T0) + 1_000;
  await dispatch({
    type: "fix",
    at: leaveAt,
    lat: 40.95,
    lng: -111.95,
    accuracyM: 5,
  });
  await dispatch({ type: "tick", at: leaveAt + OUTSIDE_END_MS });

  void locationMode;
  void AFTERGLOW_MS;
  if (sessionEndedAt != null && locationStoppedAt != null) {
    expect(locationStoppedAt - sessionEndedAt).toBeLessThanOrEqual(5_000);
  }

  return { plays, allEffects, state };
}

describe("M6 GPX acceptance (shell)", () => {
  it("plays unlocked once in order; locked/physical never; no overlap; ends idle", async () => {
    const { plays, allEffects, state } = await runWalk();
    expect(plays).not.toContain("frag9");
    expect(plays).toEqual([
      "frag1",
      "frag2",
      "frag4",
      "frag3",
      "frag5",
      "frag6",
      "frag7",
      "frag8",
      "frag10",
    ]);
    expect(new Set(plays).size).toBe(plays.length);
    expect(state.phase).toBe("idle");
    expect(allEffects.some((e) => e.type === "sessionEnded")).toBe(true);
    expect(allEffects.some((e) => e.type === "writeVisit")).toBe(true);
  });

  it("Day-only frag8 silent at night", async () => {
    const { plays } = await runWalk({ nightAfterFrag7: true });
    expect(plays).toContain("frag7");
    expect(plays).not.toContain("frag8");
  });

  it("location denied: proximity off (no plays from GPX)", async () => {
    const { plays } = await runWalk({ locationDenied: true });
    expect(plays).toEqual([]);
  });

  it("locked marker scan shows teaser only", async () => {
    let { world } = buildWorld();
    const db = openNodeSqlite();
    await migrate(db);
    let state = initialSessionState();
    let teaser: { fragmentId: string; reason: string } | null = null as {
      fragmentId: string;
      reason: string;
    } | null;
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as { fragments: FixtureFrag[] };
    const frag9 = fixture.fragments.find((f) => f.key === "frag9")!;
    const hash = markerHash(frag9.marker_code!);
    const event: SessionEvent = { type: "scan", at: T0, markerHash: hash, sessionId: SESSION_ID };
    const result = stepSession(state, event, world);
    state = result.state;
    await applySessionEffects(result.effects, {
      db,
      nowIso: () => new Date().toISOString(),
      setLocationMode: () => undefined,
      onPlay: async () => {
        throw new Error("must not play locked");
      },
      onStopNarration: async () => undefined,
      onTeaser: (t) => {
        teaser = t ? { fragmentId: t.fragmentId, reason: t.reason } : null;
      },
      onAfterglow: () => undefined,
      onUnlockBanner: () => undefined,
      resolveTeaserCopy: () => ({ teaserText: "locked whisper" }),
      onAnalytics: () => undefined,
    });
    expect(teaser?.fragmentId).toBe("frag9");
    expect(teaser?.reason).toBe("locked");
    expect(result.effects.some((e) => e.type === "play")).toBe(false);
  });

  it("accessible trigger fires within 35 ft on a single fix", async () => {
    let { world, durations } = buildWorld();
    world = {
      ...world,
      settings: { ...world.settings, accessibleTrigger: true },
      unlocks: world.fragments.map((f) => ({ fragmentId: f.id })),
    };
    // Place one fix inside ACCESSIBLE_RADIUS of frag1
    const frag1 = world.fragments.find((f) => f.id === "frag1")!;
    let state = initialSessionState();
    const result = stepSession(
      state,
      {
        type: "fix",
        at: T0,
        lat: frag1.lat,
        lng: frag1.lng,
        accuracyM: 5,
        sessionId: SESSION_ID,
      },
      world,
    );
    expect(result.effects.some((e) => e.type === "play" && e.fragmentId === "frag1")).toBe(true);
    expect(result.effects.find((e) => e.type === "play" && "via" in e && e.via === "accessible")).toBeTruthy();
    void durations;
  });
});
