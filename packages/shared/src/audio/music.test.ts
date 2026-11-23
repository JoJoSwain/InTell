import { describe, expect, it } from "vitest";
import type { GeoJsonPolygon } from "../geo/polygon";
import {
  GROVE_MUSIC_EDGE_FADE_M,
  musicConditionMatches,
  selectMusicCue,
  stemGainDb,
  type MusicCueInput,
  type StoryState,
} from "./music";

const square: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-111.9, 40.98],
      [-111.899, 40.98],
      [-111.899, 40.981],
      [-111.9, 40.981],
      [-111.9, 40.98],
    ],
  ],
};

const center = { lat: 40.9805, lng: -111.8995 };
const outside = { lat: 40.97, lng: -111.9 };
const now = new Date("2026-06-15T18:00:00.000Z");

function story(overrides: Partial<StoryState> = {}): StoryState {
  return {
    playingThreadIds: [],
    lastThreadIds: [],
    heard: new Set<string>(),
    timeWindow: "day",
    narrationPlaying: false,
    ...overrides,
  };
}

function cue(overrides: Partial<MusicCueInput> = {}): MusicCueInput {
  return {
    id: "day-theme",
    timeWindow: "day",
    priority: 100,
    conditions: {},
    minDwellS: 45,
    crossfadeMs: 6000,
    boundary: square,
    edgeFadeM: 10,
    stems: [],
    ...overrides,
  };
}

describe("musicConditionMatches", () => {
  it("matches an empty condition and treats empty arrays as absent", () => {
    expect(musicConditionMatches({}, story())).toBe(true);
    expect(
      musicConditionMatches(
        { heardAll: [], heardAny: [], notHeard: [], threadIds: [], tiers: [] },
        story(),
      ),
    ).toBe(true);
  });

  it("matches heardAll, heardAny and notHeard", () => {
    const heard = story({ heard: new Set(["a", "b"]) });
    expect(musicConditionMatches({ heardAll: ["a", "b"] }, heard)).toBe(true);
    expect(musicConditionMatches({ heardAll: ["a", "c"] }, heard)).toBe(false);
    expect(musicConditionMatches({ heardAny: ["c", "b"] }, heard)).toBe(true);
    expect(musicConditionMatches({ heardAny: ["c"] }, heard)).toBe(false);
    expect(musicConditionMatches({ notHeard: ["c"] }, heard)).toBe(true);
    expect(musicConditionMatches({ notHeard: ["a"] }, heard)).toBe(false);
  });

  it("matches last threads, and the playing fragment's threads only while narration plays", () => {
    expect(
      musicConditionMatches({ threadIds: ["mara"] }, story({ lastThreadIds: ["mara"] })),
    ).toBe(true);
    expect(
      musicConditionMatches(
        { threadIds: ["mara"] },
        story({ playingThreadIds: ["mara"], narrationPlaying: true }),
      ),
    ).toBe(true);
    expect(
      musicConditionMatches(
        { threadIds: ["mara"] },
        story({ playingThreadIds: ["mara"], narrationPlaying: false }),
      ),
    ).toBe(false);
  });

  it("uses the playing tier while narration plays, otherwise the last tier", () => {
    expect(
      musicConditionMatches(
        { tiers: ["branch"] },
        story({
          narrationPlaying: true,
          playingTier: "branch",
          lastTier: "root",
        }),
      ),
    ).toBe(true);
    expect(
      musicConditionMatches(
        { tiers: ["root"] },
        story({ narrationPlaying: false, lastTier: "root", playingTier: "branch" }),
      ),
    ).toBe(true);
    expect(
      musicConditionMatches(
        { tiers: ["root"] },
        story({ narrationPlaying: true, playingTier: "branch", lastTier: "root" }),
      ),
    ).toBe(false);
  });

  it("requires narrationPlaying when that key is present", () => {
    expect(musicConditionMatches({ narrationPlaying: true }, story())).toBe(false);
    expect(
      musicConditionMatches({ narrationPlaying: true }, story({ narrationPlaying: true })),
    ).toBe(true);
  });
});

