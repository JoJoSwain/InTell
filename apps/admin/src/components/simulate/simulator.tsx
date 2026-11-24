"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SimulatorMap } from "@/components/simulate/simulator-map";
import { NarrationBar } from "@/components/simulate/narration-bar";
import { WebAudioEngine } from "@/lib/audio/webAudioEngine";
import {
  buildDemoWorld,
  DEMO_ORIGIN,
  MARSH_ZONE,
  URBAN_ZONE,
} from "@/lib/simulate/demoWorld";
import { gpxReplaySchedule, parseGpxTrack } from "@/lib/simulate/gpx";
import {
  createHarnessState,
  lastEvent,
  simulatorTick,
  type SimulatorHarnessState,
  type SimulatorWorld,
  type TimeWindow,
} from "@/lib/simulate/harness";
import type { SimulatorAssetUrl } from "@/lib/simulate/worldFromPacks";

const DEMO_GPX = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="40.96122185" lon="-111.93014661"><time>2026-06-15T17:00:00.000Z</time></trkpt>
<trkpt lat="40.96122158" lon="-111.93008051"><time>2026-06-15T17:00:04.000Z</time></trkpt>
<trkpt lat="40.96122130" lon="-111.93001440"><time>2026-06-15T17:00:08.000Z</time></trkpt>
<trkpt lat="40.96122103" lon="-111.92994830"><time>2026-06-15T17:00:12.000Z</time></trkpt>
<trkpt lat="40.96122075" lon="-111.92988219"><time>2026-06-15T17:00:16.000Z</time></trkpt>
<trkpt lat="40.96122048" lon="-111.92981609"><time>2026-06-15T17:00:20.000Z</time></trkpt>
<trkpt lat="40.96122020" lon="-111.92974998"><time>2026-06-15T17:00:24.000Z</time></trkpt>
<trkpt lat="40.96121993" lon="-111.92968388"><time>2026-06-15T17:00:28.000Z</time></trkpt>
</trkseg></trk></gpx>`;

type BusMute = Record<string, boolean>;

type WorldJson = {
  groveId: string;
  fragments: SimulatorWorld["fragments"];
  cues: SimulatorWorld["cues"];
  ambienceZones: SimulatorWorld["ambienceZones"];
  profiles: SimulatorWorld["profiles"];
  classToProfile: [string, string][];
  landcoverCells: SimulatorWorld["landcoverCells"];
  motifDaySha: string | null;
  motifNightSha: string | null;
  depthBloomTextureM: number;
  allowsSpeakerWildlife: boolean;
  hushIntervalMin: number;
};

function worldFromJson(json: WorldJson): SimulatorWorld {
  return {
    ...json,
    classToProfile: new Map(json.classToProfile),
  };
}

export function ListeningSimulator({
  groveId,
  groveName,
  initialMode = "demo",
  packError = null,
  worldJson,
  origin = DEMO_ORIGIN,
  breathByFragment = {},
  swellByFragment = {},
  assets = [],
}: {
  groveId: string;
  groveName: string;
  initialMode?: "pack" | "demo";
  packError?: string | null;
  worldJson?: WorldJson;
  origin?: { lat: number; lng: number };
  breathByFragment?: Record<string, number[]>;
  swellByFragment?: Record<string, number[]>;
  assets?: SimulatorAssetUrl[];
}) {
  const packWorld = useMemo(
    () => (worldJson ? worldFromJson(worldJson) : null),
    [worldJson],
  );
  const [useDemo, setUseDemo] = useState(initialMode === "demo" || !packWorld);
  const world = useMemo(
    () => (useDemo || !packWorld ? buildDemoWorld({ groveId }) : packWorld),
    [useDemo, packWorld, groveId],
  );
  const startOrigin = useDemo || !packWorld ? DEMO_ORIGIN : origin;
  const [state, setState] = useState<SimulatorHarnessState>(() =>
    createHarnessState(startOrigin, Date.parse("2026-06-15T17:00:00.000Z")),
  );
  const firstFrag = world.fragments[0]?.id;
  const [breathMs, setBreathMs] = useState<number[]>(
    () => (firstFrag && breathByFragment[firstFrag]) || [1200, 4800],
  );
  const [swellMs, setSwellMs] = useState<number[]>(
    () => (firstFrag && swellByFragment[firstFrag]) || [3000],
  );
  const [showH3, setShowH3] = useState(true);
  const [gpxSpeed, setGpxSpeed] = useState<1 | 4>(1);
  const [gpxPlaying, setGpxPlaying] = useState(false);
  const [busMute, setBusMute] = useState<BusMute>({});
  const [busSolo, setBusSolo] = useState<string | null>(null);
  const [assetWarnings, setAssetWarnings] = useState<string[]>([]);
  const engineRef = useRef<WebAudioEngine | null>(null);
  const gpxTimer = useRef<number | null>(null);
  const urlBySha = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assets) {
      if (a.url) m.set(a.sha, a.url);
    }
    return m;
  }, [assets]);

  const tick = useCallback(
    (patch: Parameters<typeof simulatorTick>[2]) => {
      setState((prev) => simulatorTick(prev, world, patch));
    },
    [world],
  );

  const playSha = useCallback(
    async (sha: string | null | undefined, bus: "story" | "music" | "surroundings" | "ui" | "moment") => {
      if (!sha || !engineRef.current) return;
      const url = urlBySha.get(sha) ?? "";
      const result = await engineRef.current.tryLoad(sha, url);
      if (!result.ok) {
        setAssetWarnings((w) =>
          w.includes(result.error) ? w : [...w.slice(-7), result.error],
        );
        return;
      }
      engineRef.current.playOneShot(result.handle, {
        bus,
        gainDb: bus === "moment" ? -8 : -6,
        pan: 0,
        rate: 1,
      });
    },
    [urlBySha],
  );

  useEffect(() => {
    tick({});
    const engine = new WebAudioEngine();
    engineRef.current = engine;
    void engine.init({ mixWithOthers: false });
    return () => {
      void engine.dispose();
      engineRef.current = null;
      if (gpxTimer.current != null) window.clearInterval(gpxTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    engineRef.current?.setRoute(
      state.route === "speaker" ? "speaker" : "headphones",
    );
  }, [state.route]);

  // Play motif / resolve / teaser / beacon when those events appear
  useEffect(() => {
    const motif = lastEvent(state, "motif");
    if (motif?.playSha) void playSha(motif.playSha, "moment");
    const resolve = lastEvent(state, "resolve");
    if (resolve?.kind === "asset") void playSha(resolve.detail, "moment");
    const teaser = lastEvent(state, "locked_teaser");
    if (teaser?.playSha) void playSha(teaser.playSha, "ui");
    const beaconEv = lastEvent(state, "beacon");
    if (beaconEv?.fragmentId) {
      const frag = world.fragments.find((f) => f.id === beaconEv.fragmentId);
      void playSha(frag?.beaconAssetSha, "ui");
    }
    // Only react to the latest event batch length as a cheap signal
    // eslint-disable-next-line react-hooks/exhaustive-deps -- event-driven
  }, [state.events.length]);

  function startGpx(speed: 1 | 4) {
    if (gpxTimer.current != null) window.clearInterval(gpxTimer.current);
    setGpxSpeed(speed);
    setGpxPlaying(true);
    const schedule = gpxReplaySchedule(parseGpxTrack(DEMO_GPX), speed);
    const t0 = performance.now();
    let i = 0;
    gpxTimer.current = window.setInterval(() => {
      const elapsed = performance.now() - t0;
      while (i < schedule.length - 1 && schedule[i + 1]!.tMs <= elapsed) i += 1;
      const step = schedule[i];
      if (!step) return;
      tick({
        lat: step.lat,
        lng: step.lng,
        atMs: state.atMs + step.tMs,
        gpx: { tMs: step.tMs, speed },
      });
      if (i >= schedule.length - 1) {
        if (gpxTimer.current != null) window.clearInterval(gpxTimer.current);
        setGpxPlaying(false);
      }
    }, 50);
  }

  const weights = lastEvent(state, "profile_weights")?.weights ?? [];
  const cue = lastEvent(state, "music_cue");
  const beacon = lastEvent(state, "beacon");
  const depth = lastEvent(state, "depth_bloom");
  const buffers = lastEvent(state, "buffer");
  const hush = lastEvent(state, "hush");
  const mix = lastEvent(state, "mix_level");
  const oneshot = lastEvent(state, "oneshot_cap");
  const stemGains = state.events.filter((e) => e.type === "stem_gain").slice(-4);

  const zones =
    world.ambienceZones.length > 0
      ? world.ambienceZones.map((z) => ({
          id: z.id,
          boundary: z.boundary,
          kind: "ambience" as const,
        }))
      : [
          { id: "marsh", boundary: MARSH_ZONE, kind: "ambience" as const },
          { id: "urban", boundary: URBAN_ZONE, kind: "ambience" as const },
        ];

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[640px] flex-col gap-0 lg:flex-row">
      <div className="relative min-h-[420px] flex-1 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl font-semibold">
            Listening Simulator
          </h1>
          <span className="text-sm text-textMuted">{groveName}</span>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useDemo}
              onChange={(e) => {
                setUseDemo(e.target.checked);
                setState(
                  createHarnessState(
                    e.target.checked ? DEMO_ORIGIN : origin,
                    Date.parse("2026-06-15T17:00:00.000Z"),
                  ),
                );
              }}
              aria-label="Use demo world"
            />
            Demo world
          </label>
          <label className="ml-auto flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showH3}
              onChange={(e) => setShowH3(e.target.checked)}
              aria-label="Show H3 overlay"
            />
            H3 overlay
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={gpxPlaying}
            onClick={() => startGpx(1)}
            aria-label="GPX replay 1x"
          >
            GPX 1×
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={gpxPlaying}
            onClick={() => startGpx(4)}
            aria-label="GPX replay 4x"
          >
            GPX 4×
          </Button>
        </div>
        <SimulatorMap
          walker={{ lat: state.lat, lng: state.lng }}
          onWalkerChange={(p) => tick({ lat: p.lat, lng: p.lng })}
          fragments={world.fragments}
          zones={zones}
          showH3={showH3}
        />
      </div>

      <aside
        className="w-full shrink-0 overflow-y-auto border-l border-border bg-background p-4 lg:w-96"
        aria-label="Simulator rail"
      >
        {packError ? (
          <p
            className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            role="status"
          >
            {packError}
          </p>
        ) : null}
        {assetWarnings.length > 0 ? (
          <ul
            className="mb-4 space-y-1 rounded-md border border-border px-3 py-2 text-xs text-textMuted"
            aria-label="Asset warnings"
          >
            {assetWarnings.map((w) => (
              <li key={w}>{w} — layer silent</li>
            ))}
          </ul>
        ) : null}
        <section className="space-y-3" aria-labelledby="story-state-heading">
          <h2 id="story-state-heading" className="font-serif text-lg font-semibold">
            Story state
          </h2>
          <fieldset className="space-y-1">
            <legend className="text-xs text-textMuted">Completed</legend>
            {world.fragments.map((f) => (
              <label key={f.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.completed.has(f.id)}
                  aria-label={`Completed ${f.title}`}
                  onChange={(e) => {
                    if (e.target.checked) {
                      tick({ completeFragmentId: f.id });
                    } else {
                      setState((prev) => {
                        const completed = new Set(prev.completed);
                        completed.delete(f.id);
                        return simulatorTick(
                          { ...prev, completed },
                          world,
                          {},
                        );
                      });
                    }
                  }}
                />
                {f.title}{" "}
                <span className="text-textMuted">({f.tier})</span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            {(["day", "night"] as TimeWindow[]).map((w) => (
              <Button
                key={w}
                type="button"
                size="sm"
                variant={state.forcedWindow === w ? "default" : "outline"}
                aria-label={`Time window ${w}`}
                onClick={() => tick({ forcedWindow: w })}
              >
                {w}
              </Button>
            ))}
          </div>

          <label className="block text-sm">
            Month
            <input
              type="number"
              min={1}
              max={12}
              value={state.month}
              aria-label="Month"
              onChange={(e) => tick({ month: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={state.route !== "speaker" ? "default" : "outline"}
              aria-label="Headphones route"
              onClick={() => tick({ route: "headphones" })}
            >
              Headphones
            </Button>
            <Button
              type="button"
              size="sm"
              variant={state.route === "speaker" ? "default" : "outline"}
              aria-label="Speaker route"
              onClick={() => tick({ route: "speaker" })}
            >
              Speaker
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.beaconsEnabled}
              aria-label="Beacons on"
              onChange={(e) => tick({ beaconsEnabled: e.target.checked })}
            />
            Beacons on
          </label>

          <label className="block text-sm">
            Depth (m)
            <input
              type="number"
              step="0.5"
              value={state.depthM}
              aria-label="Depth metres"
              onChange={(e) => tick({ depthM: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1"
            />
          </label>
        </section>

        <section className="mt-6 space-y-2 text-sm" aria-labelledby="live-heading">
          <h2 id="live-heading" className="font-serif text-lg font-semibold">
            Live
          </h2>
          <p>
            <span className="text-textMuted">Profiles: </span>
            {weights.map((w) => `${w.profileSlug} ${(w.weight * 100).toFixed(0)}%`).join(", ") ||
              "—"}
          </p>
          <p>
            <span className="text-textMuted">Oneshots: </span>
            {oneshot?.active ?? 0}/2
            {oneshot?.denied ? " (capped)" : ""}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-2"
              aria-label="Fire oneshot"
              onClick={() => tick({ oneshotRequest: true })}
            >
              Fire
            </Button>
          </p>
          <p>
            <span className="text-textMuted">Cue: </span>
            {cue?.cueId ?? "—"}
            {cue?.deferred ? " (deferred)" : ""}
          </p>
          <ul className="font-mono text-xs">
            {stemGains.map((s) =>
              s.type === "stem_gain" ? (
                <li key={`stem-${s.stemIndex}`}>
                  stem {s.stemIndex}: {s.gainDb.toFixed(1)} dB
                </li>
              ) : null,
            )}
          </ul>
          <p>
            <span className="text-textMuted">Depth bloom: </span>
            {depth?.inside ? "inside" : "outside"} ({depth?.depthM ?? 0} m)
          </p>
          <p>
            <span className="text-textMuted">Buffers: </span>
            {(buffers?.tiers ?? []).join(", ") || "—"}
          </p>
          <p>
            <span className="text-textMuted">Beacon: </span>
            {beacon?.fragmentId ?? "—"} · pan {beacon?.pan?.toFixed(2) ?? "—"} ·{" "}
            {beacon && Number.isFinite(beacon.gainDb)
              ? `${beacon.gainDb.toFixed(1)} dB`
              : "silent"}
          </p>
          <p>
            <span className="text-textMuted">Hush: </span>
            {hush?.phase ?? "idle"}
          </p>
          <p>
            <span className="text-textMuted">Mix shed: </span>
            {(mix?.shed ?? []).join(", ") || "none"} (index {mix?.shedIndex ?? 0})
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Enter grove motif"
              onClick={() => tick({ enterGrove: true, depthM: Math.max(state.depthM, 12) })}
            >
              Enter grove
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="End narration"
              onClick={() => tick({ endNarration: true })}
            >
              End narration
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Locked teaser"
              onClick={() =>
                tick({ lockedTeaserTap: { fragmentId: "frag-locked" } })
              }
            >
              Locked teaser
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Stress mix ladder"
              onClick={() => tick({ clockStarving: true })}
            >
              Stress mix
            </Button>
          </div>
        </section>

        <section className="mt-6 space-y-2" aria-labelledby="buses-heading">
          <h2 id="buses-heading" className="font-serif text-lg font-semibold">
            Buses
          </h2>
          {(["story", "music", "surroundings", "ui", "moment"] as const).map(
            (bus) => (
              <div key={bus} className="flex items-center gap-2 text-sm">
                <span className="w-28 capitalize">{bus}</span>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(busMute[bus])}
                    aria-label={`Mute ${bus}`}
                    onChange={(e) => {
                      setBusMute((m) => ({ ...m, [bus]: e.target.checked }));
                      engineRef.current?.setGain(
                        bus,
                        e.target.checked ? -120 : 0,
                        50,
                      );
                    }}
                  />
                  Mute
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="bus-solo"
                    checked={busSolo === bus}
                    aria-label={`Solo ${bus}`}
                    onChange={() => setBusSolo(bus)}
                  />
                  Solo
                </label>
              </div>
            ),
          )}
        </section>

        <div className="mt-6">
          <NarrationBar
            breathMs={breathMs}
            swellMs={swellMs}
            durationMs={12_000}
            playheadMs={state.narrationPositionMs}
            onBreathChange={(ms) => {
              setBreathMs(ms);
              tick({ breathPointsMs: ms });
            }}
            onSwellChange={setSwellMs}
          />
        </div>

        <p className="mt-4 font-mono text-[10px] text-textMuted">
          GPX {gpxSpeed}× {gpxPlaying ? "playing" : "idle"} · walker{" "}
          {state.lat.toFixed(5)}, {state.lng.toFixed(5)}
        </p>
      </aside>
    </div>
  );
}
