import type { FocusMode } from "./focusMachine";

/**
 * Whether fade-suspend should set Media3 playWhenReady=false (demote FGS).
 * Keep FGS through suspendedTransient (call / LOSS_TRANSIENT) per Android 17
 * + review 3. Hard LOSS / user pause / noisy demote.
 */
export function shouldDemoteSessionOnSuspend(mode: FocusMode): boolean {
  return mode !== "suspendedTransient";
}
