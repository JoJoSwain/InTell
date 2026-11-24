import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { Redirect } from "expo-router";
import type {
  EngineDiagnostics,
  LoopGroupHandle,
  VoiceHandle,
} from "@intell/shared";
import {
  hashSeed,
  ONESHOT_LOOKAHEAD_SEC,
  ONESHOT_MAX_PENDING,
  ONESHOT_STRESS_LOOKAHEAD_SEC,
  ONESHOT_STRESS_MAX_PENDING,
  OneShotWindowScheduler,
} from "@intell/shared";
import {
  MediaElementBed,
  RNAudioApiEngine,
  type StreamBedLoopEvent,
} from "../../src/audio/engine";
import { SPIKE_ASSET_MODULES } from "../../src/audio/spike/assets";
import {
  FIXTURES_MISSING_MESSAGE,
  spikeAssetModulesReady,
} from "../../src/audio/spike/fixturesReady";
import {
  appendDiagnostics,
  appendDiagnosticsIfDue,
  appendSpikeLog,
  resetDiagnosticsTickClock,
  shareSpikeLog,
} from "../../src/audio/spike/logger";

/** Fixed seed so one-shot schedules are reproducible across runs. */
const SPIKE_ONESHOT_SEED = hashSeed("intell-audio-spike");
const STRESS_BUDGET = 40;
const NORMAL_BUDGET = 12;
/** T1 default: decode narration at half rate to cut PCM footprint. */
const NARRATION_DECODE_RATE_HZ = 24_000;
/** T1c local AAC bed (push to app files/spikes/ before the run). */
const STREAM_BED_URI =
  "file:///sdcard/Android/data/org.replaceplace.intell/files/spikes/probe-bed-2min-stereo.m4a";

/** Release builds only enable this route when EXPO_PUBLIC_AUDIO_SPIKE=1 at build time. */
const SPIKE_ALLOWED =
  __DEV__ || process.env.EXPO_PUBLIC_AUDIO_SPIKE === "1";

function clockFields(d: EngineDiagnostics): {
  contextTimeMs: number | undefined;
  wallElapsedMs: number | undefined;
  clockGapMs: number | undefined;
} {
  return {
    contextTimeMs: d.contextTimeMs,
    wallElapsedMs: d.wallElapsedMs,
    clockGapMs: d.clockGapMs,
  };
}

/**
 * Hidden audio spike screen. Deep link: intell://dev/audio-spike
 * Never enabled in store builds (requires EXPO_PUBLIC_AUDIO_SPIKE=1).
 */
export default function AudioSpikeScreen() {
  if (!SPIKE_ALLOWED) {
    return <Redirect href="/" />;
  }
  return <AudioSpikeBody />;
}

