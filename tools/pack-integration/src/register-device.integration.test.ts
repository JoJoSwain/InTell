import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { RegisterDeviceResponse } from "@intell/shared";
import { supabaseEnv } from "./env";

const env = supabaseEnv();
const url = env.API_URL || env.SUPABASE_URL;
const serviceKey =
  env.SECRET_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const publishable =
  env.PUBLISHABLE_KEY || env.ANON_KEY || env.SUPABASE_ANON_KEY;
if (!url || !serviceKey || !publishable) {
  throw new Error("supabase status missing keys — run supabase start");
}

const svc = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function body(deviceId: string, extra: Record<string, unknown> = {}) {
  return {
    deviceId,
    platform: "ios",
    appVersion: "1.0.0",
    uiLanguage: "en",
    ...extra,
  };
}

async function post(
  payload: unknown,
  headers: Record<string, string>,
): Promise<Response> {
  return fetch(`${url}/functions/v1/register-device`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

function publishableHeaders(authorization?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: publishable! };
  if (authorization) headers.Authorization = authorization;
  else headers.Authorization = `Bearer ${publishable}`;
  return headers;
}

function edgeLogs(): string {
  const out = execSync(
    "docker logs supabase_edge_runtime_Replaceplace --since 3m 2>&1",
    { encoding: "utf8", shell: true },
  );
  return typeof out === "string" ? out : String(out ?? "");
}

describe("register-device", () => {
  it("registers, updates without moving first_seen_at, and omits age_gate when absent", async () => {
    const deviceId = randomUUID();
    const created = await post(
      body(deviceId, { ageGate: "18_plus" }),
      publishableHeaders(),
    );
    expect(created.status).toBe(200);
    const first = RegisterDeviceResponse.parse(await created.json());

    const again = await post(
      body(deviceId, { platform: "android", appVersion: "2.0.0", uiLanguage: "es" }),
      publishableHeaders(),
    );
    expect(again.status).toBe(200);
    const second = RegisterDeviceResponse.parse(await again.json());
    expect(second.firstSeenAt).toBe(first.firstSeenAt);

    const { data, error } = await svc
      .from("devices")
      .select("platform, app_version, ui_language, age_gate, first_seen_at")
      .eq("id", deviceId)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      platform: "android",
      app_version: "2.0.0",
      ui_language: "es",
      age_gate: "18_plus",
    });
  });

  it("returns 400 for a bad body", async () => {
    const res = await post(
      { deviceId: "not-a-uuid", platform: "ios", appVersion: "1", uiLanguage: "en" },
      publishableHeaders(),
    );
    expect(res.status).toBe(400);
  });

  it("refuses a missing key, a secret key, and a staff JWT on its own", async () => {
    const deviceId = randomUUID();
    const missing = await post(body(deviceId), {});
    expect(missing.status).toBeGreaterThanOrEqual(401);
    expect(missing.status).toBeLessThan(500);

    const secret = await post(body(deviceId), {
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
    });
    expect(secret.status).toBe(403);

    const email = `a1-staff-${Date.now()}@test.local`;
    const password = "test-password-staff-1";
    const { data: created, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser");
    const { error: staffErr } = await svc.from("staff").insert({
      user_id: created.user.id,
      display_name: "A1 Staff",
      role: "editor",
      active: true,
    });
    if (staffErr) throw new Error(staffErr.message);
    const auth = createClient(url!, publishable!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signErr } = await auth.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !session.session) throw new Error(signErr?.message ?? "signIn");
    const jwt = session.session.access_token;

    const jwtOnly = await post(body(deviceId), {
      Authorization: `Bearer ${jwt}`,
    });
    expect(jwtOnly.status).toBeGreaterThanOrEqual(401);
    expect(jwtOnly.status).toBeLessThan(500);

    const otherId = randomUUID();
    const { error: otherErr } = await svc.from("devices").insert({
      id: otherId,
      platform: "ios",
      app_version: "9",
      ui_language: "en",
    });
    if (otherErr) throw new Error(otherErr.message);

    const withStaff = await post(body(deviceId, { ageGate: "13_17" }), {
      apikey: publishable!,
      Authorization: `Bearer ${jwt}`,
    });
    expect(withStaff.status).toBe(200);
    const payload = RegisterDeviceResponse.parse(await withStaff.json());
    expect(Object.keys(payload).sort()).toEqual(["firstSeenAt", "ok"]);
    expect(JSON.stringify(payload)).not.toContain(otherId);
    expect(JSON.stringify(payload)).not.toContain(deviceId);
  });

  it("returns 429 once the device is over the hourly limit and does not upsert", async () => {
    const deviceId = randomUUID();
    for (let i = 0; i < 30; i++) {
      const { data, error } = await svc.rpc("fn_device_rate_allow", {
        p_device_id: deviceId,
        p_endpoint: "register-device",
        p_limit: 30,
        p_window_seconds: 3600,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }
    const limited = await post(body(deviceId), publishableHeaders());
    expect(limited.status).toBe(429);
    const { data, error } = await svc
      .from("devices")
      .select("id")
      .eq("id", deviceId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("does not write the full device id to the edge logs", async () => {
    const deviceId = randomUUID();
    const res = await post(body(deviceId), publishableHeaders());
    expect(res.status).toBe(200);
    const logs = edgeLogs();
    const ours = logs
      .split(/\r?\n/)
      .filter((line) => line.includes("register-device"));
    expect(ours.some((line) => line.includes(`device=${deviceId.slice(0, 8)}`))).toBe(
      true,
    );
    expect(ours.some((line) => line.includes(deviceId))).toBe(false);
  });
});
