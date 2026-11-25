import { describe, expect, it } from "vitest";
import {
  MusicCondition,
  StemRulePack,
  musicConditionSchema,
  stemRulePackSchema,
} from "./music";

describe("MusicCondition", () => {
  it("accepts AUDIO_SPEC §4.2 fields", () => {
    const parsed = MusicCondition.parse({
      threadIds: ["aaaaaaaa-bbbb-4ccc-8ddd-000000000001"],
      tiers: ["branch"],
      heardAll: ["aaaaaaaa-bbbb-4ccc-8ddd-000000000002"],
      narrationPlaying: true,
    });
    expect(parsed.tiers).toEqual(["branch"]);
  });

  it("rejects removed ringIds, outcome, and timeWindows", () => {
    expect(() =>
      MusicCondition.parse({
        ringIds: ["aaaaaaaa-bbbb-4ccc-8ddd-000000000001"],
      }),
    ).toThrow();
    expect(() =>
      MusicCondition.parse({
        outcome: {
          crossroadsId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
          optionId: "aaaaaaaa-bbbb-4ccc-8ddd-000000000002",
        },
      }),
    ).toThrow();
    expect(() =>
      MusicCondition.parse({
        timeWindows: ["day"],
      }),
    ).toThrow();
  });

  it("accepts empty object as always-match", () => {
    expect(MusicCondition.parse({})).toEqual({});
  });
});

describe("musicConditionSchema device mode", () => {
  const device = musicConditionSchema("device");

  it("maps unknown keys to neverMatch", () => {
    expect(device.parse({ onlyAtNight: true })).toEqual({ neverMatch: true });
    expect(
      device.parse({ narrationPlaying: true, onlyAtNight: true }),
    ).toEqual({ neverMatch: true });
  });

  it("keeps known-only conditions", () => {
    expect(device.parse({ narrationPlaying: true })).toEqual({
      narrationPlaying: true,
    });
    expect(device.parse({})).toEqual({});
  });
});

describe("StemRulePack", () => {
  it("nests MusicCondition under when", () => {
    const rule = StemRulePack.parse({
      when: { tiers: ["root"] },
      gainDb: -6,
    });
    expect(rule.gainDb).toBe(-6);
  });

  it("device mode maps unknown when keys to neverMatch", () => {
    const rule = stemRulePackSchema("device").parse({
      when: { futureRestriction: "night" },
      gainDb: 0,
    });
    expect(rule.when).toEqual({ neverMatch: true });
    expect(rule.gainDb).toBe(0);
  });
});
