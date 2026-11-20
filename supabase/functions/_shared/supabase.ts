import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export function functionsBaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return `${url.replace(/\/$/, "")}/functions/v1`;
}