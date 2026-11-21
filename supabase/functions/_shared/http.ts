import { publishableKey, secretKeys } from "./keys.ts";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Constant-time string equality (UTF-8 bytes). */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ba.length, bb.length);
  let out = ba.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    out |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return out === 0;
}

/**
 * Candidate service credential: `apikey` header first, else Bearer token.
 * Empty string when neither is present.
 */
export function serviceCredentialFrom(req: Request): string {
  const apiKey = (req.headers.get("apikey") ?? "").trim();
  if (apiKey.length > 0) return apiKey;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  return "";
}

/** True when the credential matches any configured secret key (constant-time). */
export function matchesSecretKey(credential: string): boolean {
  if (!credential) return false;
  const secrets = secretKeys();
  let matched = false;
  for (const expected of secrets) {
    if (expected && timingSafeEqual(credential, expected)) matched = true;
  }
  return matched;
}

/**
 * Service callers only (run-jobs / build-pack / purge-assets).
 * Accepts secret key in `apikey` or `Authorization: Bearer` (transition).
 * Publishable/anon keys and user JWTs are always refused.
 */
export function requireServiceCaller(req: Request): Response | null {
  const credential = serviceCredentialFrom(req);
  if (!credential) {
    return json({ error: "missing service key" }, 401);
  }
  const pub = publishableKey();
  if (pub && timingSafeEqual(credential, pub)) {
    return json({ error: "service key required" }, 403);
  }
  if (!matchesSecretKey(credential)) {
    return json({ error: "service key required" }, 403);
  }
  return null;
}
