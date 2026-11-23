import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tokens } from "../src/ui/tokens.ts";
import {
  MARKER_SCALE,
  PULSE_FRAMES,
  PULSE_STROKE_PT,
  RING,
  canvasPx,
  pulseFrame,
  type MarkerThemeName,
  type MarkerTier,
} from "../src/map/markerArt.ts";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "../assets/markers");
const manifestPath = join(root, "../src/map/markerImages.ts");

type Rgba = { r: number; g: number; b: number; a: number };

const tiers = ["root", "branch", "leaf"] as const;
const themes = ["day", "night"] as const;

function parseHex(hex: string): Rgba {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: 255,
  };
}

function blend(color: Rgba, alpha: number): Rgba {
  return { r: color.r, g: color.g, b: color.b, a: Math.round(Math.max(0, Math.min(1, alpha)) * 255) };
}

function over(dst: Rgba, src: Rgba): Rgba {
  const sa = src.a / 255;
  const da = dst.a / 255;
  const outA = sa + da * (1 - sa);
  if (outA === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((src.r * sa + dst.r * da * (1 - sa)) / outA),
    g: Math.round((src.g * sa + dst.g * da * (1 - sa)) / outA),
    b: Math.round((src.b * sa + dst.b * da * (1 - sa)) / outA),
    a: Math.round(outA * 255),
  };
}

function stampDisk(pixels: Rgba[], size: number, radiusPx: number, color: Rgba): void {
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dist = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      const coverage = Math.max(0, Math.min(1, radiusPx + 0.5 - dist));
      if (coverage <= 0) continue;
      const index = y * size + x;
      const current = pixels[index];
      if (!current) continue;
      pixels[index] = over(current, { ...color, a: Math.round(color.a * coverage) });
    }
  }
}

function stampRing(
  pixels: Rgba[],
  size: number,
  radiusPx: number,
  strokePx: number,
  color: Rgba,
): void {
  const center = size / 2;
  const half = strokePx / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dist = Math.hypot(x + 0.5 - center, y + 0.5 - center);
      const edge = Math.abs(dist - radiusPx);
      const coverage = Math.max(0, Math.min(1, half + 0.5 - edge));
      if (coverage <= 0) continue;
      const index = y * size + x;
      const current = pixels[index];
      if (!current) continue;
      pixels[index] = over(current, { ...color, a: Math.round(color.a * coverage) });
    }
  }
}

function png(size: number, pixels: Rgba[]): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = pixels[y * size + x];
      const at = row + 1 + x * 4;
      raw[at] = pixel?.r ?? 0;
      raw[at + 1] = pixel?.g ?? 0;
      raw[at + 2] = pixel?.b ?? 0;
      raw[at + 3] = pixel?.a ?? 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

function draw(
  tier: MarkerTier,
  theme: MarkerThemeName,
  kind: string,
  frame: number,
  scale: number,
): Buffer {
  const size = canvasPx(scale);
  const pixels = Array.from({ length: size * size }, () => ({ r: 0, g: 0, b: 0, a: 0 }));
  const ring = RING[tier];
  const colors = tokens.marker[theme];
  const ringColor = kind === "locked" ? colors.lockedRing : colors.ring;
  const radiusPx = (ring.diameterPt / 2) * scale;
  const strokePx = ring.strokePt * scale;
  const centerRadius = Math.max(0, radiusPx - strokePx / 2);
  stampDisk(pixels, size, centerRadius, parseHex(colors.center));
  stampRing(pixels, size, radiusPx, strokePx, parseHex(ringColor));
  if (kind === "pulse" || kind === "changed") {
    const pulse = pulseFrame(tier, frame);
    const color = parseHex(kind === "changed" ? colors.changed : colors.pulse);
    stampRing(
      pixels,
      size,
      pulse.radiusPt * scale,
      PULSE_STROKE_PT * scale,
      blend(color, pulse.opacity),
    );
  }
  return png(size, pixels);
}

mkdirSync(outDir, { recursive: true });
const names: string[] = [];
for (const tier of tiers) {
  for (const theme of themes) {
    const jobs: { name: string; kind: string; frame: number }[] = [
      { name: `${tier}-${theme}-ring`, kind: "ring", frame: 0 },
      { name: `${tier}-${theme}-locked`, kind: "locked", frame: 0 },
    ];
    for (let frame = 0; frame < PULSE_FRAMES; frame += 1) {
      jobs.push({ name: `${tier}-${theme}-pulse-${frame}`, kind: "pulse", frame });
      jobs.push({ name: `${tier}-${theme}-changed-${frame}`, kind: "changed", frame });
    }
    for (const job of jobs) {
      writeFileSync(join(outDir, `${job.name}.png`), draw(tier, theme, job.kind, job.frame, 1));
      writeFileSync(join(outDir, `${job.name}@3x.png`), draw(tier, theme, job.kind, job.frame, MARKER_SCALE));
      names.push(job.name);
    }
  }
}

const lines = names
  .map((name) => `  "${name}": require("../../assets/markers/${name}.png"),`)
  .join("\n");
writeFileSync(
  manifestPath,
  `export const markerImages: Record<string, number> = {\n${lines}\n};\n`,
);
console.info(`wrote ${names.length} marker images at ${canvasPx()} px`);
