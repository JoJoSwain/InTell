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
 * Service API key from the `apikey` header only (never Bearer — keys are not JWTs).
 * Empty string when absent.
 */
export function serviceCredentialFrom(req: Request): string {
  const apiKey = (req.headers.get("apikey") ?? "").trim();
  return apiKey.length > 0 ? apiKey : "";
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
 * Mobile callers that send the publishable key in `apikey` and no user JWT.
 * A staff JWT, a secret key, or any other credential is refused.
 */
export function requirePublishableCaller(req: Request): Response | null {
  const credential = serviceCredentialFrom(req);
  if (!credential) {
    return json({ error: "missing api key" }, 401);
  }
  const pub = publishableKey();
  if (!pub || !timingSafeEqual(credential, pub)) {
    return json({ error: "publishable key required" }, 403);
  }
  return null;
}

/**
 * Service callers only (run-jobs / build-pack / purge-assets).
 * Accepts secret key in `apikey` only. Publishable keys and user JWTs are refused.
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
