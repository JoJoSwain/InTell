import { isM6BlockedCommand, M6_LAYERS, m6DirectorSettings } from "./m6World";
import type { DirectorCommand } from "@intell/shared";

describe("M6 layer gate", () => {
  it("keeps surroundings music beacons hush off", () => {
    expect(M6_LAYERS).toEqual({
      surroundings: false,
      music: false,
      beacons: false,
      hush: false,
    });
    const settings = m6DirectorSettings();
    expect(settings.hushOn).toBe(false);
    expect(settings.beaconsEnabled).toBe(false);
  });

  it("blocks music and surroundings bus commands; allows story teaser one-shot", () => {
    const blocked: DirectorCommand[] = [
      {
        type: "startLoopGroup",
        id: "m",
        bus: "music",
        stems: [],
      },
      {
        type: "crossfadeBed",
        id: "b",
        bus: "surroundings",
        fromId: null,
        toSha: "a".repeat(64),
        gainDb: 0,
        fadeMs: 1,
        loopStartMs: 0,
        loopEndMs: 1000,
      },
      {
        type: "playOneShot",
        id: "o",
        sha: "a".repeat(64),
        bus: "surroundings",
        gainDb: 0,
        pan: 0,
        rate: 1,
        whenSec: 0,
      },
      { type: "startBeacon", id: "be", sha: "a".repeat(64), gainDb: 0, pan: 0, lowpassHz: 1000 },
    ];
    for (const c of blocked) expect(isM6BlockedCommand(c)).toBe(true);

    const teaser: DirectorCommand = {
      type: "playOneShot",
      id: "t",
      sha: "a".repeat(64),
      bus: "story",
      gainDb: 0,
      pan: 0,
      rate: 1,
      whenSec: 0,
    };
    expect(isM6BlockedCommand(teaser)).toBe(false);
    expect(
      isM6BlockedCommand({
        type: "playNarration",
        id: "n",
        sha: "a".repeat(64),
        meta: { title: "x", artist: "InTell" },
      }),
    ).toBe(false);
  });
});
