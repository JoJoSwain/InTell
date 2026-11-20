import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { Redirect } from "expo-router";
import type {
  AudioEngine,
  EngineDiagnostics,
  LoopGroupHandle,
  VoiceHandle,
} from "@intell/shared";
import { RNAudioApiEngine } from "../../src/audio/engine";
import { SPIKE_ASSET_MODULES } from "../../src/audio/spike/assets";
import { FIXTURES_MISSING_MESSAGE } from "../../src/audio/spike/fixturesReady";
import {
  appendDiagnostics,
  appendSpikeLog,
  shareSpikeLog,
} from "../../src/audio/spike/logger";

/**
 * Hidden M1 spike screen. Dev-only; deep link: intell://dev/audio-spike
 * No product chrome links here.
 */
export default function AudioSpikeScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <AudioSpikeBody />;
}

function AudioSpikeBody() {
  const engineRef = useRef<AudioEngine | null>(null);
  const bedRef = useRef<VoiceHandle | null>(null);
  const loopRef = useRef<LoopGroupHandle | null>(null);
  const narrationRef = useRef<VoiceHandle | null>(null);
  const oneshotTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const logTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bedIsWind = useRef(true);
  const stemBDb = useRef(-8);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [diag, setDiag] = useState<EngineDiagnostics | null>(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let cancelled = false;
    const engine = new RNAudioApiEngine();
    engineRef.current = engine;

    (async () => {
      try {
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
          await engine.load(sha, String(mod));
        }
        if (cancelled) return;

        engine.onRouteChange((route) => {
          void appendSpikeLog({
            type: "routeChange",
            route,
            raw: (engine as RNAudioApiEngine).lastDevicesInfo,
          });
        });
        engine.onInterruption((e) => {
          void appendSpikeLog({ type: "interruption", event: e });
        });
        engine.onRemoteCommand((c) => {
          void appendSpikeLog({ type: "remoteCommand", command: c });
        });

        setReady(true);
        setStatus("ready");
        setDiag(engine.getDiagnostics());
        await appendSpikeLog({
          type: "init",
          ...engine.getDiagnostics(),
          rawDevices: (engine as RNAudioApiEngine).lastDevicesInfo,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`${FIXTURES_MISSING_MESSAGE}\n\nLoad error: ${message}`);
        setStatus("error");
      }
    })();

    const uiTimer = setInterval(() => {
      if (engineRef.current) setDiag(engineRef.current.getDiagnostics());
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(uiTimer);
      if (oneshotTimer.current) clearInterval(oneshotTimer.current);
      if (logTimer.current) clearInterval(logTimer.current);
      void engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const startFullMix = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || !ready) return;
    try {
      setStatus("starting");
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
      bedRef.current = engine.crossfadeBed(
        "surroundings",
        null,
        { sha: "bed_wind", durationMs: 30_000 },
        { gainDb: -10, fadeMs: 10, loopStartMs: 0, loopEndMs: 30_000 },
      );
      bedIsWind.current = true;
      stemBDb.current = -8;

      if (oneshotTimer.current) clearInterval(oneshotTimer.current);
      oneshotTimer.current = setInterval(() => {
        const n = 1 + Math.floor(Math.random() * 6);
        engine.playOneShot(
          { sha: `oneshot_${n}`, durationMs: 1000 },
          {
            bus: "surroundings",
            gainDb: -12,
            pan: Math.random() * 2 - 1,
            rate: 0.9 + Math.random() * 0.2,
          },
        );
      }, 8000);

      if (logTimer.current) clearInterval(logTimer.current);
      logTimer.current = setInterval(() => {
        void appendDiagnostics(engine.getDiagnostics());
      }, 60_000);
      await appendDiagnostics(engine.getDiagnostics(), { event: "mixStarted" });

      setRunning(true);
      setStatus("running");
      setDiag(engine.getDiagnostics());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [ready]);

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
    if (oneshotTimer.current) clearInterval(oneshotTimer.current);
    if (logTimer.current) clearInterval(logTimer.current);
    if (loopRef.current) engine.stop(loopRef.current, 500);
    if (bedRef.current) engine.stop(bedRef.current, 500);
    if (narrationRef.current) engine.stop(narrationRef.current, 500);
    engine.pauseNarration();
    loopRef.current = null;
    bedRef.current = null;
    narrationRef.current = null;
    setRunning(false);
    setStatus("stopped");
    await appendSpikeLog({ type: "stopped", ...engine.getDiagnostics() });
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        InTell audio spike
      </Text>
      <Text style={styles.hint}>
        Dev-only. Deep link: intell://dev/audio-spike
      </Text>
      <Text style={styles.status}>Status: {status}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
      <Btn label="Crossfade bed" onPress={crossfadeBed} disabled={!running} />
      <Btn label="Stem B up" onPress={stemBUp} disabled={!running} />
      <Btn label="Stem B down" onPress={stemBDown} disabled={!running} />
      <Btn label="Stop all" onPress={stopAll} disabled={!running} />
      <Btn label="Share log" onPress={() => void shareSpikeLog()} />

      <Text style={styles.diagTitle}>Diagnostics (1 Hz)</Text>
      <Text style={styles.diag} accessibilityLabel="diagnostics">
        {diag
          ? JSON.stringify(
              {
                uptimeMs: diag.uptimeMs,
                route: diag.route,
                narrationPositionMs: diag.narrationPositionMs,
                loopGroups: diag.loopGroups,
                activeVoices: diag.activeVoices,
                underruns: diag.underruns,
                decodedBytes: diag.decodedBytes,
                cacheEvictions: diag.cacheEvictions,
                contextTimeMs: diag.contextTimeMs,
                wallElapsedMs: diag.wallElapsedMs,
                clockGapMs: diag.clockGapMs,
                contextState: diag.contextState,
                appState: diag.appState,
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
