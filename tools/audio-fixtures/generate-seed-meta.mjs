/**
 * M2a (C23): deterministic seed tones + supabase/seed-media.json metadata.
 * No random seed. Upload to staging-audio is M2b.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "seed-tones");
const META_PATH = path.resolve(__dirname, "../../supabase/seed-media.json");

function writeWav(samples, sampleRate, channels) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buffer.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buffer;
}

function tone(durationSec, sampleRate, channels, hz) {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float64Array(n * channels);
  for (let i = 0; i < n; i++) {
    const v = Math.sin(2 * Math.PI * hz * (i / sampleRate)) * 0.2;
    for (let c = 0; c < channels; c++) samples[i * channels + c] = v;
  }
  return samples;
}

const SPECS = [
  { key: "narration_frag1", file: "narration_frag1.wav", kind: "narration", hz: 220, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag2", file: "narration_frag2.wav", kind: "narration", hz: 233, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag3", file: "narration_frag3.wav", kind: "narration", hz: 247, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag4", file: "narration_frag4.wav", kind: "narration", hz: 262, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag5", file: "narration_frag5.wav", kind: "narration", hz: 277, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag6", file: "narration_frag6.wav", kind: "narration", hz: 294, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag7", file: "narration_frag7.wav", kind: "narration", hz: 311, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag8", file: "narration_frag8.wav", kind: "narration", hz: 330, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag9", file: "narration_frag9.wav", kind: "narration", hz: 349, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag10", file: "narration_frag10.wav", kind: "narration", hz: 370, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "narration_frag10_rev2", file: "narration_frag10_rev2.wav", kind: "narration", hz: 392, dur: 2, ch: 1, sr: 44100, lufs: -16 },
  { key: "bed_marsh", file: "bed_marsh.wav", kind: "sfx_bed", hz: 110, dur: 4, ch: 2, sr: 22050, lufs: -30, loop: true },
  { key: "bed_urban", file: "bed_urban.wav", kind: "sfx_bed", hz: 98, dur: 4, ch: 2, sr: 22050, lufs: -30, loop: true },
  { key: "oneshot_marsh_1", file: "oneshot_marsh_1.wav", kind: "sfx_oneshot", hz: 880, dur: 0.3, ch: 1, sr: 44100, lufs: -24 },
  { key: "oneshot_marsh_2", file: "oneshot_marsh_2.wav", kind: "sfx_oneshot", hz: 988, dur: 0.3, ch: 1, sr: 44100, lufs: -24 },
  { key: "oneshot_urban_1", file: "oneshot_urban_1.wav", kind: "sfx_oneshot", hz: 440, dur: 0.25, ch: 1, sr: 44100, lufs: -24 },
  { key: "oneshot_urban_2", file: "oneshot_urban_2.wav", kind: "sfx_oneshot", hz: 523, dur: 0.25, ch: 1, sr: 44100, lufs: -24 },
  { key: "stem_default_base", file: "stem_default_base.wav", kind: "music_stem", hz: 130.81, dur: 8, ch: 2, sr: 44100, lufs: -23, loop: true },
  { key: "stem_default_layer", file: "stem_default_layer.wav", kind: "music_stem", hz: 196, dur: 8, ch: 2, sr: 44100, lufs: -23, loop: true },
  { key: "stem_branch_base", file: "stem_branch_base.wav", kind: "music_stem", hz: 146.83, dur: 8, ch: 2, sr: 44100, lufs: -23, loop: true },
  { key: "stem_branch_layer", file: "stem_branch_layer.wav", kind: "music_stem", hz: 220, dur: 8, ch: 2, sr: 44100, lufs: -23, loop: true },
  { key: "hush_listen", file: "hush_listen.wav", kind: "voice_cue", hz: 180, dur: 1, ch: 1, sr: 44100, lufs: -18 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const assets = {};

for (const spec of SPECS) {
  const samples = tone(spec.dur, spec.sr, spec.ch, spec.hz);
  const buf = writeWav(samples, spec.sr, spec.ch);
  const filePath = path.join(OUT_DIR, spec.file);
  fs.writeFileSync(filePath, buf);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const duration_ms = Math.round(spec.dur * 1000);
  assets[spec.key] = {
    file: spec.file,
    kind: spec.kind,
    sha256,
    ext: "wav",
    bytes: buf.length,
    duration_ms,
    channels: spec.ch,
    sample_rate: spec.sr,
    loudness_lufs: spec.lufs,
    loop_start_ms: spec.loop ? 0 : null,
    loop_end_ms: spec.loop ? duration_ms : null,
    staging_path: `staging-audio/${sha256}.wav`,
  };
}

const meta = {
  generatedAt: "1970-01-01T00:00:00.000Z",
  deterministic: true,
  notes: "Synthetic CC0-style test tones for M2 seed. Upload in M2b.",
  assets,
};
fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");
console.log(`Wrote ${Object.keys(assets).length} assets → ${META_PATH}`);
