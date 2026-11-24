import { EmbarkRequest } from "../_shared/from-shared/embark.ts";
import { serviceClient } from "../_shared/clients.ts";
import { json, requirePublishableCaller } from "../_shared/http.ts";
import {
  EMBARK_ENDPOINT,
  EMBARK_LIMIT,
  EMBARK_WINDOW_SECONDS,
  formatEmbarkLog,
  handleEmbark,
  type EmbarkDeps,
} from "./handler.ts";
import { lookupLiveOpening } from "./opening.ts";

function deviceRefLog(
  deviceId: string | null,
  outcome: string,
  mode?: Parameters<EmbarkDeps["log"]>[2],
): void {
  console.log(formatEmbarkLog(deviceId, outcome, mode));
}

function wireDeps(): EmbarkDeps {
  const svc = serviceClient();
  const base =
    Deno.env.get("GOOGLE_ROUTES_BASE_URL")?.trim() ||
    "https://routes.googleapis.com";
  const key = Deno.env.get("GOOGLE_ROUTES_API_KEY")?.trim() ?? "";

  return {
    fetch,
    routesBaseUrl: base,
    routesApiKey: key,
    log: deviceRefLog,
    async deviceExists(deviceId) {
      const { data, error } = await svc
        .from("devices")
        .select("id")
        .eq("id", deviceId)
        .maybeSingle();
      if (error) throw new Error("device lookup failed");
      return Boolean(data?.id);
    },
    async rateAllow(deviceId) {
      const { data, error } = await svc.rpc("fn_device_rate_allow", {
        p_device_id: deviceId,
        p_endpoint: EMBARK_ENDPOINT,
        p_limit: EMBARK_LIMIT,
        p_window_seconds: EMBARK_WINDOW_SECONDS,
      });
      if (error || typeof data !== "boolean") {
        throw new Error("rate limit unavailable");
      }
      return data;
    },
    lookupOpening: (groveId) => lookupLiveOpening(svc, groveId),
  };
}

Deno.serve(async (req) => {
  let deviceId: string | null = null;
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const denied = requirePublishableCaller(req);
    if (denied) return denied;

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      deviceRefLog(null, "invalid-body");
      return json({ error: "invalid body" }, 400);
    }

    // Peek deviceId only for the top-level catch prefix — never log the body (R2).
    if (payload && typeof payload === "object" && "deviceId" in payload) {
      const raw = (payload as { deviceId?: unknown }).deviceId;
      if (typeof raw === "string" && EmbarkRequest.shape.deviceId.safeParse(raw).success) {
        deviceId = raw;
      }
    }

    return await handleEmbark(payload, wireDeps());
  } catch {
    // Never log the error message or stack — they can hold request data (R2).
    deviceRefLog(deviceId, "internal-error");
    return json({ error: "internal" }, 500);
  }
});
