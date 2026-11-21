/**
 * Writes a tiny mono 8 kHz WAV (off AUDIO_SPEC: not m4a, wrong rate/bitrate).
 * Run: node e2e/fixtures/make-offspec-wav.mjs
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleRate = 8000;
const seconds = 0.25;
const numSamples = Math.floor(sampleRate * seconds);
const dataSize = numSamples * 2;
const buffer = Buffer.alloc(44 + dataSize);

buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(1, 22); // mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const sample = Math.sin(2 * Math.PI * 440 * t) * 0.2;
  buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
}

const out = join(__dirname, "offspec-tone.wav");
writeFileSync(out, buffer);
console.log("wrote", out);
