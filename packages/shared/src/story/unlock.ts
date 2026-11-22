import { completionSatisfiesContingency } from "./contingency";
import type { TimeWindow } from "../time/timeWindow";

/**
 * Story unlock, marker state, and Chronicle replay (DATA_MODEL §14, ADR 0004).
 * Device rows are plain objects. This module does not read storage.
 */

export type CompletionRow = {
  fragmentId: string;
  revisionNo: number;
  timeWindow: TimeWindow;
  onSite: boolean;
};

export type UnlockRow = { fragmentId: string };

export type VersionRef = {
  lang: string;
  timeWindow: TimeWindow;
};

export type FragmentInput = {
  id: string;
  groveId: string;
  tier: "root" | "branch" | "leaf";
  visibility: "standard" | "physical";
  retired: boolean;
  lat: number;
  lng: number;
  /** Metres. Physical fragments omit it. */
  radiusM?: number;
  /** AND of OR groups. Empty means unlocked from the start. */
  requires: string[][];
  threadIds: string[];
  /** Current revision's contingency epoch. */
  contingencyRevisionNo: number;
  versions: VersionRef[];
};

export type ExternalPrerequisite = {
  fragmentId: string;
  groveId: string;
  contingencyRevisionNo: number;
};

export type MarkerState = {
  opacity: 1 | 0.35 | 0;
  playableNow: boolean;
  pulse: boolean;
  hidden: boolean;
};

/**
 * Version for this window: device language, then `en`, then any version
 * for the window (same order as `pickL10n`).
 */
export function pickVersion(
  versions: readonly VersionRef[],
  window: TimeWindow,
  lang: string,
): VersionRef | undefined {
  const forWindow = versions.filter((version) => version.timeWindow === window);
  return (
    forWindow.find((version) => version.lang === lang) ??
    forWindow.find((version) => version.lang === "en") ??
    forWindow[0]
  );
}

function epochFor(
  memberId: string,
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
): number | undefined {
  const loaded = fragments.find((fragment) => fragment.id === memberId);
  if (loaded) return loaded.contingencyRevisionNo;
  return external.find((row) => row.fragmentId === memberId)?.contingencyRevisionNo;
}

/** Any time version counts. An unknown member is never satisfied. */
export function memberSatisfied(
  memberId: string,
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
  completions: readonly CompletionRow[],
): boolean {
  const epoch = epochFor(memberId, fragments, external);
  if (epoch === undefined) return false;
  return completions.some(
    (row) =>
      row.fragmentId === memberId &&
      completionSatisfiesContingency(row.revisionNo, epoch),
  );
}

function groupsSatisfied(
  fragment: FragmentInput,
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
  completions: readonly CompletionRow[],
): boolean {
  return fragment.requires.every((group) =>
    group.some((memberId) =>
      memberSatisfied(memberId, fragments, external, completions),
    ),
  );
}

export function isUnlocked(
  fragment: FragmentInput,
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
  completions: readonly CompletionRow[],
  unlocks: readonly UnlockRow[],
): { unlocked: boolean; shouldWriteUnlock: boolean } {
  if (unlocks.some((row) => row.fragmentId === fragment.id)) {
    return { unlocked: true, shouldWriteUnlock: false };
  }
  if (groupsSatisfied(fragment, fragments, external, completions)) {
    return { unlocked: true, shouldWriteUnlock: true };
  }
  return { unlocked: false, shouldWriteUnlock: false };
}

/** Fragment ids whose unlock row should be written, in input order. */
export function unlocksToWrite(
  fragments: readonly FragmentInput[],
  external: readonly ExternalPrerequisite[],
  completions: readonly CompletionRow[],
  unlocks: readonly UnlockRow[],
): string[] {
  return fragments
    .filter(
      (fragment) =>
        isUnlocked(fragment, fragments, external, completions, unlocks)
          .shouldWriteUnlock,
    )
    .map((fragment) => fragment.id);
}

function completedEpoch(
  fragment: FragmentInput,
  completions: readonly CompletionRow[],
): boolean {
  return completions.some(
    (row) =>
      row.fragmentId === fragment.id &&
      completionSatisfiesContingency(row.revisionNo, fragment.contingencyRevisionNo),
  );
}

function heardOlderEpoch(
  fragment: FragmentInput,
  completions: readonly CompletionRow[],
): boolean {
  return completions.some(
    (row) =>
      row.fragmentId === fragment.id &&
      !completionSatisfiesContingency(row.revisionNo, fragment.contingencyRevisionNo),
  );
}

export function markerState(input: {
  fragment: FragmentInput;
  fragments: readonly FragmentInput[];
  external: readonly ExternalPrerequisite[];
  completions: readonly CompletionRow[];
  unlocks: readonly UnlockRow[];
  timeWindow: TimeWindow;
  lang: string;
}): MarkerState {
  const { fragment } = input;
  if (fragment.retired) {
    return { opacity: 0, playableNow: false, pulse: false, hidden: true };
  }

  const hasVersion =
    pickVersion(fragment.versions, input.timeWindow, input.lang) !== undefined;
  const unlocked = isUnlocked(
    fragment,
    input.fragments,
    input.external,
    input.completions,
    input.unlocks,
  ).unlocked;
  const done = completedEpoch(fragment, input.completions);
  const pulse = heardOlderEpoch(fragment, input.completions) && !done;
  const playableNow = unlocked && hasVersion && !done;
  const opacity: 1 | 0.35 = unlocked && hasVersion ? 1 : 0.35;

  return { opacity, playableNow, pulse, hidden: false };
}

/** On-site completion of this window at or after the current contingency epoch. */
export function chronicleReplay(
  fragment: FragmentInput,
  completions: readonly CompletionRow[],
  window: TimeWindow,
): boolean {
  return completions.some(
    (row) =>
      row.fragmentId === fragment.id &&
      row.onSite &&
      row.timeWindow === window &&
      completionSatisfiesContingency(row.revisionNo, fragment.contingencyRevisionNo),
  );
}
