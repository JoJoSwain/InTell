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
 * Service-role only. Compares the bearer token to SUPABASE_SERVICE_ROLE_KEY
 * (constant-time). Do not trust unverified JWT claims (S3).
 */
export function requireServiceRole(req: Request): Response | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "missing bearer token" }, 401);
  }
  const jwt = auth.slice("Bearer ".length);
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!expected || !timingSafeEqual(jwt, expected)) {
    return json({ error: "service_role required" }, 403);
  }
  return null;
}
