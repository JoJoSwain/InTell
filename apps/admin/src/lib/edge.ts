import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Call a Supabase edge function with the signed-in session JWT.
 * Never uses the service role (TECH_SPEC §4).
 */
export async function callEdgeFunction(
  supabase: SupabaseClient,
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; status: number; data: unknown } | { ok: false; status: number; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, status: 401, error: "not signed in" };
  }

  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
    [key: string]: unknown;
  };

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: json.detail ?? json.error ?? `${name} ${res.status}`,
    };
  }
  return { ok: true, status: res.status, data: json };
}
