import { describe, expect, it } from "vitest";
import { makeEvent } from "../schemas/events";
import {
  EVENT_BATCH_MAX,
  EVENT_QUEUE_CAP,
  acknowledgeBatch,
  classifyIngestResponse,
  decideFlush,
  emptyEventQueue,
  enqueueEvent,
  nextRetryDelayMs,
  peekBatch,
} from "./eventQueue";

const occurredAt = "2026-06-15T18:00:00.000Z";

function ev(n: number) {
  const id = `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`;
  return makeEvent(
    "app_opened",
    {},
    {},
    { clientEventId: id, occurredAt },
  );
}

describe("eventQueue", () => {
  it("caps at 5000 by dropping the oldest", () => {
    let q = emptyEventQueue();
    for (let i = 0; i < EVENT_QUEUE_CAP + 3; i++) {
      q = enqueueEvent(q, ev(i + 1));
    }
    expect(q.events).toHaveLength(EVENT_QUEUE_CAP);
    expect(q.events[0]?.clientEventId.endsWith("000000000004")).toBe(true);
  });

  it("peeks at most 200 for a batch", () => {
    let q = emptyEventQueue();
    for (let i = 0; i < 250; i++) {
      q = enqueueEvent(q, ev(i + 1));
    }
    expect(peekBatch(q)).toHaveLength(EVENT_BATCH_MAX);
  });

  it("acknowledges a whole batch after 200", () => {
    let q = emptyEventQueue();
    const a = ev(1);
    const b = ev(2);
    const c = ev(3);
    q = enqueueEvent(q, a);
    q = enqueueEvent(q, b);
    q = enqueueEvent(q, c);
    q = acknowledgeBatch(q, [a, b], {
      dropped: [{ clientEventId: b.clientEventId }],
    });
    expect(q.events.map((e) => e.clientEventId)).toEqual([c.clientEventId]);
  });

  it("doubles retry delay with a Retry-After override", () => {
    expect(nextRetryDelayMs(0, { random: () => 0.5 })).toBe(30_000);
    expect(nextRetryDelayMs(1, { random: () => 0.5 })).toBe(60_000);
    expect(nextRetryDelayMs(10, { random: () => 0.5 })).toBe(30 * 60_000);
    expect(nextRetryDelayMs(0, { retryAfterSec: 12, random: () => 0.5 })).toBe(
      12_000,
    );
  });

  it("decideFlush covers G13 outcomes", () => {
    const q = enqueueEvent(emptyEventQueue(), ev(1));
    expect(
      decideFlush({
        queue: q,
        now: 1_000,
        lastResult: null,
        failureAttempt: 0,
        nextAttemptAt: null,
      }),
    ).toMatchObject({ action: "send" });
    expect(
      decideFlush({
        queue: q,
        now: 1_000,
        lastResult: { kind: "unauthorized" },
        failureAttempt: 1,
        nextAttemptAt: null,
      }),
    ).toEqual({ action: "stop_until_app_start" });
    expect(
      decideFlush({
        queue: q,
        now: 1_000,
        lastResult: { kind: "device_not_registered" },
        failureAttempt: 1,
        nextAttemptAt: null,
      }),
    ).toEqual({ action: "register_then_retry" });
    expect(
      decideFlush({
        queue: q,
        now: 1_000,
        lastResult: { kind: "rate_limited", retryAfterSec: 30 },
        failureAttempt: 1,
        nextAttemptAt: 5_000,
      }),
    ).toEqual({ action: "wait", nextAttemptAt: 5_000 });
  });

  it("classifies ingest HTTP responses", () => {
    expect(classifyIngestResponse(404, "{}").kind).toBe("device_not_registered");
    expect(classifyIngestResponse(401, "{}").kind).toBe("unauthorized");
    expect(
      classifyIngestResponse(200, JSON.stringify({
        accepted: 1,
        duplicates: 0,
        dropped: [],
      })).kind,
    ).toBe("ok");
  });
});
