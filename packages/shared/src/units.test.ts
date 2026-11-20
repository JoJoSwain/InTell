import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIGGER_RADIUS_FT,
  DEFAULT_TRIGGER_RADIUS_M,
  FEET_PER_METER,
  feetToMetres,
  formatFeet,
  MAX_TRIGGER_RADIUS_FT,
  MAX_TRIGGER_RADIUS_M,
  metresToFeet,
  metresToMiles,
  milesToMetres,
  MIN_TRIGGER_RADIUS_FT,
  MIN_TRIGGER_RADIUS_M,
} from "./units";

describe("units", () => {
  it("converts feet and metres round-trip", () => {
    expect(feetToMetres(35)).toBeCloseTo(10.668, 2);
    expect(metresToFeet(10.67)).toBeCloseTo(35, 0);
    expect(metresToFeet(feetToMetres(15))).toBeCloseTo(15, 10);
  });

  it("converts miles and metres round-trip", () => {
    expect(milesToMetres(1)).toBeCloseTo(1609.344, 3);
    expect(metresToMiles(1609.344)).toBeCloseTo(1, 10);
  });

  it("matches DATA_MODEL trigger radius bounds and formatFeet", () => {
    expect(feetToMetres(MIN_TRIGGER_RADIUS_FT)).toBeCloseTo(
      MIN_TRIGGER_RADIUS_M,
      1,
    );
    expect(feetToMetres(MAX_TRIGGER_RADIUS_FT)).toBeCloseTo(
      MAX_TRIGGER_RADIUS_M,
      1,
    );
    expect(DEFAULT_TRIGGER_RADIUS_FT).toBe(35);
    expect(DEFAULT_TRIGGER_RADIUS_M).toBe(10.67);
    expect(FEET_PER_METER).toBeCloseTo(3.28084, 4);
    expect(formatFeet(10.67)).toMatch(/35 ft/);
  });
});
