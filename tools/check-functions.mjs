/**
 * CI: `deno check` every edge function that has an index.ts (skip _shared).
 * Stops at the first failure and prints the function name.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsRoot = path.join(root, "supabase", "functions");

const entries = fs
  .readdirSync(functionsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "_shared")
  .map((d) => d.name)
  .sort();

for (const name of entries) {
  const dir = path.join(functionsRoot, name);
  const indexTs = path.join(dir, "index.ts");
  if (!fs.existsSync(indexTs)) continue;

  const config = path.join(dir, "deno.json");
  if (!fs.existsSync(config)) {
    console.error(`FAIL ${name}: missing deno.json`);
    process.exit(1);
  }

  const relConfig = path.join("supabase", "functions", name, "deno.json");
  const relIndex = path.join("supabase", "functions", name, "index.ts");
  console.log(`deno check ${name}…`);
  const result = spawnSync(
    "deno",
    ["check", "--config", relConfig, relIndex],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
    },
  );
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.error(`FAIL: deno check failed for ${name}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`deno check ok (${entries.length} function folders scanned)`);