function AudioSpikeBody() {
  const engineRef = useRef<RNAudioApiEngine | null>(null);
  const bedRef = useRef<VoiceHandle | null>(null);
  const loopRef = useRef<LoopGroupHandle | null>(null);
  const narrationRef = useRef<VoiceHandle | null>(null);
  const oneshotScheduler = useRef(
    new OneShotWindowScheduler(SPIKE_ONESHOT_SEED),
  );
  const mixRunning = useRef(false);
  const bedIsWind = useRef(true);
  const stemBDb = useRef(-8);
  const stressMode = useRef(false);
  /** Default on — T1 uses 24 kHz narration decode. */
  const narration24kMode = useRef(true);
  const streamBedMode = useRef(false);
  const lastDiagLogWallMs = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [stress, setStress] = useState(false);
  const [narration24k, setNarration24k] = useState(true);
  const [streamBed, setStreamBed] = useState(false);
  const [streamBedPlaying, setStreamBedPlaying] = useState(false);
  const [nativeCtx, setNativeCtx] = useState<ReturnType<
    RNAudioApiEngine["getNativeContext"]
  > | null>(null);
  const [surroundingsBus, setSurroundingsBus] = useState<ReturnType<
    RNAudioApiEngine["getBusNode"]
  > | null>(null);
  const [diag, setDiag] = useState<EngineDiagnostics | null>(null);
  const [status, setStatus] = useState("idle");

  const topUpOneShots = useCallback((reason: string) => {
    const engine = engineRef.current;
    if (!engine || !mixRunning.current) return;
    let nowSec: number;
    try {
      nowSec = engine.getContextCurrentTime();
    } catch {
      return;
    }
    const lookahead = stressMode.current
      ? ONESHOT_STRESS_LOOKAHEAD_SEC
      : ONESHOT_LOOKAHEAD_SEC;
    const maxPending = stressMode.current
      ? ONESHOT_STRESS_MAX_PENDING
      : ONESHOT_MAX_PENDING;
    const pendingAlready =
      engine.getDiagnostics().pendingOneShots ??
      0;
    const plans = oneshotScheduler.current.fillWindowLimited(
      nowSec,
      lookahead,
      pendingAlready,
      maxPending,
    );
    const diagSnap = engine.getDiagnostics();
    for (const plan of plans) {
      if (!engine.canAcceptOneShot()) {
        void appendSpikeLog({
          type: "oneshotDropped",
          reason: "budget",
          seq: plan.seq,
          atSec: plan.atSec,
        });
        break;
      }
      const handle = engine.playOneShot(
        { sha: plan.sha, durationMs: 1000 },
        {
          bus: "surroundings",
          gainDb: plan.gainDb,
          pan: plan.pan,
          rate: plan.rate,
          whenSec: plan.atSec,
        },
      );
      if (handle.id.startsWith("dropped-")) {
        void appendSpikeLog({
          type: "oneshotDropped",
          reason: "budget",
          seq: plan.seq,
          atSec: plan.atSec,
        });
        continue;
      }
      void appendSpikeLog({
        type: "oneshotScheduled",
        reason,
        seq: plan.seq,
        sha: plan.sha,
        atSec: plan.atSec,
        pan: plan.pan,
        rate: plan.rate,
        gainDb: plan.gainDb,
        appState: engine.getAppState(),
        contextTimeSec: nowSec,
        ...clockFields(diagSnap),
      });
    }
    setDiag(engine.getDiagnostics());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const engine = new RNAudioApiEngine();
    engineRef.current = engine;
    const unsubs: (() => void)[] = [];

    (async () => {
      try {
        if (!spikeAssetModulesReady(SPIKE_ASSET_MODULES)) {
          setError(FIXTURES_MISSING_MESSAGE);
          setStatus("error");
          return;
        }
        await engine.init({ mixWithOthers: false });
        const loads: [string, number][] = [
          ["narration", SPIKE_ASSET_MODULES.narration],
          ["stem_a", SPIKE_ASSET_MODULES.stemA],
          ["stem_b", SPIKE_ASSET_MODULES.stemB],
          ["stem_c", SPIKE_ASSET_MODULES.stemC],
          ["bed_wind", SPIKE_ASSET_MODULES.bedWind],
          ["bed_water", SPIKE_ASSET_MODULES.bedWater],
          ["oneshot_1", SPIKE_ASSET_MODULES.oneshot1],
          ["oneshot_2", SPIKE_ASSET_MODULES.oneshot2],
          ["oneshot_3", SPIKE_ASSET_MODULES.oneshot3],
          ["oneshot_4", SPIKE_ASSET_MODULES.oneshot4],
          ["oneshot_5", SPIKE_ASSET_MODULES.oneshot5],
          ["oneshot_6", SPIKE_ASSET_MODULES.oneshot6],
        ];
        for (const [sha, mod] of loads) {
          if (sha === "narration" && narration24kMode.current) {
            await engine.load(sha, String(mod), NARRATION_DECODE_RATE_HZ);
          } else {
            await engine.load(sha, String(mod));
          }
        }
        if (cancelled) return;

        setNativeCtx(engine.getNativeContext());
        setSurroundingsBus(engine.getBusNode("surroundings"));

        unsubs.push(
          engine.onTick(() => {
            topUpOneShots("tick");
            const d = engine.getDiagnostics();
            setDiag(d);
            const now = Date.now();
            if (mixRunning.current && now - lastDiagLogWallMs.current >= 60_000) {
              lastDiagLogWallMs.current = now;
              void appendDiagnostics(d, { trigger: "minute" });
            }
          }),
        );
        unsubs.push(
          engine.onRouteChange((route) => {
            void appendSpikeLog({
              type: "routeChange",
              route,
              appState: engine.getAppState(),
              raw: engine.lastDevicesInfo,
            });
          }),
        );
        unsubs.push(
          engine.onInterruption((e) => {
            void appendSpikeLog({
              type: "interruption",
              event: e,
              appState: engine.getAppState(),
            });
          }),
        );
        unsubs.push(
          engine.onRemoteCommand((c) => {
            void appendSpikeLog({
              type: "remoteCommand",
              command: c,
              appState: engine.getAppState(),
            });
          }),
        );
        unsubs.push(
          engine.onAppStateChange((state) => {
            void appendSpikeLog({ type: "appState", state });
          }),
        );
        unsubs.push(
          engine.onNotificationVisibilityChange((visible) => {
            void appendSpikeLog({
              type: visible ? "notificationShow" : "notificationHide",
              visible,
              appState: engine.getAppState(),
            });
          }),
        );
        unsubs.push(
          engine.onVoiceEnded((e) => {
            const d = engine.getDiagnostics();
            void appendSpikeLog({
              type: "voiceEnded",
              voiceId: e.voiceId,
              kind: e.kind,
              reason: e.reason,
              appState: e.appState,
              ...clockFields(d),
            });
            void appendDiagnosticsIfDue(d, 60_000, {
              trigger: "voiceEnded",
            });
            if (e.kind === "narration" && narrationRef.current?.id === e.voiceId) {
              narrationRef.current = null;
            }
          }),
        );
        unsubs.push(
          engine.onSettled((d) => {
            const created = d.nodesCreated ?? 0;
            const released = d.nodesReleased ?? 0;
            const live = d.activeVoices ?? 0;
            void appendSpikeLog({
              type: "settled",
              ...d,
              ledger: engine.getLedgerStats(),
              nodesLeakEstimate: created - released - live,
            });
            setDiag(d);
            setStatus(
              `settled (live=${live}, created=${created}, released=${released})`,
            );
          }),
        );

        setReady(true);
        setStatus("ready");
        setDiag(engine.getDiagnostics());
        await appendSpikeLog({
          type: "init",
          ...engine.getDiagnostics(),
          rawDevices: engine.lastDevicesInfo,
          spikeAllowed: SPIKE_ALLOWED,
          releaseSpike: process.env.EXPO_PUBLIC_AUDIO_SPIKE === "1",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`${FIXTURES_MISSING_MESSAGE}\n\nLoad error: ${message}`);
        setStatus("error");
      }
    })();

    // UI-only 1 Hz readout (allowed by brief); engine uses heartbeats.
    const uiTimer = setInterval(() => {
      if (engineRef.current) setDiag(engineRef.current.getDiagnostics());
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(uiTimer);
      mixRunning.current = false;
      for (const u of unsubs) u();
      void engine.dispose();
      engineRef.current = null;
    };
  }, [topUpOneShots]);

  const applyStress = useCallback(
    (on: boolean) => {
      stressMode.current = on;
      setStress(on);
      const engine = engineRef.current;
      if (engine) {
        engine.setVoiceBudget(on ? STRESS_BUDGET : NORMAL_BUDGET);
      }
      void appendSpikeLog({ type: "stressToggle", on });
    },
    [],
  );

  const applyNarration24k = useCallback(async (on: boolean) => {
    narration24kMode.current = on;
    setNarration24k(on);
    const engine = engineRef.current;
    if (!engine || !ready) {
      void appendSpikeLog({
        type: "narrationDecodeRate",
        hz: on ? NARRATION_DECODE_RATE_HZ : "file",
      });
      return;
    }
    try {
      setStatus(
        on ? "reloading narration @ 24 kHz" : "reloading narration @ file rate",
      );
      engine.invalidateBuffer("narration");
      await engine.load(
        "narration",
        String(SPIKE_ASSET_MODULES.narration),
        on ? NARRATION_DECODE_RATE_HZ : undefined,
      );
      await appendSpikeLog({
        type: "narrationDecodeRate",
        hz: on ? NARRATION_DECODE_RATE_HZ : "file",
        decodedBytes: engine.getDiagnostics().decodedBytes,
      });
      setStatus("ready");
      setDiag(engine.getDiagnostics());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [ready]);

  const applyStreamBed = useCallback((on: boolean) => {
    streamBedMode.current = on;
    setStreamBed(on);
    void appendSpikeLog({ type: "streamBedToggle", on, uri: STREAM_BED_URI });
  }, []);

  const onStreamBedLoop = useCallback(
    (e: StreamBedLoopEvent) => {
      const engine = engineRef.current;
      const d = engine?.getDiagnostics();
      void appendSpikeLog({
        type: "streamBedLoop",
        ...e,
        contextTimeMs: d?.contextTimeMs,
        clockRate: d?.clockRate,
        appState: d?.appState ?? engine?.getAppState(),
      });
    },
    [],
  );

  const startFullMix = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !ready) return;
    try {
      setStatus("starting");
      engine.setVoiceBudget(stressMode.current ? STRESS_BUDGET : NORMAL_BUDGET);
      await engine.prepareMixStart();
      engine.startHeartbeats();
      narrationRef.current = engine.playNarration(
        { sha: "narration", durationMs: 90_000 },
        { title: "InTell audio spike", artist: "Test" },
        0,
      );
      loopRef.current = engine.startLoopGroup("music", [
        {
          h: { sha: "stem_a", durationMs: 16_000 },
          gainDb: -8,
          loopStartMs: 0,
          loopEndMs: 16_000,
        },
        {
          h: { sha: "stem_b", durationMs: 16_000 },
          gainDb: -8,
          loopStartMs: 0,
          loopEndMs: 16_000,
        },
        {
          h: { sha: "stem_c", durationMs: 16_000 },
          gainDb: -8,
          loopStartMs: 0,
          loopEndMs: 16_000,
        },
      ]);

      if (streamBedMode.current) {
        // T1c: MediaElement file player instead of decoded buffer bed.
        bedRef.current = null;
        setStreamBedPlaying(true);
        await appendSpikeLog({
          type: "streamBedStart",
          uri: STREAM_BED_URI,
          narrationHz: narration24kMode.current ? NARRATION_DECODE_RATE_HZ : "file",
        });
      } else {
        setStreamBedPlaying(false);
        bedRef.current = engine.crossfadeBed(
          "surroundings",
          null,
          { sha: "bed_wind", durationMs: 30_000 },
          { gainDb: -10, fadeMs: 50, loopStartMs: 0, loopEndMs: 30_000 },
        );
        bedIsWind.current = true;
      }
      stemBDb.current = -8;

      oneshotScheduler.current.reset(
        SPIKE_ONESHOT_SEED,
        engine.getContextCurrentTime(),
      );
      mixRunning.current = true;
      topUpOneShots("mixStart");

      resetDiagnosticsTickClock();
      lastDiagLogWallMs.current = Date.now();
      await appendDiagnostics(engine.getDiagnostics(), {
        event: "mixStarted",
        streamBed: streamBedMode.current,
        narrationHz: narration24kMode.current ? NARRATION_DECODE_RATE_HZ : "file",
      });

      setRunning(true);
      setStatus(
        streamBedMode.current
          ? "running (T1c MediaElement bed)"
          : "running",
      );
      setDiag(engine.getDiagnostics());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [ready, topUpOneShots]);

  const toggleNarration = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (narrationRef.current) {
      engine.stop(narrationRef.current, 200);
      narrationRef.current = null;
      setStatus("narration off (ducks releasing)");
      void appendSpikeLog({ type: "narrationToggle", on: false });
      return;
    }
    narrationRef.current = engine.playNarration(
      { sha: "narration", durationMs: 90_000 },
      { title: "InTell audio spike", artist: "Test" },
      0,
    );
    setStatus("narration on (ducking)");
    void appendSpikeLog({ type: "narrationToggle", on: true });
  }, []);

  const crossfadeBed = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const nextSha = bedIsWind.current ? "bed_water" : "bed_wind";
    bedRef.current = engine.crossfadeBed(
      "surroundings",
      bedRef.current,
      { sha: nextSha, durationMs: 30_000 },
      { gainDb: -10, fadeMs: 6000, loopStartMs: 0, loopEndMs: 30_000 },
    );
    bedIsWind.current = !bedIsWind.current;
    setStatus(`bed → ${nextSha}`);
  }, []);

  const stemBUp = useCallback(() => {
    const engine = engineRef.current;
    const loop = loopRef.current;
    if (!engine || !loop) return;
    stemBDb.current = Math.min(0, stemBDb.current + 3);
    engine.setStemGain(loop, 1, stemBDb.current, 2000);
    setStatus(`stem B ${stemBDb.current} dB`);
  }, []);

  const stemBDown = useCallback(() => {
    const engine = engineRef.current;
    const loop = loopRef.current;
    if (!engine || !loop) return;
    stemBDb.current = Math.max(-24, stemBDb.current - 3);
    engine.setStemGain(loop, 1, stemBDb.current, 2000);
    setStatus(`stem B ${stemBDb.current} dB`);
  }, []);

  const stopAll = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    mixRunning.current = false;
    setStreamBedPlaying(false);
    await engine.stopAllMix(500);
    loopRef.current = null;
    bedRef.current = null;
    narrationRef.current = null;
    setRunning(false);
    setStatus("stopped");
    const d = engine.getDiagnostics();
    const stats = engine.getLedgerStats();
    await appendSpikeLog({
      type: "stopped",
      ...d,
      ledger: stats,
      nodesLeakEstimate: stats.created - stats.released,
    });
    setDiag(d);
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        InTell audio spike
      </Text>
      <Text style={styles.hint}>
        Deep link: intell://dev/audio-spike
        {process.env.EXPO_PUBLIC_AUDIO_SPIKE === "1" ? " (release spike)" : ""}
        {"\n"}
        T1: narration 24 kHz on by default. T1c: enable MediaElement bed, push
        probe-bed-2min-stereo.m4a to files/spikes/.
      </Text>
      <Text style={styles.status}>Status: {status}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Only mount when T1c is armed — preload/onLoad otherwise races the buffer bed and has crashed AudioTrack. */}
      {nativeCtx && surroundingsBus && streamBed ? (
        <MediaElementBed
          context={nativeCtx}
          destination={surroundingsBus}
          sourceUri={STREAM_BED_URI}
          gainDb={-10}
          playing={streamBedPlaying}
          onLoop={onStreamBedLoop}
          onReady={() => {
            void appendSpikeLog({ type: "streamBedReady", uri: STREAM_BED_URI });
          }}
          onError={(err) => {
            setError(`MediaElement bed: ${err.message}`);
            void appendSpikeLog({
              type: "streamBedError",
              message: err.message,
            });
          }}
        />
      ) : null}

      <Btn
        label="Start full mix"
        onPress={startFullMix}
        disabled={!ready || running}
      />
      <Btn
        label="Toggle narration"
        onPress={toggleNarration}
        disabled={!running}
      />
      <Btn
        label="Crossfade bed"
        onPress={crossfadeBed}
        disabled={!running || streamBed}
      />
      <Btn label="Stem B up" onPress={stemBUp} disabled={!running} />
      <Btn label="Stem B down" onPress={stemBDown} disabled={!running} />
      <Btn
        label={
          narration24k
            ? "Narration: 24 kHz (ON)"
            : "Narration: 24 kHz"
        }
        onPress={() => void applyNarration24k(!narration24kMode.current)}
        disabled={running}
      />
      <Btn
        label={
          streamBed
            ? "T1c: MediaElement bed (ON)"
            : "T1c: MediaElement bed"
        }
        onPress={() => applyStreamBed(!streamBedMode.current)}
        disabled={running}
      />
      <Btn
        label={stress ? "Stress: B·S1 load (ON)" : "Stress: B·S1 load"}
        onPress={() => applyStress(!stressMode.current)}
        disabled={running}
      />
      <Btn label="Stop all" onPress={() => void stopAll()} disabled={!running} />
      <Btn label="Share log" onPress={() => void shareSpikeLog()} />

      <Text style={styles.diagTitle}>Diagnostics (1 Hz)</Text>
      <Text style={styles.diag} accessibilityLabel="diagnostics">
        {diag
          ? JSON.stringify(
              {
                uptimeMs: diag.uptimeMs,
                route: diag.route,
                activeVoices: diag.activeVoices,
                pendingOneShots: diag.pendingOneShots,
                nodesCreated: diag.nodesCreated,
                nodesReleased: diag.nodesReleased,
                missedEnded: diag.missedEnded,
                oneshotDropped: diag.oneshotDropped,
                clockRate: diag.clockRate,
                clockGapMs: diag.clockGapMs,
                decodedBytes: diag.decodedBytes,
                contextState: diag.contextState,
                appState: diag.appState,
                focusHeld: diag.focusHeld,
                audioHealth: diag.audioHealth,
                notificationVisible: diag.notificationVisible,
              },
              null,
              2,
            )
          : "—"}
      </Text>
    </ScrollView>
  );
}

function Btn(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.btn, props.disabled && styles.btnDisabled]}
    >
      <Text style={styles.btnText}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 56,
    gap: 10,
    backgroundColor: "#F6F2EA",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1A1A1A" },
  hint: { fontSize: 13, color: "#555", marginBottom: 8 },
  status: { fontSize: 14, color: "#333" },
  error: {
    color: "#8B1E1E",
    backgroundColor: "#F8E4E4",
    padding: 12,
    borderRadius: 4,
    fontSize: 13,
  },
  btn: {
    backgroundColor: "#2C4A3E",
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 4,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    color: "#F6F2EA",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  diagTitle: { marginTop: 16, fontSize: 14, fontWeight: "600" },
  diag: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "#222",
    backgroundColor: "#EDE8DF",
    padding: 10,
  },
});
