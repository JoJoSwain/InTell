import { describe, expect, it } from "vitest";
import { dbToGain, equalPowerCrossfade, gainToDb } from "./gain";

describe("dbToGain / gainToDb", () => {
  it("maps 0 dB to unity", () => {
    expect(dbToGain(0)).toBeCloseTo(1, 6);
    expect(gainToDb(1)).toBeCloseTo(0, 6);
  });

  it("maps −6 dB near 0.5", () => {
    expect(dbToGain(-6)).toBeCloseTo(0.501187, 4);
  });

  it("round-trips finite gains", () => {
    for (const db of [0, -8, -10, -16, -20, 6]) {
      expect(gainToDb(dbToGain(db))).toBeCloseTo(db, 5);
    }
  });

  it("treats zero / negative gain as −Infinity", () => {
    expect(gainToDb(0)).toBe(-Infinity);
    expect(gainToDb(-1)).toBe(-Infinity);
    expect(dbToGain(-Infinity)).toBe(0);
  });
});

describe("equalPowerCrossfade", () => {
  it("starts fully on from", () => {
    const { fromGain, toGain } = equalPowerCrossfade(0);
    expect(fromGain).toBeCloseTo(1, 6);
    expect(toGain).toBeCloseTo(0, 6);
  });

  it("ends fully on to", () => {
    const { fromGain, toGain } = equalPowerCrossfade(1);
    expect(fromGain).toBeCloseTo(0, 6);
    expect(toGain).toBeCloseTo(1, 6);
  });

  it("keeps constant power at midpoint", () => {
    const { fromGain, toGain } = equalPowerCrossfade(0.5);
    expect(fromGain * fromGain + toGain * toGain).toBeCloseTo(1, 6);
    expect(fromGain).toBeCloseTo(Math.SQRT1_2, 6);
    expect(toGain).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("clamps out-of-range t", () => {
    expect(equalPowerCrossfade(-1).fromGain).toBeCloseTo(1, 6);
    expect(equalPowerCrossfade(2).toGain).toBeCloseTo(1, 6);
  });
});
