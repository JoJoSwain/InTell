import { describe, expect, it } from "vitest";
import {
  chronicleReplay,
  isUnlocked,
  markerState,
  memberSatisfied,
  pickVersion,
  unlocksToWrite,
  type CompletionRow,
  type FragmentInput,
} from "./unlock";

function fragment(overrides: Partial<FragmentInput> = {}): FragmentInput {
  return {
    id: "frag-a",
    groveId: "grove-1",
    tier: "leaf",
    visibility: "standard",
    retired: false,
    lat: 40.98,
    lng: -111.9,
    radiusM: 10,
    requires: [],
    threadIds: [],
    contingencyRevisionNo: 1,
    versions: [
      { lang: "en", timeWindow: "day" },
      { lang: "en", timeWindow: "night" },
    ],
    ...overrides,
  };
}

function completion(
  fragmentId: string,
  revisionNo: number,
  timeWindow: "day" | "night" = "day",
  onSite = true,
): CompletionRow {
  return { fragmentId, revisionNo, timeWindow, onSite };
}

describe("pickVersion", () => {
  const versions = [
    { lang: "en", timeWindow: "day" as const },
    { lang: "es", timeWindow: "day" as const },
    { lang: "en", timeWindow: "night" as const },
  ];

  it("prefers the device language, then en, then any version for the window", () => {
    expect(pickVersion(versions, "day", "es")?.lang).toBe("es");
    expect(pickVersion(versions, "day", "fr")?.lang).toBe("en");
    expect(pickVersion([{ lang: "es", timeWindow: "day" }], "day", "fr")?.lang).toBe(
      "es",
    );
    expect(pickVersion(versions, "night", "es")?.lang).toBe("en");
    expect(pickVersion([{ lang: "en", timeWindow: "day" }], "night", "en")).toBeUndefined();
  });
});

describe("memberSatisfied", () => {
  const needed = fragment({ id: "needed", contingencyRevisionNo: 3 });
  const other = fragment({ id: "other", contingencyRevisionNo: 1 });

  it("accepts a completion at or after the member's epoch, in either window", () => {
    expect(
      memberSatisfied("needed", [needed], [], [completion("needed", 3, "night")]),
    ).toBe(true);
    expect(
      memberSatisfied("needed", [needed], [], [completion("needed", 4, "day")]),
    ).toBe(true);
    expect(
      memberSatisfied("needed", [needed], [], [completion("needed", 2)]),
    ).toBe(false);
  });

  it("uses externalPrerequisites and treats an unknown member as never completed", () => {
    expect(
      memberSatisfied(
        "bridge",
        [other],
        [{ fragmentId: "bridge", groveId: "grove-2", contingencyRevisionNo: 2 }],
        [completion("bridge", 2)],
      ),
    ).toBe(true);
    expect(
      memberSatisfied("missing", [other], [], [completion("missing", 9)]),
    ).toBe(false);
  });

  it("counts an off-site completion toward the group", () => {
    expect(
      memberSatisfied("needed", [needed], [], [completion("needed", 3, "day", false)]),
    ).toBe(true);
  });
});

describe("isUnlocked and unlocksToWrite", () => {
  const a = fragment({ id: "a" });
  const b = fragment({ id: "b", requires: [["a"]] });
  const either = fragment({ id: "either", requires: [["a", "missing"]] });
  const both = fragment({ id: "both", requires: [["a"], ["b"]] });
  const emptyGroup = fragment({ id: "empty", requires: [[]] });
  const fragments = [a, b, either, both, emptyGroup];

  it("unlocks a fragment with no groups and asks for a row", () => {
    expect(isUnlocked(a, fragments, [], [], [])).toEqual({
      unlocked: true,
      shouldWriteUnlock: true,
    });
  });

  it("is an AND of OR groups", () => {
    const doneA = [completion("a", 1)];
    expect(isUnlocked(either, fragments, [], doneA, []).unlocked).toBe(true);
    expect(isUnlocked(both, fragments, [], doneA, []).unlocked).toBe(false);
    expect(
      isUnlocked(both, fragments, [], [...doneA, completion("b", 1)], []).unlocked,
    ).toBe(true);
  });

  it("keeps an unlocks row after a prerequisite contingency, and does not ask to write it again", () => {
    const reset = fragment({ id: "a", contingencyRevisionNo: 3 });
    const child = fragment({ id: "b", requires: [["a"]] });
    const held = isUnlocked(
      child,
      [reset, child],
      [],
      [completion("a", 1)],
      [{ fragmentId: "b" }],
    );
    expect(held).toEqual({ unlocked: true, shouldWriteUnlock: false });
    expect(isUnlocked(child, [reset, child], [], [completion("a", 1)], []).unlocked).toBe(
      false,
    );
  });

  it("treats an empty group as unsatisfied", () => {
    expect(isUnlocked(emptyGroup, fragments, [], [], []).unlocked).toBe(false);
  });

  it("lists every new unlock in input order", () => {
    expect(unlocksToWrite(fragments, [], [completion("a", 1)], [])).toEqual([
      "a",
      "b",
      "either",
    ]);
    expect(unlocksToWrite(fragments, [], [], [{ fragmentId: "a" }])).toEqual([]);
  });
});

