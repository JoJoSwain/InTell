import { describe, expect, it } from "vitest";
import {
  bedLongWarningMessage,
  bedMonoRejectedMessage,
  growthStepCountHint,
  parseCommaSeparatedInts,
  stemsOverMaxMessage,
} from "./helpers";

describe("bedMonoRejectedMessage", () => {
  it("rejects mono beds", () => {
    expect(bedMonoRejectedMessage(1)).toMatch(/BED_MONO/);
    expect(bedMonoRejectedMessage(2)).toBeNull();
  });
});

describe("stemsOverMaxMessage", () => {
  it("rejects more than 4 stems", () => {
    expect(stemsOverMaxMessage(5)).toMatch(/STEMS_OVER_MAX/);
    expect(stemsOverMaxMessage(4)).toBeNull();
  });
});

describe("growthStepCountHint", () => {
  it("warns when growth steps exceed max", () => {
    expect(growthStepCountHint([1, 2, 1, 2, 1])).toMatch(
      /GROWTH_STEPS_OVER_MAX/,
    );
    expect(growthStepCountHint([2, 1])).toMatch(/2 of 4/);
  });
});

describe("bedLongWarningMessage", () => {
  it("warns on long beds", () => {
    expect(bedLongWarningMessage(130_000)).toMatch(/BED_LONG/);
    expect(bedLongWarningMessage(60_000)).toBeNull();
  });
});

describe("parseCommaSeparatedInts", () => {
  it("parses comma and space separated values", () => {
    expect(parseCommaSeparatedInts("100, 200 300")).toEqual([100, 200, 300]);
    expect(parseCommaSeparatedInts("")).toEqual([]);
  });
});