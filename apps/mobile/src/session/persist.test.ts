import {
  directorJsonForDisk,
  jsonContainsCoordinates,
  loadSessionState,
  scrubDirectorForDisk,
  scrubSessionForDisk,
  sessionJsonForDisk,
} from "./persist";
import {
  initialDirectorState,
  initialSessionState,
  parseSessionState,
} from "@intell/shared";

describe("persist R1 scrub", () => {
  it("strips recentFixes before disk", () => {
    const state = {
      ...initialSessionState(),
      phase: "exploring" as const,
      sessionId: "s1",
      startedAt: 1,
      recentFixes: [{ at: 1, lat: 40.9, lng: -111.9, accuracyM: 5 }],
    };
    const json = sessionJsonForDisk(state);
    const parsed = parseSessionState(JSON.parse(json) as unknown);
    expect(parsed.recentFixes).toEqual([]);
    expect(json).not.toMatch(/40\.9/);
    expect(json).not.toMatch(/-111\.9/);
  });

  it("replaces director point with neutral default", () => {
    const state = initialDirectorState({
      seed: 1,
      wallAtMs: 0,
      dayKey: "2026-01-01",
      point: { lat: 40.9, lng: -111.9 },
    });
    const scrubbed = scrubDirectorForDisk(state);
    expect(scrubbed.point).toEqual({ lat: 0, lng: 0 });
    expect(scrubbed.courseDeg).toBeNull();
    expect(scrubbed.depthM).toBeUndefined();
    const json = directorJsonForDisk(state);
    expect(json).not.toMatch(/40\.9/);
    expect(json).not.toMatch(/-111\.9/);
  });

  it("loadSessionState recovers from bad JSON", () => {
    expect(loadSessionState("not-json").phase).toBe("idle");
    expect(loadSessionState(null).phase).toBe("idle");
  });

  it("scrubSessionForDisk clears fixes without mutating source", () => {
    const state = {
      ...initialSessionState(),
      recentFixes: [{ at: 1, lat: 1, lng: 2, accuracyM: 3 }],
    };
    const scrubbed = scrubSessionForDisk(state);
    expect(scrubbed.recentFixes).toEqual([]);
    expect(state.recentFixes).toHaveLength(1);
  });

  it("jsonContainsCoordinates detects real coords", () => {
    expect(jsonContainsCoordinates(JSON.stringify({ lat: 1, lng: 2 }))).toBe(true);
    expect(jsonContainsCoordinates(sessionJsonForDisk(initialSessionState()))).toBe(false);
  });
});
