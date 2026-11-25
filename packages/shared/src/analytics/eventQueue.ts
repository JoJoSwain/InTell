import {
  EVENT_SCHEMA_VERSION,
  IngestEventsResponse,
  isFutureDated,
  parseTelemetryEvent,
  type DropReason,
  type TelemetryEvent,
} from "../schemas/events";

/** Max events retained on device (A7 G12). */
export const EVENT_QUEUE_CAP = 5_000;

/** Max events per ingest POST (TECH_SPEC §5). */
export const EVENT_BATCH_MAX = 200;

/** Foreground flush interval (A7 G13). */
export const EVENT_FLUSH_INTERVAL_MS = 5 * 60_000;

const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 30 * 60_000;
const RETRY_JITTER = 0.2;

export type QueuedTelemetryEvent = TelemetryEvent;

export type EventQueueState = {
  /** Oldest first. */
  events: QueuedTelemetryEvent[];
};

export type IngestHttpResult =
  | {
      kind: "ok";
      body: {
        accepted: number;
        duplicates: number;
        dropped: { clientEventId: string; reason: DropReason }[];
      };
      retryAfterSec?: number;
    }
  | { kind: "network_error" }
  | { kind: "rate_limited"; retryAfterSec?: number }
  | { kind: "server_error"; status: number; retryAfterSec?: number }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "device_not_registered" }
  | { kind: "bad_request" };

export type FlushDecision =
  | { action: "send"; batch: QueuedTelemetryEvent[] }
  | { action: "wait"; nextAttemptAt: number }
  | { action: "register_then_retry" }
  | { action: "stop_until_app_start" }
  | { action: "idle" };

export function emptyEventQueue(): EventQueueState {
  return { events: [] };
}

/**
 * Append an event. When over cap, drop the oldest (G12).
 * Invalid events are ignored (should be validated before enqueue).
 */
export function enqueueEvent(
  state: EventQueueState,
  event: QueuedTelemetryEvent,
): EventQueueState {
  const checked = parseTelemetryEvent(event);
  if (!checked.ok) return state;
  const events = [...state.events, checked.event];
  if (events.length <= EVENT_QUEUE_CAP) {
    return { events };
  }
  return { events: events.slice(events.length - EVENT_QUEUE_CAP) };
}

/** Take up to EVENT_BATCH_MAX from the front (does not mutate ack). */
export function peekBatch(
  state: EventQueueState,
  limit = EVENT_BATCH_MAX,
): QueuedTelemetryEvent[] {
  return state.events.slice(0, Math.max(0, limit));
}

/**
 * After a successful 200: remove accepted, duplicates, and dropped
 * clientEventIds from the queue (G6).
 */
export function acknowledgeBatch(
  state: EventQueueState,
  batch: readonly QueuedTelemetryEvent[],
  response: {
    dropped: { clientEventId: string }[];
  },
): EventQueueState {
  const remove = new Set(batch.map((e) => e.clientEventId));
  for (const d of response.dropped) {
    remove.add(d.clientEventId);
  }
  return {
    events: state.events.filter((e) => !remove.has(e.clientEventId)),
  };
}

function parseRetryAfterSec(header: string | null | undefined): number | undefined {
  if (header == null || header === "") return undefined;
  const asInt = Number.parseInt(header, 10);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt;
  const when = Date.parse(header);
  if (!Number.isNaN(when)) {
    return Math.max(0, Math.ceil((when - Date.now()) / 1000));
  }
  return undefined;
}

/**
 * Pure retry delay with exponential backoff and ±20% jitter (G13).
 * `attempt` is 0-based after the first failure.
 */
export function nextRetryDelayMs(
  attempt: number,
  options: {
    retryAfterSec?: number;
    random?: () => number;
  } = {},
): number {
  if (options.retryAfterSec != null && options.retryAfterSec >= 0) {
    return options.retryAfterSec * 1000;
  }
  const exp = Math.min(
    RETRY_MAX_MS,
    RETRY_BASE_MS * 2 ** Math.max(0, attempt),
  );
  const rand = options.random ?? Math.random;
  const jitter = 1 + (rand() * 2 - 1) * RETRY_JITTER;
  return Math.round(Math.min(RETRY_MAX_MS, exp * jitter));
}

/**
 * Decide what the phone should do next (G13). Pure: pass `now` and the last
 * HTTP outcome.
 */
export function decideFlush(input: {
  queue: EventQueueState;
  now: number;
  /** Null when no prior attempt, or after a successful flush. */
  lastResult: IngestHttpResult | null;
  /** Consecutive failures since last success; 0 if none. */
  failureAttempt: number;
  /** When a prior wait should end; null if ready. */
  nextAttemptAt: number | null;
}): FlushDecision {
  if (input.queue.events.length === 0) {
    return { action: "idle" };
  }
  if (
    input.nextAttemptAt != null &&
    input.now < input.nextAttemptAt &&
    input.lastResult != null &&
    (input.lastResult.kind === "network_error" ||
      input.lastResult.kind === "rate_limited" ||
      input.lastResult.kind === "server_error")
  ) {
    return { action: "wait", nextAttemptAt: input.nextAttemptAt };
  }
  if (input.lastResult?.kind === "unauthorized" || input.lastResult?.kind === "forbidden") {
    return { action: "stop_until_app_start" };
  }
  if (input.lastResult?.kind === "device_not_registered") {
    return { action: "register_then_retry" };
  }
  return { action: "send", batch: peekBatch(input.queue) };
}

/** Map a fetch-like response into IngestHttpResult (for Lane B wiring). */
export function classifyIngestResponse(
  status: number,
  bodyText: string,
  retryAfterHeader?: string | null,
): IngestHttpResult {
  const retryAfterSec = parseRetryAfterSec(retryAfterHeader);
  if (status === 401) return { kind: "unauthorized" };
  if (status === 403) return { kind: "forbidden" };
  if (status === 404) return { kind: "device_not_registered" };
  if (status === 400) return { kind: "bad_request" };
  if (status === 429) return { kind: "rate_limited", retryAfterSec };
  if (status >= 500) {
    return { kind: "server_error", status, retryAfterSec };
  }
  if (status !== 200) {
    return { kind: "server_error", status, retryAfterSec };
  }
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return { kind: "server_error", status: 200 };
  }
  const parsed = IngestEventsResponse.safeParse(json);
  if (!parsed.success) {
    return { kind: "server_error", status: 200 };
  }
  return { kind: "ok", body: parsed.data, retryAfterSec };
}

/**
 * Client-side pre-filter before send: drop future-dated from a batch copy
 * (ingest also drops them). Does not remove from the queue — ack does.
 */
export function partitionBatchForSend(
  batch: readonly QueuedTelemetryEvent[],
  now: Date = new Date(),
): {
  sendable: QueuedTelemetryEvent[];
  futureDated: QueuedTelemetryEvent[];
} {
  const sendable: QueuedTelemetryEvent[] = [];
  const futureDated: QueuedTelemetryEvent[] = [];
  for (const event of batch) {
    if (event.v !== EVENT_SCHEMA_VERSION || isFutureDated(event.occurredAt, now)) {
      futureDated.push(event);
    } else {
      sendable.push(event);
    }
  }
  return { sendable, futureDated };
}
