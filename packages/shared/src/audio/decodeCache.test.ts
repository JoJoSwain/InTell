import { describe, expect, it } from "vitest";
import {
  DECODE_CACHE_CAP_BYTES,
  DecodedBufferLruAccounting,
  estimateDecodedPcmBytes,
  estimateDecodedPcmBytesAtRate,
} from "./decodeCache";

describe("DECODE_CACHE_CAP_BYTES", () => {
  it("is 96 MiB in bytes", () => {
    expect(DECODE_CACHE_CAP_BYTES).toBe(96 * 1024 * 1024);
  });
});

describe("estimateDecodedPcmBytes", () => {
  it("uses float32 frames × channels × 4", () => {
    // 90s mono @ 48 kHz
    expect(estimateDecodedPcmBytes(48_000 * 90, 1)).toBe(48_000 * 90 * 4);
    // 16s stereo @ 48 kHz
    expect(estimateDecodedPcmBytes(48_000 * 16, 2)).toBe(48_000 * 16 * 2 * 4);
  });

  it("returns 0 for non-positive inputs", () => {
    expect(estimateDecodedPcmBytes(0, 1)).toBe(0);
    expect(estimateDecodedPcmBytes(100, 0)).toBe(0);
    expect(estimateDecodedPcmBytes(-1, 2)).toBe(0);
  });
});

describe("estimateDecodedPcmBytesAtRate", () => {
  it("matches frame-based estimate at the same rate", () => {
    const durationSec = 90;
    const sampleRate = 48_000;
    const channels = 1;
    expect(
      estimateDecodedPcmBytesAtRate(durationSec, sampleRate, channels),
    ).toBe(estimateDecodedPcmBytes(durationSec * sampleRate, channels));
  });
});

describe("DecodedBufferLruAccounting", () => {
  it("tracks decodedBytes without eviction under the cap", () => {
    const lru = new DecodedBufferLruAccounting(10_000);
    expect(lru.put("a", 3_000)).toEqual([]);
    expect(lru.put("b", 4_000)).toEqual([]);
    expect(lru.decodedBytes).toBe(7_000);
    expect(lru.cacheEvictions).toBe(0);
  });

  it("evicts oldest until the new entry fits", () => {
    const lru = new DecodedBufferLruAccounting(10_000);
    lru.put("a", 4_000);
    lru.put("b", 4_000);
    lru.touch("a"); // a is newer; b is older
    const evicted = lru.put("c", 4_000);
    expect(evicted).toEqual(["b"]);
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
    expect(lru.has("c")).toBe(true);
    expect(lru.decodedBytes).toBe(8_000);
    expect(lru.cacheEvictions).toBe(1);
  });

  it("does not collapse the cache to the size of the incoming buffer", () => {
    // Regression: the old mobile LRU compared free-space to (cap − incoming),
    // which evicted until totalBytes <= incomingBytes (~954 KB leftover).
    const lru = new DecodedBufferLruAccounting(96 * 1024 * 1024);
    const big = 12 * 1024 * 1024;
    for (const sha of ["n", "a", "b", "c", "w", "h", "1", "2", "3", "4", "5", "6"]) {
      lru.put(sha, big / 2); // 6 MB each → 72 MB total, under 96 MB
    }
    expect(lru.cacheEvictions).toBe(0);
    expect(lru.decodedBytes).toBe(12 * (big / 2));
    expect(lru.size).toBe(12);
  });

  it("evicts everything else when one entry exceeds the cap, then keeps it", () => {
    const lru = new DecodedBufferLruAccounting(1_000);
    lru.put("small", 400);
    const evicted = lru.put("huge", 5_000);
    expect(evicted).toEqual(["small"]);
    expect(lru.decodedBytes).toBe(5_000);
    expect(lru.has("huge")).toBe(true);
  });

  it("replacing an entry does not double-count bytes", () => {
    const lru = new DecodedBufferLruAccounting(10_000);
    lru.put("a", 3_000);
    lru.put("a", 4_000);
    expect(lru.decodedBytes).toBe(4_000);
    expect(lru.size).toBe(1);
  });
});
