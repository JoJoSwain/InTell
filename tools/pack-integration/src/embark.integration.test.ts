import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EmbarkResponse } from "@intell/shared";
import { supabaseEnv } from "./env";
import { GROVE_ID, ORIGIN, POLYLINE_WALK } from "./embarkFixtures";

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

function publishableHeaders(): Record<string, string> {
  return {
    apikey: publishable!,
    Authorization: `Bearer ${publishable}`,
    "Content-Type": "application/json",
  };
}

async function register(deviceId: string) {
  const res = await fetch(`${url}/functions/v1/register-device`, {
    method: "POST",
    headers: publishableHeaders(),
    body: JSON.stringify({
      deviceId,
      platform: "ios",
      appVersion: "1.0.0",
      uiLanguage: "en",
    }),
  });
  expect(res.status).toBe(200);
}

async function embark(
  payload: unknown,
  headers: Record<string, string> = publishableHeaders(),
): Promise<Response> {
  return fetch(`${url}/functions/v1/embark`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

describe("embark integration", () => {
  it("happy path walk, bike, and transit against the stub", async () => {
    const deviceId = randomUUID();
    await register(deviceId);

    for (const mode of ["walk", "bike", "transit"] as const) {
      const res = await embark({
        deviceId,
        groveId: GROVE_ID,
        mode,
        origin: ORIGIN,
        lang: "en",
      });
      expect(res.status).toBe(200);
      const body = EmbarkResponse.parse(await res.json());
      expect(body.mode).toBe(mode);
      expect(body.polyline.length).toBeGreaterThan(0);
      expect(Array.isArray(body.warnings)).toBe(true);
      if (mode === "transit") {
        expect(body.steps?.length).toBeGreaterThan(0);
      } else {
        expect(body.steps).toBeUndefined();
      }
      if (mode === "walk") {
        expect(body.polyline).toBe(POLYLINE_WALK);
      }
    }
  });

  it("returns 429 after the daily window is exhausted via RPC", async () => {
    const deviceId = randomUUID();
    await register(deviceId);

    for (let i = 0; i < 60; i++) {
      const { data, error } = await svc.rpc("fn_device_rate_allow", {
        p_device_id: deviceId,
        p_endpoint: "embark",
        p_limit: 60,
        p_window_seconds: 86400,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }
    const { data: blocked } = await svc.rpc("fn_device_rate_allow", {
      p_device_id: deviceId,
      p_endpoint: "embark",
      p_limit: 60,
      p_window_seconds: 86400,
    });
    expect(blocked).toBe(false);

    const res = await embark({
      deviceId,
      groveId: GROVE_ID,
      mode: "walk",
      origin: ORIGIN,
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate limited" });
  });

  it("refuses a missing key and a secret key", async () => {
    const deviceId = randomUUID();
    await register(deviceId);
    const payload = {
      deviceId,
      groveId: GROVE_ID,
      mode: "walk" as const,
      origin: ORIGIN,
    };

    const missing = await embark(payload, {
      "Content-Type": "application/json",
    });
    expect(missing.status).toBe(401);

    const secret = await embark(payload, {
      "Content-Type": "application/json",
      apikey: serviceKey!,
      Authorization: `Bearer ${serviceKey}`,
    });
    expect(secret.status).toBe(403);
  });
});
