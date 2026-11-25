import {
  DeleteDeviceDataRequest,
  DeleteDeviceDataResponse,
} from "../_shared/from-shared/device.ts";
import { json } from "../_shared/http.ts";

export const ENDPOINT = "delete-device-data";
export const LIMIT = 5;
export const WINDOW_SECONDS = 86_400;

export function deviceRef(deviceId: string): string {
  return deviceId.slice(0, 8);
}

export function formatDeleteLog(deviceId: string, event: string): string {
  return `delete-device-data ${event} device=${deviceRef(deviceId)}`;
}

export type DeleteDeps = {
  deviceExists: (deviceId: string) => Promise<boolean | "error">;
  rateAllow: (deviceId: string) => Promise<boolean | "error">;
  /** Counts rows / files removed; must remove the devices row last. */
  deleteAll: (deviceId: string) => Promise<
    | {
        events: number;
        journalEntries: number;
        checkins: number;
        voiceFiles: number;
        rateLimits: number;
      }
    | { error: string }
  >;
  log: (deviceId: string | null, event: string) => void;
};

export async function handleDeleteDeviceData(
  body: unknown,
  deps: DeleteDeps,
): Promise<Response> {
  const parsed = DeleteDeviceDataRequest.safeParse(body);
  if (!parsed.success) {
    deps.log(null, "invalid-body");
    return json({ error: "invalid body" }, 400);
  }
  const { deviceId } = parsed.data;

  const exists = await deps.deviceExists(deviceId);
  if (exists === "error") {
    deps.log(deviceId, "device-lookup-error");
    return json({ error: "device lookup failed" }, 500);
  }
  if (!exists) {
    deps.log(deviceId, "device-not-registered");
    return json({ error: "device_not_registered" }, 404);
  }

  const allowed = await deps.rateAllow(deviceId);
  if (allowed === "error") {
    deps.log(deviceId, "rate-limit-error");
    return json({ error: "rate limit unavailable" }, 500);
  }
  if (!allowed) {
    deps.log(deviceId, "rate-limited");
    return json({ error: "rate limited" }, 429);
  }

  const result = await deps.deleteAll(deviceId);
  if ("error" in result) {
    deps.log(deviceId, "delete-error");
    return json({ error: "delete failed" }, 500);
  }

  const response = DeleteDeviceDataResponse.parse({
    ok: true as const,
    events: result.events,
    journalEntries: result.journalEntries,
    checkins: result.checkins,
    voiceFiles: result.voiceFiles,
    rateLimits: result.rateLimits,
    device: 1 as const,
  });
  deps.log(deviceId, "ok");
  return json(response);
}