describe("markerState", () => {
  const base = {
    external: [],
    unlocks: [],
    timeWindow: "day" as const,
    lang: "en",
  };

  it("is full opacity and playable when unlocked, in window, and unheard", () => {
    const frag = fragment();
    expect(
      markerState({ ...base, fragment: frag, fragments: [frag], completions: [] }),
    ).toEqual({ opacity: 1, playableNow: true, pulse: "tier", hidden: false });
  });

  it("is 35% when locked or out of window", () => {
    const locked = fragment({ id: "locked", requires: [["missing"]] });
    expect(
      markerState({
        ...base,
        fragment: locked,
        fragments: [locked],
        completions: [],
      }).opacity,
    ).toBe(0.35);
    const dayOnly = fragment({ versions: [{ lang: "en", timeWindow: "day" }] });
    expect(
      markerState({
        ...base,
        fragment: dayOnly,
        fragments: [dayOnly],
        completions: [],
        timeWindow: "night",
      }),
    ).toMatchObject({ opacity: 0.35, playableNow: false });
  });

  it("stays at full opacity once completed in window, without playing again", () => {
    const frag = fragment();
    expect(
      markerState({
        ...base,
        fragment: frag,
        fragments: [frag],
        completions: [completion("frag-a", 1)],
      }),
    ).toEqual({ opacity: 1, playableNow: false, pulse: "none", hidden: false });
  });

  it("pulses changed only while playable, and tier while unexplored", () => {
    const frag = fragment({ contingencyRevisionNo: 3 });
    expect(
      markerState({
        ...base,
        fragment: frag,
        fragments: [frag],
        completions: [completion("frag-a", 1)],
      }),
    ).toMatchObject({ opacity: 1, playableNow: true, pulse: "changed" });
    const dayOnly = fragment({
      contingencyRevisionNo: 3,
      versions: [{ lang: "en", timeWindow: "day" }],
    });
    expect(
      markerState({
        ...base,
        fragment: dayOnly,
        fragments: [dayOnly],
        completions: [completion("frag-a", 1)],
        timeWindow: "night",
      }),
    ).toMatchObject({ opacity: 0.35, playableNow: false, pulse: "none" });
  });

  it("does not pulse a locked fragment", () => {
    const locked = fragment({ requires: [["missing"]] });
    expect(
      markerState({
        ...base,
        fragment: locked,
        fragments: [locked],
        completions: [],
      }).pulse,
    ).toBe("none");
  });

  it("hides a retired fragment", () => {
    const frag = fragment({ retired: true });
    expect(
      markerState({ ...base, fragment: frag, fragments: [frag], completions: [] }),
    ).toEqual({ opacity: 0, playableNow: false, pulse: "none", hidden: true });
  });

  it("uses the language fallback when deciding there is a version", () => {
    const frag = fragment({ versions: [{ lang: "en", timeWindow: "day" }] });
    expect(
      markerState({
        ...base,
        fragment: frag,
        fragments: [frag],
        completions: [],
        lang: "es",
      }).playableNow,
    ).toBe(true);
  });
});

describe("chronicleReplay", () => {
  const frag = fragment({ contingencyRevisionNo: 3 });

  it("replays only the on-site window completed since the current epoch", () => {
    const rows = [
      completion("frag-a", 1, "day"),
      completion("frag-a", 4, "day"),
      completion("frag-a", 3, "night", false),
    ];
    expect(chronicleReplay(frag, rows, "day")).toBe(true);
    expect(chronicleReplay(frag, rows, "night")).toBe(false);
    expect(chronicleReplay(frag, [completion("frag-a", 2, "day")], "day")).toBe(false);
  });
});
