import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { serviceKey } from "./keys.ts";

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = serviceKey();
  return createClient(url, key, { auth: { persistSession: false } });
}

export function functionsBaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  return `${url.replace(/\/$/, "")}/functions/v1`;
}
