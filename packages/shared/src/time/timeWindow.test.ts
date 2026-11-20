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
});
