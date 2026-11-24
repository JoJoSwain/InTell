/** Serializable teaser rate-limit state (device-local calendar day). */
export type LockedTeaserState = {
  dayKey: string;
  playedFragmentIds: string[];
};

export function initialLockedTeaserState(dayKey: string): LockedTeaserState {
  return { dayKey, playedFragmentIds: [] };
}

export function localDayKey(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Plays locked teaser at most once per fragment per device-local day.
 * Never over narration. wrongTime → no audio.
 */
export function lockedTeaserStep(
  state: LockedTeaserState,
  event: {
    at: number;
    dayKey: string;
    reason: "locked" | "wrongTime";
    fragmentId: string;
    teaserSha?: string;
    narrationPlaying: boolean;
  },
): { state: LockedTeaserState; playSha?: string } {
  let next = state;
  if (event.dayKey !== state.dayKey) {
    next = { dayKey: event.dayKey, playedFragmentIds: [] };
  }
  if (event.reason !== "locked") return { state: next };
  if (event.narrationPlaying) return { state: next };
  if (!event.teaserSha) return { state: next };
  if (next.playedFragmentIds.includes(event.fragmentId)) return { state: next };
  return {
    state: {
      ...next,
      playedFragmentIds: [...next.playedFragmentIds, event.fragmentId],
    },
    playSha: event.teaserSha,
  };
}
