import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publishableKey } from "./keys.ts";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

export type StaffAuth =
  | { ok: false; response: Response }
  | { ok: true; userClient: SupabaseClient; userId: string };

/**
 * Editor or admin via caller JWT.
 * Relies on gateway verify_jwt=true, then PostgREST + fn_is_editor_or_admin
 * (does not trust unverified JWT claims for authorization).
 */
export async function requireStaffEditor(req: Request): Promise<StaffAuth> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, response: errorResponse("missing bearer token", 401) };
  }
  const jwt = auth.slice("Bearer ".length);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishable = publishableKey();
  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return { ok: false, response: errorResponse("invalid session", 401) };
  }

  const { data: allowed, error } = await userClient.rpc("fn_is_editor_or_admin");
  if (error || !allowed) {
    return { ok: false, response: errorResponse("editor role required", 403) };
  }
  return { ok: true, userClient, userId: userData.user.id };
}

/**
 * Admin via caller JWT (invite-staff). Same verification pattern as requireStaffEditor.
 */
export async function requireStaffAdmin(req: Request): Promise<StaffAuth> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, response: errorResponse("missing bearer token", 401) };
  }
  const jwt = auth.slice("Bearer ".length);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishable = publishableKey();
  const userClient = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return { ok: false, response: errorResponse("invalid session", 401) };
  }

  const { data: allowed, error } = await userClient.rpc("fn_is_admin");
  if (error || !allowed) {
    return { ok: false, response: errorResponse("admin role required", 403) };
  }
  return { ok: true, userClient, userId: userData.user.id };
}
