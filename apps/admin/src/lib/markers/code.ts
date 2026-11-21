/** Crockford base32 (upper case). No I, L, O, U. */
export const MARKER_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const MARKER_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** Eight-character Crockford base32 via crypto.getRandomValues; byte & 31 (unbiased). */
export function generateMarkerCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += MARKER_ALPHABET[bytes[i]! & 31];
  }
  return out;
}

export function isValidMarkerCode(code: string): boolean {
  return MARKER_RE.test(code);
}

/** sha256 hex of UTF-8 bytes of the upper-case code (TECH_SPEC / M3c B4). */
export async function hashMarkerCode(code: string): Promise<string> {
  const upper = code.toUpperCase();
  const data = new TextEncoder().encode(upper);
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(upper, "utf8").digest("hex");
}
