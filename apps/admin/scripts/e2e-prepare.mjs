#!/usr/bin/env node
/**
 * Creates admin / editor / writer Auth users + staff rows for Playwright.
 * Writes credentials to e2e/.auth-users.json (gitignored). Never prints passwords.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(adminRoot, "../..");
const outPath = join(adminRoot, "e2e/.auth-users.json");

function statusEnv() {
  try {
    const out = execSync("pnpm exec supabase status -o env", {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const map = {};
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) map[m[1]] = m[2].replace(/^"|"$/g, "");
    }
    return map;
  } catch {
    return {};
  }
}

const env = statusEnv();
const url = process.env.SUPABASE_URL || env.API_URL || env.SUPABASE_URL;
const service =
  process.env.SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SECRET_KEY ||
  env.SERVICE_ROLE_KEY;
const anon =
  process.env.PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  env.PUBLISHABLE_KEY ||
  env.ANON_KEY;

if (!url || !service) {
  console.error(
    "Need SUPABASE_URL and SECRET_KEY / SERVICE_ROLE_KEY (or supabase status)",
  );
  process.exit(1);
}

const svc = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const roles = ["admin", "editor", "writer"];
const users = {};

for (const role of roles) {
  const email = `e2e-${role}-${stamp}@test.local`;
  const password = `e2e-${role}-${randomBytes(12).toString("hex")}-Ok`;
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error(`createUser ${role}:`, error?.message ?? "no user");
    process.exit(1);
  }
  const { error: staffErr } = await svc.from("staff").insert({
    user_id: data.user.id,
    display_name: `E2E ${role}`,
    role,
    active: true,
  });
  if (staffErr) {
    console.error(`staff ${role}:`, staffErr.message);
    process.exit(1);
  }
  users[role] = { email, password, userId: data.user.id };
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      supabaseUrl: url,
      anonKey: anon ?? "",
      // Local demo service role only — gitignored; used to drain run-jobs in e2e.
      serviceRoleKey: service,
      users,
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

console.log(`Wrote ${roles.length} e2e users to e2e/.auth-users.json`);
