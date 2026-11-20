/**
 * M1 spike audio fixtures (review R2).
 * Synthetic PCM WAV only — no downloaded / AI / copyrighted audio.
 *
 * Sizes (target < 20 MB on disk):
 * - narration_90s.wav: 90 s mono 22.05 kHz
 * - stem_a/b/c.wav: 16.000 s stereo 44.1 kHz (8 bars @ 120 BPM)
 * - bed_wind/water.wav: 30 s stereo 22.05 kHz seamless
 * - oneshot_1..6.wav: short chirps/taps at 44.1 kHz
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  "../../apps/mobile/assets/spike-audio",
);

function writeWav(filePath, samples, sampleRate, channels) {
  const numSamples = samples.length / channels;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
  return buffer.length;
}

function monoToneWithBeeps(durationSec, sampleRate, toneHz) {
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Spoken-rhythm amplitude envelope (~syllables).
    const env =
      0.35 +
      0.25 * Math.sin(2 * Math.PI * 2.5 * t) +
      0.15 * Math.sin(2 * Math.PI * 5.1 * t);
    samples[i] = Math.sin(2 * Math.PI * toneHz * t) * Math.max(0.05, env) * 0.4;
    // 1 kHz beep every 10 s
    const mod = t % 10;
    if (mod < 0.05) {
      samples[i] += Math.sin(2 * Math.PI * 1000 * t) * 0.6;
    }
  }
  return samples;
}

function stemWithClicks(durationSec, sampleRate, pitchHz) {
  const channels = 2;
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float64Array(n * channels);
  const bpm = 120;
  const beatSec = 60 / bpm;
  const clickSamples = Math.floor(0.004 * sampleRate);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const tone =
      Math.sin(2 * Math.PI * pitchHz * t) * 0.18 +
      Math.sin(2 * Math.PI * (pitchHz * 2) * t) * 0.05;
    let click = 0;
    const beatPos = t % beatSec;
    if (beatPos < clickSamples / sampleRate) {
      // Same sample offset every beat — flam test.
      const x = beatPos * sampleRate;
      click = (1 - x / clickSamples) * 0.9;
    }
    const v = tone + click;
    samples[i * 2] = v;
    samples[i * 2 + 1] = v * 0.92;
  }
  return samples;
}

function seamlessNoise(durationSec, sampleRate, color) {
  const channels = 2;
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float64Array(n * channels);
  let lpL = 0;
  let lpR = 0;
  const cutoff = color === "wind" ? 0.05 : 0.02;
  for (let i = 0; i < n; i++) {
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;
    lpL += cutoff * (whiteL - lpL);
    lpR += cutoff * (whiteR - lpR);
    // Equal-power fade at edges so loop is seamless.
    const fade = Math.min(i, n - 1 - i, sampleRate * 0.25) / (sampleRate * 0.25);
    const env = Math.min(1, Math.max(0.15, fade));
    samples[i * 2] = lpL * 0.35 * env;
    samples[i * 2 + 1] = lpR * 0.35 * env;
  }
  // Force first/last 64 samples to match for loop seam.
  const seam = 64;
  for (let i = 0; i < seam; i++) {
    const t = i / seam;
    samples[i * 2] =
      samples[i * 2] * t + samples[(n - seam + i) * 2] * (1 - t);
    samples[i * 2 + 1] =
      samples[i * 2 + 1] * t + samples[(n - seam + i) * 2 + 1] * (1 - t);
    samples[(n - seam + i) * 2] = samples[i * 2];
    samples[(n - seam + i) * 2 + 1] = samples[i * 2 + 1];
  }
  return samples;
}

function oneshot(kind, sampleRate) {
  const durationSec =
    kind === "tap" ? 0.3 : kind === "chirp" ? 0.8 : 1.5;
  const n = Math.floor(durationSec * sampleRate);
  const samples = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * (kind === "tap" ? 18 : 4));
    let v = 0;
    if (kind === "tap") {
      v = (Math.random() * 2 - 1) * env * 0.7;
    } else if (kind === "chirp") {
      const f = 400 + t * 1200;
      v = Math.sin(2 * Math.PI * f * t) * env * 0.5;
    } else {
      v = Math.sin(2 * Math.PI * 220 * t) * env * 0.45;
    }
    samples[i * 2] = v;
    samples[i * 2 + 1] = v * 0.9;
  }
  return samples;
}

fs.mkdirSync(OUT, { recursive: true });

const files = [];
function add(name, bytes) {
  files.push({ name, bytes });
  console.log(`wrote ${name} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

add(
  "narration_90s.wav",
  writeWav(
    path.join(OUT, "narration_90s.wav"),
    monoToneWithBeeps(90, 22050, 300),
    22050,
    1,
  ),
);

const stemDur = 16.0;
add(
  "stem_a.wav",
  writeWav(
    path.join(OUT, "stem_a.wav"),
    stemWithClicks(stemDur, 44100, 110),
    44100,
    2,
  ),
);
add(
  "stem_b.wav",
  writeWav(
    path.join(OUT, "stem_b.wav"),
    stemWithClicks(stemDur, 44100, 164.81),
    44100,
    2,
  ),
);
add(
  "stem_c.wav",
  writeWav(
    path.join(OUT, "stem_c.wav"),
    stemWithClicks(stemDur, 44100, 220),
    44100,
    2,
  ),
);

add(
  "bed_wind.wav",
  writeWav(
    path.join(OUT, "bed_wind.wav"),
    seamlessNoise(30, 22050, "wind"),
    22050,
    2,
  ),
);
add(
  "bed_water.wav",
  writeWav(
    path.join(OUT, "bed_water.wav"),
    seamlessNoise(30, 22050, "water"),
    22050,
    2,
  ),
);

const kinds = ["tap", "chirp", "tone", "tap", "chirp", "tone"];
for (let i = 0; i < 6; i++) {
  const name = `oneshot_${i + 1}.wav`;
  add(
    name,
    writeWav(
      path.join(OUT, name),
      oneshot(kinds[i], 44100),
      44100,
      2,
    ),
  );
}

const total = files.reduce((s, f) => s + f.bytes, 0);
const manifest = {
  generatedAt: new Date().toISOString(),
  totalBytes: total,
  totalMB: Number((total / 1024 / 1024).toFixed(2)),
  files: files.map((f) => f.name),
  notes:
    "Synthetic fixtures for M1 audio spike. Run: pnpm --filter @intell/audio-fixtures generate",
};
fs.writeFileSync(
  path.join(OUT, "generated.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(
  `Total ${(total / 1024 / 1024).toFixed(2)} MB (budget < 20 MB). Manifest written.`,
);
if (total > 20 * 1024 * 1024) {
  console.error("ERROR: fixture set exceeds 20 MB budget");
  process.exit(1);
}
