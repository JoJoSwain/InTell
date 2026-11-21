import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEMO } from "./test-constants";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export { DEMO } from "./test-constants";

export function supabaseEnv(): Record<string, string> {
  // Prefer process env (CI eval's `supabase status -o env` before vitest).
  // Calling `supabase status` after `functions serve` on Windows can stop the
  // edge_runtime container and break integration with 503.
  const secret =
    process.env.SECRET_KEY ??
    process.env.SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable =
    process.env.PUBLISHABLE_KEY ??
    process.env.ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  const fromProcess = {
    API_URL: process.env.API_URL ?? process.env.SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.API_URL,
    SECRET_KEY: process.env.SECRET_KEY ?? secret,
    SERVICE_ROLE_KEY: secret,
    SUPABASE_SERVICE_ROLE_KEY: secret,
    PUBLISHABLE_KEY: process.env.PUBLISHABLE_KEY ?? publishable,
    ANON_KEY: publishable,
    SUPABASE_ANON_KEY: publishable,
  };
  if (fromProcess.API_URL && fromProcess.SERVICE_ROLE_KEY && fromProcess.ANON_KEY) {
    return Object.fromEntries(
      Object.entries(fromProcess).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  }

  // Windows needs PowerShell for supabase status -o env; Linux CI has no powershell.exe.
  const text = execSync("pnpm exec supabase status -o env", {
    encoding: "utf8",
    cwd: root,
    shell: process.platform === "win32" ? "powershell.exe" : true,
  }) as string;
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  // Normalize aliases after parsing CLI output.
  const resolvedSecret =
    out.SECRET_KEY || out.SERVICE_ROLE_KEY || out.SUPABASE_SERVICE_ROLE_KEY;
  const resolvedPublishable =
    out.PUBLISHABLE_KEY || out.ANON_KEY || out.SUPABASE_ANON_KEY;
  if (resolvedSecret) {
    out.SECRET_KEY = out.SECRET_KEY || resolvedSecret;
    out.SERVICE_ROLE_KEY = resolvedSecret;
    out.SUPABASE_SERVICE_ROLE_KEY = resolvedSecret;
  }
  if (resolvedPublishable) {
    out.PUBLISHABLE_KEY = out.PUBLISHABLE_KEY || resolvedPublishable;
    out.ANON_KEY = resolvedPublishable;
    out.SUPABASE_ANON_KEY = resolvedPublishable;
  }
  return out;
}
