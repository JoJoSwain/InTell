import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { publishableKey, serviceKey } from "./keys.ts";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = serviceKey();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(authHeader: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const publishable = publishableKey();
  return createClient(url, publishable, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAuthHeader(req: Request): string | null {
  return req.headers.get("Authorization");
}
