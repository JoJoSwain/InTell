import {
  IngestEventsRequest,
  IngestEventsResponse,
  isFutureDated,
  parseTelemetryEvent,
  type DropReason,
  type TelemetryEvent,
} from "../_shared/from-shared/events.ts";
import { json } from "../_shared/http.ts";

export const ENDPOINT = "ingest-events";
export const LIMIT = 600;
export const WINDOW_SECONDS = 3600;

/** At most the first 8 characters. device_id is a bearer secret. */
export function deviceRef(deviceId: string): string {
  return deviceId.slice(0, 8);
}

export function formatIngestLog(deviceId: string, event: string): string {
  return `ingest-events ${event} device=${deviceRef(deviceId)}`;
}

export type IngestDeps = {
  /** true / false / "error" when the devices lookup itself fails. */
  deviceExists: (deviceId: string) => Promise<boolean | "error">;
  rateAllow: (deviceId: string) => Promise<boolean | "error">;
  insertEvents: (
    deviceId: string,
    events: TelemetryEvent[],
  ) => Promise<{ inserted: number; duplicates: number } | { error: string }>;
  now: () => Date;
  log: (deviceId: string | null, event: string) => void;
};

type Dropped = { clientEventId: string; reason: DropReason };

function dropRow(
  clientEventId: string | undefined,
  reason: DropReason,
  dropped: Dropped[],
): void {
  if (!clientEventId) return;
  dropped.push({ clientEventId, reason });
}

/**
 * Body must already be parsed JSON. Auth (publishable key) is checked in index.
 */
export async function handleIngest(
  body: unknown,
  deps: IngestDeps,
): Promise<Response> {
  const envelope = IngestEventsRequest.safeParse(body);
  if (!envelope.success) {
    deps.log(null, "invalid-body");
    return json({ error: "invalid body" }, 400);
  }
  const { deviceId, events: rawEvents } = envelope.data;

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

  const now = deps.now();
  const accepted: TelemetryEvent[] = [];
  const dropped: Dropped[] = [];

  for (const raw of rawEvents) {
    const parsed = parseTelemetryEvent(raw);
    if (!parsed.ok) {
      dropRow(parsed.clientEventId, parsed.reason, dropped);
      continue;
    }
    if (isFutureDated(parsed.event.occurredAt, now)) {
      dropRow(parsed.event.clientEventId, "future_dated", dropped);
      continue;
    }
    accepted.push(parsed.event);
  }

  let inserted = 0;
  let duplicates = 0;
  if (accepted.length > 0) {
    const result = await deps.insertEvents(deviceId, accepted);
    if ("error" in result) {
      deps.log(deviceId, "insert-error");
      return json({ error: "ingest failed" }, 500);
    }
    inserted = result.inserted;
    duplicates = result.duplicates;
  }

  const response = IngestEventsResponse.parse({
    accepted: inserted,
    duplicates,
    dropped,
  });
  deps.log(deviceId, "ok");
  return json(response);
}
