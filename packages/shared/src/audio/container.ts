/**
 * Minimal ISO BMFF / MP4 audio-parameter parser for `.m4a` (mp4a sample entries).
 * Reads channel count and sample rate from `stsd` → `mp4a` only — no decode.
 */

export type M4aAudioParams = {
  channels: number;
  sampleRate: number;
};

const CONTAINER_TYPES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
]);

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function readType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

/**
 * Parse AudioSampleEntry (`mp4a`) fields:
 * channelcount at +24, samplerate 16.16 fixed at +32 (from box start).
 */
function parseMp4a(view: DataView, boxStart: number, boxSize: number): M4aAudioParams | null {
  // Need at least through samplerate (offset 32 + 4).
  if (boxSize < 36) return null;
  const channels = readU16(view, boxStart + 24);
  const rateFixed = readU32(view, boxStart + 32);
  const sampleRate = rateFixed >>> 16;
  if (channels < 1 || channels > 8) return null;
  if (sampleRate < 8000 || sampleRate > 192000) return null;
  return { channels, sampleRate };
}

function walkBoxes(
  bytes: Uint8Array,
  view: DataView,
  start: number,
  end: number,
): M4aAudioParams | null {
  let offset = start;
  while (offset + 8 <= end) {
    let size = readU32(view, offset);
    const type = readType(bytes, offset + 4);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      // largesize as big-endian u64; we only need the low 53 bits safely.
      const high = readU32(view, offset + 8);
      const low = readU32(view, offset + 12);
      if (high !== 0) return null; // larger than we handle
      size = low;
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return null;

    const contentStart = offset + header;
    const contentEnd = offset + size;

    if (type === "stsd") {
      // FullBox: version/flags (4) + entry_count (4) + sample entries.
      if (contentStart + 8 > contentEnd) {
        offset += size;
        continue;
      }
      const entryCount = readU32(view, contentStart + 4);
      let entryOffset = contentStart + 8;
      for (let i = 0; i < entryCount; i++) {
        if (entryOffset + 8 > contentEnd) break;
        const entrySize = readU32(view, entryOffset);
        const entryType = readType(bytes, entryOffset + 4);
        if (entrySize < 8 || entryOffset + entrySize > contentEnd) break;
        if (entryType === "mp4a") {
          const parsed = parseMp4a(view, entryOffset, entrySize);
          if (parsed) return parsed;
        }
        entryOffset += entrySize;
      }
    } else if (CONTAINER_TYPES.has(type)) {
      const nested = walkBoxes(bytes, view, contentStart, contentEnd);
      if (nested) return nested;
    }

    offset += size;
  }
  return null;
}

/**
 * Walk MP4 boxes for `stsd` → `mp4a` and return channel count + sample rate.
 * Returns null if the file is not a recognizable mp4a audio container.
 */
export function parseM4aAudioParams(bytes: Uint8Array): M4aAudioParams | null {
  if (bytes.byteLength < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return walkBoxes(bytes, view, 0, bytes.byteLength);
}
