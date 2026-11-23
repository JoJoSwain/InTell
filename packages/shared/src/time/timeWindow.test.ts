import { getTimes } from "suncalc";
import { describe, expect, it } from "vitest";
import {
  currentTimeWindow,
  localMinutesSinceMidnight,
  polarFallbackTimeWindow,
} from "./timeWindow";

/** Farmington Bay / Wasatch Front sun reference (seed region). */
const WASATCH = { lat: 40.98, lng: -111.9 };
const TZ = "America/Denver";

describe("localMinutesSinceMidnight", () => {
  it("reads wall-clock minutes in the given timezone", () => {
    // 2026-06-15 12:00 MDT = 18:00 UTC
    const noonMdt = new Date("2026-06-15T18:00:00.000Z");
    expect(localMinutesSinceMidnight(noonMdt, TZ)).toBe(12 * 60);
  });
});

describe("polarFallbackTimeWindow", () => {
  it("is day between 06:00 and 18:00 local", () => {
    const morning = new Date("2026-06-15T14:00:00.000Z"); // 08:00 MDT
    const evening = new Date("2026-06-16T01:00:00.000Z"); // 19:00 MDT
    expect(polarFallbackTimeWindow(morning, TZ)).toBe("day");
    expect(polarFallbackTimeWindow(evening, TZ)).toBe("night");
  });

  it("treats 06:00 as day and 18:00 as night", () => {
    const six = new Date("2026-06-15T12:00:00.000Z"); // 06:00 MDT
    const eighteen = new Date("2026-06-16T00:00:00.000Z"); // 18:00 MDT
    expect(polarFallbackTimeWindow(six, TZ)).toBe("day");
    expect(polarFallbackTimeWindow(eighteen, TZ)).toBe("night");
  });
});

describe("currentTimeWindow", () => {
  it("is day around local noon in summer at mid-latitudes", () => {
    const noon = new Date("2026-06-15T18:00:00.000Z"); // 12:00 MDT
    expect(currentTimeWindow(noon, WASATCH, TZ)).toBe("day");
  });

  it("is night around local midnight in summer at mid-latitudes", () => {
    const midnight = new Date("2026-06-16T06:00:00.000Z"); // 00:00 MDT
    expect(currentTimeWindow(midnight, WASATCH, TZ)).toBe("night");
  });

  it("uses polar fallback 06:00–18:00 when the sun does not rise or set", () => {
    const northPole = { lat: 89.9, lng: 0 };
    expect(
      currentTimeWindow(new Date("2026-12-21T12:00:00.000Z"), northPole, "UTC"),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-12-21T00:00:00.000Z"), northPole, "UTC"),
    ).toBe("night");
    expect(
      currentTimeWindow(new Date("2026-06-21T12:00:00.000Z"), northPole, "UTC"),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-06-21T00:00:00.000Z"), northPole, "UTC"),
    ).toBe("night");
  });

  it("is day at local noon and night in the evening in winter at mid-latitudes", () => {
    // 2026-12-21 12:00 MST and 20:00 MST
    expect(
      currentTimeWindow(new Date("2026-12-21T19:00:00.000Z"), WASATCH, TZ),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-12-22T03:00:00.000Z"), WASATCH, TZ),
    ).toBe("night");
  });

  it("treats sunrise as day and sunset as night", () => {
    const noon = new Date("2026-06-15T18:00:00.000Z");
    const { sunrise, sunset } = getTimes(noon, WASATCH.lat, WASATCH.lng);
    if (!sunrise || !sunset) throw new Error("suncalc returned no sunrise or sunset");
    expect(currentTimeWindow(sunrise, WASATCH, TZ)).toBe("day");
    expect(
      currentTimeWindow(new Date(sunrise.getTime() - 1), WASATCH, TZ),
    ).toBe("night");
    expect(currentTimeWindow(sunset, WASATCH, TZ)).toBe("night");
    expect(
      currentTimeWindow(new Date(sunset.getTime() - 1), WASATCH, TZ),
    ).toBe("day");
  });

  it("is day at local noon and night at local midnight on the equator", () => {
    const equator = { lat: 0, lng: 0 };
    expect(
      currentTimeWindow(new Date("2026-06-15T12:00:00.000Z"), equator, "UTC"),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-06-15T00:00:00.000Z"), equator, "UTC"),
    ).toBe("night");
  });

  it("is day at local noon in southern winter and summer", () => {
    const sydney = { lat: -33.87, lng: 151.21 };
    const tz = "Australia/Sydney";
    // 2026-06-21 12:00 AEST (UTC+10) and 2026-12-21 12:00 AEDT (UTC+11)
    expect(
      currentTimeWindow(new Date("2026-06-21T02:00:00.000Z"), sydney, tz),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-06-20T14:00:00.000Z"), sydney, tz),
    ).toBe("night");
    expect(
      currentTimeWindow(new Date("2026-12-21T01:00:00.000Z"), sydney, tz),
    ).toBe("day");
  });

  it("uses local 06:00–18:00 in a non-UTC zone when the sun does not set", () => {
    const northPole = { lat: 89.9, lng: 0 };
    // 2026-06-21 local times in America/Denver (MDT, UTC-6)
    expect(
      currentTimeWindow(new Date("2026-06-21T11:59:00.000Z"), northPole, TZ),
    ).toBe("night");
    expect(
      currentTimeWindow(new Date("2026-06-21T12:00:00.000Z"), northPole, TZ),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-06-21T23:59:00.000Z"), northPole, TZ),
    ).toBe("day");
    expect(
      currentTimeWindow(new Date("2026-06-22T00:00:00.000Z"), northPole, TZ),
    ).toBe("night");
  });
});
