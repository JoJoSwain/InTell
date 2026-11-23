import { useSyncExternalStore } from "react";
import { getPulseFrame, subscribePulse } from "./pulseClock";

export function usePulseFrame(active: boolean): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!active) return () => undefined;
      return subscribePulse(onStoreChange);
    },
    () => (active ? getPulseFrame() : 0),
    () => 0,
  );
}
