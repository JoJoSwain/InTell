import type { TelemetryEvent } from "../_shared/from-shared/events.ts";
import { serviceClient } from "../_shared/clients.ts";
import { json, requirePublishableCaller } from "../_shared/http.ts";
import {
  ENDPOINT,
  LIMIT,
  WINDOW_SECONDS,
  formatIngestLog,
  handleIngest,
} from "./handler.ts";

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

  const svc = serviceClient();

  return handleIngest(payload, {
    now: () => new Date(),
    log: (deviceId, event) => {
      if (deviceId == null) {
        console.log(`ingest-events ${event}`);
        return;
      }
      console.log(formatIngestLog(deviceId, event));
    },
    deviceExists: async (deviceId) => {
      const { data, error } = await svc
        .from("devices")
        .select("id")
        .eq("id", deviceId)
        .maybeSingle();
      if (error) return "error";
      return data != null;
    },
    rateAllow: async (deviceId) => {
      const { data, error } = await svc.rpc("fn_device_rate_allow", {
        p_device_id: deviceId,
        p_endpoint: ENDPOINT,
        p_limit: LIMIT,
        p_window_seconds: WINDOW_SECONDS,
      });
      if (error || typeof data !== "boolean") return "error";
      return data;
    },
    insertEvents: async (deviceId, events) => {
      const rows = events.map((e: TelemetryEvent) => ({
        device_id: deviceId,
        client_event_id: e.clientEventId,
        name: e.name,
        occurred_at: e.occurredAt,
        grove_id: e.groveId ?? null,
        fragment_id: e.fragmentId ?? null,
        revision_id: e.revisionId ?? null,
        session_id: e.sessionId ?? null,
        props: e.props,
        schema_version: e.v,
      }));
      const { data, error } = await svc
        .from("events")
        .upsert(rows, {
          onConflict: "device_id,client_event_id",
          ignoreDuplicates: true,
        })
        .select("client_event_id");
      if (error) {
        return { error: error.message };
      }
      const inserted = data?.length ?? 0;
      return { inserted, duplicates: events.length - inserted };
    },
  });
});
