import { describe, expect, it } from "vitest";
import {
  formatDeleteLog,
  handleDeleteDeviceData,
  type DeleteDeps,
} from "../../../supabase/functions/delete-device-data/handler.ts";

const DEVICE = "11111111-1111-4111-8111-111111111111";

function baseDeps(overrides: Partial<DeleteDeps> = {}): {
  deps: DeleteDeps;
  logs: string[];
} {
  const logs: string[] = [];
  const deps: DeleteDeps = {
    log: (deviceId, event) => {
      logs.push(
        deviceId == null
          ? `delete-device-data ${event}`
          : formatDeleteLog(deviceId, event),
      );
    },
    deviceExists: async () => true,
    rateAllow: async () => true,
    deleteAll: async () => ({
      events: 2,
      journalEntries: 1,
      checkins: 1,
      voiceFiles: 1,
      rateLimits: 3,
    }),
    ...overrides,
  };
  return { deps, logs };
}

describe("delete-device-data handler", () => {
  it("returns 400 for a bad body", async () => {
    const { deps, logs } = baseDeps();
    const res = await handleDeleteDeviceData({ deviceId: "nope" }, deps);
    expect(res.status).toBe(400);
    expect(logs.some((l) => l.includes("invalid-body"))).toBe(true);
  });

  it("returns 404 when the device is not registered", async () => {
    const { deps } = baseDeps({ deviceExists: async () => false });
    const res = await handleDeleteDeviceData({ deviceId: DEVICE }, deps);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "device_not_registered" });
  });

  it("returns 500 when the devices lookup fails (not 404)", async () => {
    const { deps, logs } = baseDeps({
      deviceExists: async () => "error",
    });
    const res = await handleDeleteDeviceData({ deviceId: DEVICE }, deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "device lookup failed" });
    expect(logs.some((l) => l.includes("device-lookup-error"))).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    const { deps } = baseDeps({ rateAllow: async () => false });
    const res = await handleDeleteDeviceData({ deviceId: DEVICE }, deps);
    expect(res.status).toBe(429);
  });

  it("returns counts on success and never logs the full device id", async () => {
    const { deps, logs } = baseDeps();
    const res = await handleDeleteDeviceData({ deviceId: DEVICE }, deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      events: 2,
      journalEntries: 1,
      checkins: 1,
      voiceFiles: 1,
      rateLimits: 3,
      device: 1,
    });
    expect(logs.join("\n")).toContain(DEVICE.slice(0, 8));
    expect(logs.join("\n")).not.toContain(DEVICE.slice(8));
  });
});
