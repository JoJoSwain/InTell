/**
 * B·S2 Part 4 — narration/bed memory probe (informational).
 * Deep link: intell://dev/audio-memory-probe
 *
 * Push fixtures first:
 *   adb push docs/spikes/fixtures/probe-*.m4a /sdcard/Android/data/org.replaceplace.intell/files/spikes/
 */
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect } from "expo-router";
/* Part 4 probe: call the library directly (not through AudioEngine). */
/* eslint-disable no-restricted-imports -- intentional library surface probe */
import {
  AudioContext,
  AudioBufferQueueSourceNode,
  decodeAudioData,
  isFfmpegEnabled,
} from "react-native-audio-api";
/* eslint-enable no-restricted-imports */
import * as FileSystem from "expo-file-system/legacy";
import { appendSpikeLog } from "../../src/audio/spike/logger";

const SPIKE_ALLOWED =
  __DEV__ || process.env.EXPO_PUBLIC_AUDIO_SPIKE === "1";

const FIXTURE_DIR =
  "file:///sdcard/Android/data/org.replaceplace.intell/files/spikes/";

type ProbeRow = {
  label: string;
  decodeMs?: number;
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
  length?: number;
  decodedBytes?: number;
  fileBytes?: number;
  error?: string;
};

function pcmBytes(length: number, channels: number): number {
  return length * channels * 4;
}

function readFfmpegFlag(): boolean {
  try {
    return isFfmpegEnabled();
  } catch {
    return false;
  }
}

