import { describe, expect, it } from "vitest";
import { RegisterDeviceRequest, RegisterDeviceResponse } from "./device";

const deviceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("RegisterDeviceRequest", () => {
  it("accepts a v4 device id and an optional age gate", () => {
    const parsed = RegisterDeviceRequest.parse({
      deviceId,
      platform: "ios",
      appVersion: "1.2.3",
      uiLanguage: "en",
      ageGate: "18_plus",
    });
    expect(parsed.deviceId).toBe(deviceId);
    expect(parsed.ageGate).toBe("18_plus");
  });

  it("accepts a body without an age gate", () => {
    const parsed = RegisterDeviceRequest.parse({
      deviceId,
      platform: "android",
      appVersion: "1",
      uiLanguage: "es",
    });
    expect(parsed.ageGate).toBeUndefined();
  });

  it("rejects a non-v4 id, a long version, and extra fields", () => {
    expect(() =>
      RegisterDeviceRequest.parse({
        deviceId: "aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee",
        platform: "ios",
        appVersion: "1",
        uiLanguage: "en",
      }),
    ).toThrow();
    expect(() =>
      RegisterDeviceRequest.parse({
        deviceId,
        platform: "ios",
        appVersion: "x".repeat(33),
        uiLanguage: "en",
      }),
    ).toThrow();
    expect(() =>
      RegisterDeviceRequest.parse({
        deviceId,
        platform: "ios",
        appVersion: "1",
        uiLanguage: "en",
        notes: "no",
      }),
    ).toThrow();
  });
});

describe("RegisterDeviceResponse", () => {
  it("accepts ok and an ISO timestamp", () => {
    const parsed = RegisterDeviceResponse.parse({
      ok: true,
      firstSeenAt: "2026-11-22T20:00:00.000Z",
    });
    expect(parsed.ok).toBe(true);
  });
});
