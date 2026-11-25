import { serviceClient } from "../_shared/clients.ts";
import { json, requirePublishableCaller } from "../_shared/http.ts";
import {
  ENDPOINT,
  LIMIT,
  WINDOW_SECONDS,
  deleteDeviceRecords,
  formatDeleteLog,
  handleDeleteDeviceData,
  interpretVoiceRemoval,
  voiceObjectPath,
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

  return handleDeleteDeviceData(payload, {
    log: (deviceId, event) => {
      if (deviceId == null) {
        console.log(`delete-device-data ${event}`);
        return;
      }
      console.log(formatDeleteLog(deviceId, event));
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
    deleteAll: async (deviceId) => {
      const { count: eventCount, error: evErr } = await svc
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("device_id", deviceId);
      if (evErr) return { error: evErr.message };

      const { data: journals, error: jErr } = await svc
        .from("journal_entries")
        .select("id, voice_path")
        .eq("device_id", deviceId);
      if (jErr) return { error: jErr.message };

      const voicePaths = (journals ?? [])
        .map((row) => (row.voice_path ? voiceObjectPath(String(row.voice_path)) : ""))
        .filter((path) => path.length > 0);

      const { count: checkinCount, error: cErr } = await svc
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("device_id", deviceId);
      if (cErr) return { error: cErr.message };

      const { count: rateCount, error: rErr } = await svc
        .from("device_rate_limits")
        .select("device_id", { count: "exact", head: true })
        .eq("device_id", deviceId);
      if (rErr) return { error: rErr.message };

      return deleteDeviceRecords({
        voicePaths,
        removeVoices: async (paths) => {
          const { data, error } = await svc.storage
            .from("journal-voice")
            .remove(paths);
          return interpretVoiceRemoval(
            error,
            (data ?? null) as { name?: string; error?: string; message?: string }[] | null,
            paths.length,
          );
        },
        deleteRows: async () => {
          // Rate limits have no FK cascade — delete explicitly before the device.
          const { error: rlDel } = await svc
            .from("device_rate_limits")
            .delete()
            .eq("device_id", deviceId);
          if (rlDel) return { error: rlDel.message };

          // Cascades events, journal_entries (+ entry_links), checkins.
          const { error: delErr } = await svc
            .from("devices")
            .delete()
            .eq("id", deviceId);
          if (delErr) return { error: delErr.message };

          return {
            events: eventCount ?? 0,
            journalEntries: journals?.length ?? 0,
            checkins: checkinCount ?? 0,
            rateLimits: rateCount ?? 0,
          };
        },
      });
    },
  });
});