describe("selectMusicCue", () => {
  it("drops a day cue at night and plays silence outside every boundary", () => {
    const day = cue();
    expect(
      selectMusicCue({
        cues: [day],
        point: center,
        story: story({ timeWindow: "night" }),
        current: null,
        now,
      }).cue,
    ).toBeNull();
    const outsideResult = selectMusicCue({
      cues: [day],
      point: outside,
      story: story(),
      current: { cueId: day.id, startedAt: now },
      now,
    });
    expect(outsideResult).toMatchObject({ cue: null, edgeGain: 0, crossfadeMs: 6000 });
  });

  it("picks the higher priority, and the lower id when priorities match", () => {
    const low = cue({ id: "low", priority: 100 });
    const high = cue({ id: "high", priority: 200 });
    expect(
      selectMusicCue({
        cues: [low, high],
        point: center,
        story: story(),
        current: null,
        now,
      }).cue?.id,
    ).toBe("high");
    const a = cue({ id: "a", priority: 100 });
    const b = cue({ id: "b", priority: 100 });
    expect(
      selectMusicCue({
        cues: [b, a],
        point: center,
        story: story(),
        current: null,
        now,
      }).cue?.id,
    ).toBe("a");
  });

  it("keeps the current cue until dwell, then lets a higher priority replace it", () => {
    const current = cue({ id: "current", priority: 100, minDwellS: 45 });
    const louder = cue({ id: "louder", priority: 200, crossfadeMs: 8000 });
    const started = new Date(now.getTime() - 10_000);
    const during = selectMusicCue({
      cues: [current, louder],
      point: center,
      story: story(),
      current: { cueId: "current", startedAt: started },
      now,
    });
    expect(during.cue?.id).toBe("current");
    expect(during.crossfadeMs).toBe(0);

    const after = selectMusicCue({
      cues: [current, louder],
      point: center,
      story: story(),
      current: { cueId: "current", startedAt: new Date(now.getTime() - 50_000) },
      now,
    });
    expect(after.cue?.id).toBe("louder");
    expect(after.crossfadeMs).toBe(8000);
  });

  it("does not replace the current cue with an equal priority", () => {
    const current = cue({ id: "current", priority: 100, minDwellS: 45 });
    const other = cue({ id: "a", priority: 100 });
    expect(
      selectMusicCue({
        cues: [current, other],
        point: center,
        story: story(),
        current: { cueId: "current", startedAt: new Date(now.getTime() - 120_000) },
        now,
      }).cue?.id,
    ).toBe("current");
  });

  it("fades from the edge of a second piece", () => {
    const east = {
      type: "Polygon" as const,
      coordinates: [
        square.coordinates[0]!.map(([lng, lat]) => [lng! + 0.002, lat!] as [number, number]),
      ],
    };
    const selected = selectMusicCue({
      cues: [
        cue({
          boundary: { type: "MultiPolygon", coordinates: [square.coordinates, east.coordinates] },
          edgeFadeM: GROVE_MUSIC_EDGE_FADE_M,
        }),
      ],
      point: { lat: 40.9805, lng: -111.8975 },
      story: story(),
      current: null,
      now,
    });
    expect(selected.cue).not.toBeNull();
    expect(selected.edgeGain).toBeGreaterThan(0);
    expect(selected.edgeGain).toBeLessThanOrEqual(1);
  });

  it("is fully faded in deep inside the zone", () => {
    const selected = selectMusicCue({
      cues: [cue({ edgeFadeM: 10 })],
      point: center,
      story: story(),
      current: null,
      now,
    });
    expect(selected.edgeGain).toBe(1);
    expect(GROVE_MUSIC_EDGE_FADE_M).toBe(60);
  });
});

describe("stemGainDb", () => {
  const stem = {
    assetSha: "strings",
    gainDb: -60,
    stateGains: [
      { when: { tiers: ["branch" as const] }, gainDb: 0 },
      { when: { tiers: ["root" as const] }, gainDb: -12 },
    ],
  };

  it("uses the resting level, or the first matching rule in its place", () => {
    expect(stemGainDb(stem, story({ lastTier: "leaf" }))).toBe(-60);
    expect(
      stemGainDb(stem, story({ narrationPlaying: true, playingTier: "branch" })),
    ).toBe(0);
    expect(stemGainDb(stem, story({ lastTier: "root" }))).toBe(-12);
  });
});
