/**
 * Physical-marker code → pack markerHash (TECH_SPEC M5 note).
 * Upper-case Crockford base32 path segment, then UTF-8 sha256.
 */
import * as Crypto from "expo-crypto";

export function normalizeMarkerCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Async sha256 hex of the upper-cased code (device / Expo). */
export async function hashMarkerCode(code: string): Promise<string> {
  const normalized = normalizeMarkerCode(code);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}

/** Sync sha256 for Jest (Node). Do not use on device. */
export function hashMarkerCodeSync(code: string, sha256Hex: (utf8: string) => string): string {
  return sha256Hex(normalizeMarkerCode(code));
}
