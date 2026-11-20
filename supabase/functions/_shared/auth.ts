import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

/** Service role only (internal workers). */
export function requireServiceRole(req: Request): Response | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return errorResponse("missing bearer token", 401);
  }
  const jwt = auth.slice(7);
  const payload = parseJwtPayload(jwt);
  if (!payload || payload.role !== "service_role") {
    return errorResponse("service role required", 403);
  }
  return null;
}

function parseJwtPayload(jwt: string): { role?: string } | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { role?: string };
  } catch {
    return null;
  }
}

export type StaffAuth =
  | { ok: false; response: Response }
  | { ok: true; userClient: SupabaseClient; userId: string };

/** Editor or admin via caller JWT + has_role RPC. */
export async function requireStaffEditor(req: Request): Promise<StaffAuth> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, response: errorResponse("missing bearer token", 401) };
  }
  const jwt = auth.slice(7);
  const payload = parseJwtPayload(jwt);
  if (!payload || payload.role !== "authenticated") {
    return { ok: false, response: errorResponse("staff session required", 403) };
  }
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: allowed, error } = await userClient.rpc("fn_is_editor_or_admin");
  if (error || !allowed) {
    return { ok: false, response: errorResponse("editor role required", 403) };
  }
  const sub = (payload as { sub?: string }).sub;
  if (!sub) {
    return { ok: false, response: errorResponse("invalid token", 403) };
  }
  return { ok: true, userClient, userId: sub };
}