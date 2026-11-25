/**
 * Session shell: event → sessionStep → effects → persist scrub (M6).
 */
import {
  sessionStep,
  storyStateOf,
  type SessionEffect,
  type SessionEvent,
  type SessionState,
  type SessionWorld,
  type StoryState,
} from "@intell/shared";
import { scrubSessionForDisk } from "./persist";

export type ShellStepResult = {
  state: SessionState;
  effects: SessionEffect[];
  story: StoryState;
  /** Scrubbed copy safe to write to kv. */
  diskState: SessionState;
};

export function stepSession(
  state: SessionState,
  event: SessionEvent,
  world: SessionWorld,
): ShellStepResult {
  const { state: next, effects } = sessionStep(state, event, world);
  return {
    state: next,
    effects,
    story: storyStateOf(next, world),
    diskState: scrubSessionForDisk(next),
  };
}

/** New session id for idle → exploring (UUID v4 from caller). */
export function withSessionId(
  event: SessionEvent,
  phase: SessionState["phase"],
  newId: () => string,
): SessionEvent {
  if (phase !== "idle") return event;
  if (event.type === "fix" || event.type === "scan") {
    if (event.sessionId) return event;
    return { ...event, sessionId: newId() };
  }
  return event;
}
