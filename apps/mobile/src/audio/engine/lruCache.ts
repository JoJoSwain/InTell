import type { AudioBuffer } from "react-native-audio-api";

/** M1 spike decode-cache cap (review R3): 96 MB of decoded PCM. */
export const DECODE_CACHE_CAP_BYTES = 96 * 1024 * 1024;

export function estimateDecodedBytes(buffer: AudioBuffer): number {
  // Float32 PCM: samples × channels × 4 bytes
  return buffer.length * buffer.numberOfChannels * 4;
}

interface CacheEntry {
  sha: string;
  buffer: AudioBuffer;
  bytes: number;
  lastUsed: number;
}

export class BufferLruCache {
  private readonly map = new Map<string, CacheEntry>();
  private totalBytes = 0;
  private evictions = 0;
  private readonly capBytes: number;

  constructor(capBytes: number = DECODE_CACHE_CAP_BYTES) {
    this.capBytes = capBytes;
  }

  get decodedBytes(): number {
    return this.totalBytes;
  }

  get cacheEvictions(): number {
    return this.evictions;
  }

  get(sha: string): AudioBuffer | undefined {
    const entry = this.map.get(sha);
    if (!entry) return undefined;
    entry.lastUsed = Date.now();
    return entry.buffer;
  }

  set(sha: string, buffer: AudioBuffer): void {
    const existing = this.map.get(sha);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.map.delete(sha);
    }

    const bytes = estimateDecodedBytes(buffer);
    this.evictUntil(this.capBytes - bytes);

    this.map.set(sha, {
      sha,
      buffer,
      bytes,
      lastUsed: Date.now(),
    });
    this.totalBytes += bytes;
  }

  clear(): void {
    this.map.clear();
    this.totalBytes = 0;
  }

  private evictUntil(targetFree: number): void {
    if (targetFree >= this.capBytes) {
      // Single buffer larger than cap — still keep it; log via eviction count.
      while (this.map.size > 0) {
        this.evictOldest();
      }
      return;
    }
    while (this.totalBytes > 0 && this.capBytes - this.totalBytes < Math.max(0, targetFree)) {
      if (!this.evictOldest()) break;
    }
  }

  private evictOldest(): boolean {
    let oldest: CacheEntry | undefined;
    for (const entry of this.map.values()) {
      if (!oldest || entry.lastUsed < oldest.lastUsed) {
        oldest = entry;
      }
    }
    if (!oldest) return false;
    this.map.delete(oldest.sha);
    this.totalBytes -= oldest.bytes;
    this.evictions += 1;
    return true;
  }
}
