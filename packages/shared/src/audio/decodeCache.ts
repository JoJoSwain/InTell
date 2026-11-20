/** M1 spike decode-cache cap: 96 MiB of decoded float32 PCM. */
export const DECODE_CACHE_CAP_BYTES = 96 * 1024 * 1024;

/**
 * Decoded float32 PCM size: frames × channels × 4 bytes.
 * `frames` must be at the rate the buffer is stored (typically the
 * AudioContext sample rate after decode).
 */
export function estimateDecodedPcmBytes(
  frames: number,
  channels: number,
): number {
  if (!Number.isFinite(frames) || !Number.isFinite(channels)) return 0;
  if (frames <= 0 || channels <= 0) return 0;
  return frames * channels * 4;
}

/**
 * Same estimate from duration + sample rate (e.g. context.sampleRate).
 */
export function estimateDecodedPcmBytesAtRate(
  durationSec: number,
  sampleRate: number,
  channels: number,
): number {
  if (
    !Number.isFinite(durationSec) ||
    !Number.isFinite(sampleRate) ||
    !Number.isFinite(channels)
  ) {
    return 0;
  }
  if (durationSec <= 0 || sampleRate <= 0 || channels <= 0) return 0;
  return Math.round(durationSec * sampleRate * channels * 4);
}

interface AccountingEntry {
  sha: string;
  bytes: number;
  lastUsed: number;
}

/**
 * Pure LRU byte accounting for decoded PCM buffers (no AudioBuffer dependency).
 * Evicts oldest until `totalBytes + incomingBytes <= capBytes`.
 */
export class DecodedBufferLruAccounting {
  private readonly map = new Map<string, AccountingEntry>();
  private totalBytes = 0;
  private evictions = 0;
  private readonly capBytes: number;
  private clock = 0;

  constructor(capBytes: number = DECODE_CACHE_CAP_BYTES) {
    this.capBytes = capBytes;
  }

  get decodedBytes(): number {
    return this.totalBytes;
  }

  get cacheEvictions(): number {
    return this.evictions;
  }

  get size(): number {
    return this.map.size;
  }

  has(sha: string): boolean {
    return this.map.has(sha);
  }

  /** Mark an existing entry as most-recently used. */
  touch(sha: string): boolean {
    const entry = this.map.get(sha);
    if (!entry) return false;
    entry.lastUsed = this.nextClock();
    return true;
  }

  /**
   * Insert or replace `sha` with `bytes`. Returns the list of evicted shas
   * (oldest first). A single entry larger than the cap still stays; everything
   * else is evicted first.
   */
  put(sha: string, bytes: number): string[] {
    const safeBytes = Math.max(0, Math.floor(bytes));
    const existing = this.map.get(sha);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.map.delete(sha);
    }

    const evicted = this.evictUntil(this.capBytes - safeBytes);

    this.map.set(sha, {
      sha,
      bytes: safeBytes,
      lastUsed: this.nextClock(),
    });
    this.totalBytes += safeBytes;
    return evicted;
  }

  delete(sha: string): boolean {
    const entry = this.map.get(sha);
    if (!entry) return false;
    this.map.delete(sha);
    this.totalBytes -= entry.bytes;
    return true;
  }

  clear(): void {
    this.map.clear();
    this.totalBytes = 0;
    // Keep eviction count across clear — it is a session counter.
  }

  /** Evict until totalBytes <= maxTotalBytes. Returns evicted shas. */
  private evictUntil(maxTotalBytes: number): string[] {
    const limit = Math.max(0, maxTotalBytes);
    const evicted: string[] = [];
    while (this.map.size > 0 && this.totalBytes > limit) {
      const oldest = this.findOldest();
      if (!oldest) break;
      this.map.delete(oldest.sha);
      this.totalBytes -= oldest.bytes;
      this.evictions += 1;
      evicted.push(oldest.sha);
    }
    return evicted;
  }

  private findOldest(): AccountingEntry | undefined {
    let oldest: AccountingEntry | undefined;
    for (const entry of this.map.values()) {
      if (!oldest || entry.lastUsed < oldest.lastUsed) {
        oldest = entry;
      }
    }
    return oldest;
  }

  private nextClock(): number {
    this.clock += 1;
    return this.clock;
  }
}
