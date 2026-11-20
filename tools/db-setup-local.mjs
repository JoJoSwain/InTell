/**
 * M2a: `supabase db reset`, then write run-jobs Vault secrets from status env.
 * Secrets are never committed; seed.sql does not write them.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, {
    stdio: opts.capture ? "pipe" : "inherit",
    encoding: "utf8",
    env: process.env,
    shell: true,
  });
}

function parseEnv(text) {
  const out = {};
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

run("node tools/sync-edge-shared.mjs");
run("pnpm exec supabase db reset");

const env = parseEnv(run("pnpm exec supabase status -o env", { capture: true }));
const serviceKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("SERVICE_ROLE_KEY missing from supabase status -o env");
  process.exit(1);
}

const runJobsUrl =
  process.env.RUN_JOBS_URL ||
  "http://host.docker.internal:54321/functions/v1/run-jobs";

const esc = (s) => s.replace(/'/g, "''");
const sql = `create extension if not exists supabase_vault with schema vault;
delete from vault.secrets where name in ('run_jobs_url','run_jobs_service_key');
select vault.create_secret('${esc(runJobsUrl)}', 'run_jobs_url', 'M2a local run-jobs URL');
select vault.create_secret('${esc(serviceKey)}', 'run_jobs_service_key', 'M2a local service role key');
`;

const tmp = path.join(os.tmpdir(), "intell-vault-setup.sql");
fs.writeFileSync(tmp, sql, "utf8");
try {
  run(
    `docker exec -i supabase_db_Replaceplace psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c ${JSON.stringify(sql)}`,
  );
} finally {
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

console.log("Vault secrets run_jobs_url / run_jobs_service_key written.");
console.log(`run_jobs_url=${runJobsUrl}`);

try {
  run("node tools/seed-media-upload.mjs");
} catch (e) {
  console.warn(
    "seed-media-upload skipped (generate tones with pnpm db:seed-media-meta first):",
    e?.message ?? e,
  );
}

run("node tools/sync-edge-shared.mjs");
try {
  run("node tools/seed-media-upload.mjs");
} catch (e) {
  console.warn(
    "seed-media-upload failed (start stack / generate tones first):",
    e?.message ?? e,
  );
}
