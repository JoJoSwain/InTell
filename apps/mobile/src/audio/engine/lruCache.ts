import {
  DECODE_CACHE_CAP_BYTES,
  DecodedBufferLruAccounting,
  estimateDecodedPcmBytesAtRate,
} from "@intell/shared";
import type { AudioBuffer } from "react-native-audio-api";

export { DECODE_CACHE_CAP_BYTES };

/**
 * Holds decoded AudioBuffers keyed by sha, with byte accounting in shared.
 * Size is float32 PCM at the AudioContext sample rate:
 * durationSec × contextSampleRate × channels × 4.
 */
export class BufferLruCache {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly accounting: DecodedBufferLruAccounting;
  private readonly contextSampleRate: number;

  constructor(
    contextSampleRate: number,
    capBytes: number = DECODE_CACHE_CAP_BYTES,
  ) {
    this.contextSampleRate = contextSampleRate;
    this.accounting = new DecodedBufferLruAccounting(capBytes);
  }

  get decodedBytes(): number {
    return this.accounting.decodedBytes;
  }

  get cacheEvictions(): number {
    return this.accounting.cacheEvictions;
  }

  get(sha: string): AudioBuffer | undefined {
    const buffer = this.buffers.get(sha);
    if (!buffer) return undefined;
    this.accounting.touch(sha);
    return buffer;
  }

  set(sha: string, buffer: AudioBuffer): void {
    const bytes = estimateDecodedPcmBytesAtRate(
      buffer.duration,
      this.contextSampleRate,
      buffer.numberOfChannels,
    );
    const evicted = this.accounting.put(sha, bytes);
    for (const dropped of evicted) {
      this.buffers.delete(dropped);
    }
    this.buffers.set(sha, buffer);
  }

  clear(): void {
    this.buffers.clear();
    this.accounting.clear();
  }
}
