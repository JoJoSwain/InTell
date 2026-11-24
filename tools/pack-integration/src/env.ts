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
  const secret = process.env.SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const publishable =
    process.env.PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  const fromProcess = {
    API_URL: process.env.API_URL ?? process.env.SUPABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.API_URL,
    SECRET_KEY: secret,
    PUBLISHABLE_KEY: publishable,
  };
  if (fromProcess.API_URL && fromProcess.SECRET_KEY && fromProcess.PUBLISHABLE_KEY) {
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
  const resolvedSecret = out.SECRET_KEY ?? out.SUPABASE_SECRET_KEY;
  const resolvedPublishable = out.PUBLISHABLE_KEY ?? out.SUPABASE_PUBLISHABLE_KEY;
  if (resolvedSecret) {
    out.SECRET_KEY = resolvedSecret;
  }
  if (resolvedPublishable) {
    out.PUBLISHABLE_KEY = resolvedPublishable;
  }
  return out;
}