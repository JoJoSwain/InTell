import { describe, expect, it } from "vitest";
import { makeEvent } from "@intell/shared";
import {
  formatIngestLog,
  handleIngest,
  type IngestDeps,
} from "../../../supabase/functions/ingest-events/handler.ts";

const DEVICE = "11111111-1111-4111-8111-111111111111";
const ID_A = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const ID_B = "aaaaaaaa-bbbb-4ccc-8ddd-000000000002";
const OCCURRED = "2026-06-15T18:00:00.000Z";

function baseDeps(overrides: Partial<IngestDeps> = {}): {
  deps: IngestDeps;
  logs: string[];
  inserted: unknown[];
} {
  const logs: string[] = [];
  const inserted: unknown[] = [];
  const deps: IngestDeps = {
    now: () => new Date("2026-06-15T18:00:00.000Z"),
    log: (deviceId, event) => {
      logs.push(
        deviceId == null
          ? `ingest-events ${event}`
          : formatIngestLog(deviceId, event),
      );
    },
    deviceExists: async () => true,
    rateAllow: async () => true,
    insertEvents: async (_deviceId, events) => {
      inserted.push(...events);
      return { inserted: events.length, duplicates: 0 };
    },
    ...overrides,
  };
  return { deps, logs, inserted };
}

describe("ingest-events handler", () => {
  it("returns 400 for a bad envelope", async () => {
    const { deps, logs } = baseDeps();
    const res = await handleIngest({ deviceId: "nope", events: [] }, deps);
    expect(res.status).toBe(400);
    expect(logs.some((l) => l.includes("invalid-body"))).toBe(true);
  });

  it("returns 404 when the device is not registered", async () => {
    const { deps, logs } = baseDeps({
      deviceExists: async () => false,
    });
    const res = await handleIngest(
      { deviceId: DEVICE, events: [] },
      deps,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "device_not_registered" });
    expect(logs.some((l) => l.includes("device-not-registered"))).toBe(true);
    expect(logs.join("\n")).not.toContain(DEVICE.slice(8));
  });

  it("returns 500 when the devices lookup fails (not 404)", async () => {
    const { deps, logs } = baseDeps({
      deviceExists: async () => "error",
    });
    const res = await handleIngest({ deviceId: DEVICE, events: [] }, deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "device lookup failed" });
    expect(logs.some((l) => l.includes("device-lookup-error"))).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    const { deps } = baseDeps({ rateAllow: async () => false });
    const res = await handleIngest({ deviceId: DEVICE, events: [] }, deps);
    expect(res.status).toBe(429);
  });

  it("accepts valid events and drops bad / future ones", async () => {
    const good = makeEvent(
      "app_opened",
      {},
      {},
      { clientEventId: ID_A, occurredAt: OCCURRED },
    );
    const badName = {
      v: 1,
      clientEventId: ID_B,
      name: "seed_planted",
      occurredAt: OCCURRED,
      props: {},
    };
    const future = makeEvent(
      "session_started",
      {},
      { sessionId: ID_A },
      {
        clientEventId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000003",
        occurredAt: "2026-06-20T18:00:00.000Z",
      },
    );
    const { deps, inserted } = baseDeps();
    const res = await handleIngest(
      { deviceId: DEVICE, events: [good, badName, future] },
      deps,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.duplicates).toBe(0);
    expect(body.dropped).toEqual(
      expect.arrayContaining([
        { clientEventId: ID_B, reason: "unknown_name" },
        {
          clientEventId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000003",
          reason: "future_dated",
        },
      ]),
    );
    expect(inserted).toHaveLength(1);
  });

  it("counts duplicates from insert", async () => {
    const good = makeEvent(
      "app_opened",
      {},
      {},
      { clientEventId: ID_A, occurredAt: OCCURRED },
    );
    const { deps } = baseDeps({
      insertEvents: async (_id, events) => ({
        inserted: 0,
        duplicates: events.length,
      }),
    });
    const res = await handleIngest(
      { deviceId: DEVICE, events: [good] },
      deps,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      accepted: 0,
      duplicates: 1,
      dropped: [],
    });
  });

  it("never logs more than 8 characters of device_id", () => {
    const line = formatIngestLog(DEVICE, "ok");
    expect(line).toBe(`ingest-events ok device=${DEVICE.slice(0, 8)}`);
    expect(line).not.toContain(DEVICE);
  });
});
