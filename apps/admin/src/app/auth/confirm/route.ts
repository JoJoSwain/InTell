import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sanitizeNext } from "@/lib/auth-redirect";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const ALLOWED: ReadonlySet<string> = new Set(["invite", "recovery"]);

/** Keep host identical to the request (127.0.0.1 vs localhost breaks cookies). */
function redirectOnSameHost(request: NextRequest, pathWithQuery: string) {
  const base = new URL(request.url);
  const target = new URL(pathWithQuery, base);
  target.protocol = base.protocol;
  target.host = base.host;
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeNext(searchParams.get("next"), "/auth/set-password");

  if (!token_hash || !type || !ALLOWED.has(type)) {
    return redirectOnSameHost(request, "/sign-in?error=link");
  }

  let response = redirectOnSameHost(request, next);

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = redirectOnSameHost(request, next);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash,
  });

  if (error) {
    return redirectOnSameHost(request, "/sign-in?error=link");
  }

  return response;
}
