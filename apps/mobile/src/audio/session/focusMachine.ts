/**
 * JS focus / pause state machine for the audio-session module (B·S3).
 * Modes match docs/briefs/BS3-plan-review.md.
 */

export type FocusMode =
  | "playing"
  | "ducked"
  | "suspendedTransient"
  | "suspendedLoss"
  | "userPaused"
  | "noisyPaused";

export type FocusKind = "loss" | "lossTransient" | "duck" | "gain";

export type FocusChange = {
  kind: FocusKind;
  shouldResume?: boolean;
};

export type FocusAction =
  | { type: "focus"; change: FocusChange }
  | { type: "userPause" }
  | { type: "userPlay" }
  | { type: "noisy" }
  | { type: "routeSpeaker" };

export type FocusEffect =
  | { type: "fadeSuspend" }
  | { type: "resumeFadeIn"; ms: number }
  | { type: "duck"; db: number }
  | { type: "unduck" }
  | { type: "noop" }
  | { type: "denyPlay" };

export type FocusTransition = {
  mode: FocusMode;
  effect: FocusEffect;
};

const DUCK_DB = -10;
const RESUME_FADE_MS = 1000;

export function reduceFocus(
  mode: FocusMode,
  action: FocusAction,
): FocusTransition {
  switch (action.type) {
    case "userPause":
      if (
        mode === "userPaused" ||
        mode === "noisyPaused" ||
        mode === "suspendedLoss"
      ) {
        return { mode, effect: { type: "noop" } };
      }
      return { mode: "userPaused", effect: { type: "fadeSuspend" } };

    case "noisy":
    case "routeSpeaker":
      if (mode === "noisyPaused") {
        return { mode, effect: { type: "noop" } };
      }
      return { mode: "noisyPaused", effect: { type: "fadeSuspend" } };

    case "userPlay":
      if (mode === "playing" || mode === "ducked") {
        return { mode: "playing", effect: { type: "noop" } };
      }
      // Caller must hold focus before applying resume; machine allows the intent.
      return {
        mode: "playing",
        effect: { type: "resumeFadeIn", ms: RESUME_FADE_MS },
      };

    case "focus":
      return reduceFocusChange(mode, action.change);

    default:
      return { mode, effect: { type: "noop" } };
  }
}

function reduceFocusChange(
  mode: FocusMode,
  change: FocusChange,
): FocusTransition {
  switch (change.kind) {
    case "duck":
      if (mode === "playing") {
        return { mode: "ducked", effect: { type: "duck", db: DUCK_DB } };
      }
      return { mode, effect: { type: "noop" } };

    case "lossTransient":
      if (
        mode === "playing" ||
        mode === "ducked"
      ) {
        return { mode: "suspendedTransient", effect: { type: "fadeSuspend" } };
      }
      return { mode, effect: { type: "noop" } };

    case "loss":
      if (
        mode === "userPaused" ||
        mode === "noisyPaused" ||
        mode === "suspendedLoss"
      ) {
        return { mode: "suspendedLoss", effect: { type: "noop" } };
      }
      return { mode: "suspendedLoss", effect: { type: "fadeSuspend" } };

    case "gain":
      if (mode === "ducked") {
        return { mode: "playing", effect: { type: "unduck" } };
      }
      if (mode === "suspendedTransient") {
        // Resume only if the user hasn't paused in the meantime (still transient).
        return {
          mode: "playing",
          effect: { type: "resumeFadeIn", ms: RESUME_FADE_MS },
        };
      }
      // gain in any other mode → do nothing
      return { mode, effect: { type: "noop" } };

    default:
      return { mode, effect: { type: "noop" } };
  }
}

export const FOCUS_DUCK_DB = DUCK_DB;
export const FOCUS_RESUME_FADE_MS = RESUME_FADE_MS;
