import { describe, expect, it } from "vitest";
import {
  completionSatisfiesContingency,
  contingencyRevisionNo,
} from "./contingency";

describe("contingencyRevisionNo", () => {
  const revisions = [
    { revisionNo: 1, changeKind: "contingency" as const },
    { revisionNo: 2, changeKind: "correction" as const },
    { revisionNo: 3, changeKind: "contingency" as const },
    { revisionNo: 4, changeKind: "correction" as const },
  ];

  it("returns 1 while current is before the next contingency", () => {
    expect(contingencyRevisionNo(revisions, 1)).toBe(1);
    expect(contingencyRevisionNo(revisions, 2)).toBe(1);
  });

  it("advances to the latest contingency at or before current", () => {
    expect(contingencyRevisionNo(revisions, 3)).toBe(3);
    expect(contingencyRevisionNo(revisions, 4)).toBe(3);
  });

  it("ignores contingencies after current", () => {
    expect(
      contingencyRevisionNo(
        [
          { revisionNo: 1, changeKind: "contingency" },
          { revisionNo: 5, changeKind: "contingency" },
        ],
        2,
      ),
    ).toBe(1);
  });

  it("throws when no contingency exists at or before current", () => {
    expect(() =>
      contingencyRevisionNo(
        [{ revisionNo: 2, changeKind: "correction" }],
        2,
      ),
    ).toThrow(/no contingency/i);
  });
});

describe("completionSatisfiesContingency", () => {
  it("is true when completed revision is at or after the contingency epoch", () => {
    expect(completionSatisfiesContingency(1, 1)).toBe(true);
    expect(completionSatisfiesContingency(3, 3)).toBe(true);
    expect(completionSatisfiesContingency(4, 3)).toBe(true);
  });

  it("is false when completed revision predates the contingency epoch", () => {
    expect(completionSatisfiesContingency(1, 3)).toBe(false);
    expect(completionSatisfiesContingency(2, 3)).toBe(false);
  });
});