async function fileSize(uri: string): Promise<number | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && "size" in info && typeof info.size === "number") {
      return info.size;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export default function AudioMemoryProbeScreen() {
  if (!SPIKE_ALLOWED) {
    return <Redirect href="/" />;
  }
  return <Body />;
}

function Body() {
  const [rows, setRows] = useState<ProbeRow[]>([]);
  const [status, setStatus] = useState("idle");
  const [ffmpeg] = useState(readFfmpegFlag);
  const [loopNote, setLoopNote] = useState<string>("—");

  const runDecodeProbe = useCallback(async () => {
    setStatus("decoding");
    const next: ProbeRow[] = [];

    const cases: { label: string; file: string; rate?: number }[] = [
      {
        label: "narration AAC default rate",
        file: "probe-narration-5min-mono.m4a",
      },
      {
        label: "narration AAC → 24000 Hz",
        file: "probe-narration-5min-mono.m4a",
        rate: 24_000,
      },
      {
        label: "bed AAC default rate",
        file: "probe-bed-2min-stereo.m4a",
      },
      {
        label: "bed AAC → 24000 Hz",
        file: "probe-bed-2min-stereo.m4a",
        rate: 24_000,
      },
    ];

    for (const c of cases) {
      const uri = FIXTURE_DIR + c.file;
      try {
        const fileBytes = await fileSize(uri);
        const t0 = Date.now();
        const buf = await decodeAudioData(uri, c.rate);
        const decodeMs = Date.now() - t0;
        const decodedBytes = pcmBytes(buf.length, buf.numberOfChannels);
        const row: ProbeRow = {
          label: c.label,
          decodeMs,
          durationSec: buf.duration,
          sampleRate: buf.sampleRate,
          channels: buf.numberOfChannels,
          length: buf.length,
          decodedBytes,
          fileBytes,
        };
        next.push(row);
        await appendSpikeLog({ type: "memoryProbe", ...row });
      } catch (err) {
        const row: ProbeRow = {
          label: c.label,
          error: err instanceof Error ? err.message : String(err),
        };
        next.push(row);
        await appendSpikeLog({ type: "memoryProbe", ...row });
      }
    }

    try {
      const uri = FIXTURE_DIR + "probe-bed-2min-stereo.m4a";
      const full = await decodeAudioData(uri);
      const ctx = new AudioContext();
      const half = Math.floor(full.length / 2);
      const a = ctx.createBuffer(
        full.numberOfChannels,
        half,
        full.sampleRate,
      );
      const bLen = full.length - half;
      const b = ctx.createBuffer(
        full.numberOfChannels,
        bLen,
        full.sampleRate,
      );
      for (let ch = 0; ch < full.numberOfChannels; ch += 1) {
        const src = full.getChannelData(ch);
        a.copyToChannel(src.subarray(0, half), ch);
        b.copyToChannel(src.subarray(half), ch);
      }
      const q = new AudioBufferQueueSourceNode(ctx);
      q.enqueueBuffer(a);
      q.enqueueBuffer(b);
      const qRow: ProbeRow = {
        label: "AudioBufferQueueSourceNode enqueue 2× bed halves",
        durationSec: full.duration,
        sampleRate: full.sampleRate,
        channels: full.numberOfChannels,
        decodedBytes: pcmBytes(full.length, full.numberOfChannels),
        decodeMs: 0,
      };
      next.push(qRow);
      await appendSpikeLog({
        type: "memoryProbe",
        note: "QueueSource accepts AudioBuffers only (chunked PCM), not file paths",
        ...qRow,
      });
      await ctx.close();
    } catch (err) {
      const row: ProbeRow = {
        label: "AudioBufferQueueSourceNode",
        error: err instanceof Error ? err.message : String(err),
      };
      next.push(row);
      await appendSpikeLog({ type: "memoryProbe", ...row });
    }

    setRows(next);
    setStatus("decoded — capture dumpsys meminfo for PSS");
  }, []);

  const runLoopProbe = useCallback(async () => {
    // Prefer a short seamless fixture so 10 loops finish in ~1 minute.
    // Fall back to the 2‑minute bed if the short file is missing.
    setStatus("looping bed (10×)");
    setLoopNote("playing…");
    try {
      const shortUri = FIXTURE_DIR + "probe-bed-6s-stereo.m4a";
      const longUri = FIXTURE_DIR + "probe-bed-2min-stereo.m4a";
      let uri = shortUri;
      const shortInfo = await FileSystem.getInfoAsync(shortUri);
      if (!shortInfo.exists) uri = longUri;

      const buf = await decodeAudioData(uri);
      const ctx = new AudioContext();
      await ctx.resume();
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      gain.connect(ctx.destination);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = buf.duration;
      src.connect(gain);
      const t0 = ctx.currentTime;
      const loops = 10;
      src.start(t0);
      src.stop(t0 + buf.duration * loops);

      await new Promise<void>((resolve) => {
        src.onended = () => resolve();
        setTimeout(resolve, buf.duration * loops * 1000 + 2000);
      });

      const note = `BufferSource.loop ×${loops} on ${uri.includes("6s") ? "6s" : "2min"} bed (${buf.duration.toFixed(3)}s). Listen for click/gap at boundaries.`;
      setLoopNote(note);
      await appendSpikeLog({
        type: "memoryProbeLoop",
        loops,
        durationSec: buf.duration,
        uri,
        note,
      });
      await ctx.close();
      setStatus("loop done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoopNote(msg);
      setStatus("loop error");
      await appendSpikeLog({ type: "memoryProbeLoop", error: msg });
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Memory probe (B·S2 Part 4)
      </Text>
      <Text style={styles.hint}>
        intell://dev/audio-memory-probe · isFfmpegEnabled=
        {ffmpeg == null ? "?" : String(ffmpeg)}
        {"\n"}
        Fixtures: /sdcard/Android/data/org.replaceplace.intell/files/spikes/
      </Text>
      <Text style={styles.status}>Status: {status}</Text>

      <Btn label="Run decode probes" onPress={() => void runDecodeProbe()} />
      <Btn
        label="Loop bed 10× (listen)"
        onPress={() => void runLoopProbe()}
      />

      <Text style={styles.diagTitle}>Results</Text>
      <Text style={styles.diag} accessibilityLabel="probe-results">
        {rows.length === 0 ? "—" : JSON.stringify(rows, null, 2)}
      </Text>
      <Text style={styles.diagTitle}>Loop</Text>
      <Text style={styles.diag}>{loopNote}</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Btn(props: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={styles.btn}
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
  btn: {
    backgroundColor: "#2C4A3E",
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 4,
  },
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
