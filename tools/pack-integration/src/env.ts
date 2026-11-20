import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function supabaseEnv(): Record<string, string> {
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
  return out;
}

export const DEMO = {
  groveId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000010",
  regionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
  frag4RevId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000043",
  frag8RevId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000047",
  frag10R2Id: "aaaaaaaa-bbbb-4ccc-8ddd-00000000004a",
  crossroadsId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000070",
  optionAId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000071",
  storytellerConsentId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000053",
  frag4AssetSha:
    "56bf2aee6f44f93dacfad0bbb51b522b0becad55d0a3aa01108f9f6fc8440b59",
};
