/**
 * Contingency revision math (DATA_MODEL §4 / §14, ADR 0004).
 *
 * contingencyRevisionNo = highest revision_no ≤ current whose change_kind is contingency.
 * A completion of revision n satisfies prerequisites while n ≥ contingencyRevisionNo.
 */

export type ChangeKind = "contingency" | "correction";

export type RevisionForContingency = {
  revisionNo: number;
  changeKind: ChangeKind;
};

/** @deprecated Prefer RevisionForContingency */
export type RevisionChange = RevisionForContingency;

/**
 * Returns the contingency epoch for `currentRevisionNo` given the fragment's revisions.
 * Throws if no contingency revision exists at or before current (schema invariant: rev 1 is contingency).
 */
export function contingencyRevisionNo(
  revisions: readonly RevisionForContingency[],
  currentRevisionNo: number,
): number {
  let best: number | undefined;
  for (const rev of revisions) {
    if (
      rev.changeKind === "contingency" &&
      rev.revisionNo <= currentRevisionNo &&
      (best === undefined || rev.revisionNo > best)
    ) {
      best = rev.revisionNo;
    }
  }
  if (best === undefined) {
    throw new Error(
      `no contingency revision ≤ ${currentRevisionNo} (first revision must be contingency)`,
    );
  }
  return best;
}

/** True when a completion of `completedRevisionNo` satisfies the contingency epoch. */
export function completionSatisfiesContingency(
  completedRevisionNo: number,
  contingencyNo: number,
): boolean {
  return completedRevisionNo >= contingencyNo;
}
