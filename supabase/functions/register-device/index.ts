import {
  RegisterDeviceRequest,
  RegisterDeviceResponse,
} from "../_shared/from-shared/device.ts";
import { serviceClient } from "../_shared/clients.ts";
import { json, requirePublishableCaller } from "../_shared/http.ts";

const ENDPOINT = "register-device";
const LIMIT = 30;
const WINDOW_SECONDS = 3600;

/** At most the first 8 characters. device_id is a bearer secret. */
function deviceRef(deviceId: string): string {
  return deviceId.slice(0, 8);
}

function logDevice(deviceId: string, event: string): void {
  const ref = deviceRef(deviceId);
  // The prefix is not the id. Never interpolate the full id or error text
  // that may echo it.
  console.log(`register-device ${event} device=${ref}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const denied = requirePublishableCaller(req);
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }
  const parsed = RegisterDeviceRequest.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid body" }, 400);

  const body = parsed.data;
  const setAge = body.ageGate !== undefined;
  const svc = serviceClient();

  const { data: allowed, error: rateErr } = await svc.rpc("fn_device_rate_allow", {
    p_device_id: body.deviceId,
    p_endpoint: ENDPOINT,
    p_limit: LIMIT,
    p_window_seconds: WINDOW_SECONDS,
  });
  if (rateErr || typeof allowed !== "boolean") {
    logDevice(body.deviceId, "rate-limit-error");
    return json({ error: "rate limit unavailable" }, 500);
  }
  if (!allowed) {
    logDevice(body.deviceId, "rate-limited");
    return json({ error: "rate limited" }, 429);
  }

  const { data: firstSeen, error } = await svc.rpc("fn_register_device", {
    p_id: body.deviceId,
    p_platform: body.platform,
    p_app_version: body.appVersion,
    p_ui_language: body.uiLanguage,
    p_age_gate: setAge ? body.ageGate : null,
    p_set_age_gate: setAge,
  });
  if (error || typeof firstSeen !== "string") {
    logDevice(body.deviceId, "upsert-error");
    return json({ error: "register failed" }, 500);
  }

  let response: { ok: true; firstSeenAt: string };
  try {
    response = RegisterDeviceResponse.parse({
      ok: true,
      firstSeenAt: new Date(firstSeen).toISOString(),
    });
  } catch {
    logDevice(body.deviceId, "response-error");
    return json({ error: "register failed" }, 500);
  }

  logDevice(body.deviceId, "ok");
  return json(response);
});
