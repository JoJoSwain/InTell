import {
  MIX_RECOVER_STEP_MS,
  MIX_SHED_AFTER_WINDOWS,
  MIX_SHED_ORDER,
  type MixShedLayer,
} from "./soundFeatures";

export type MixSignals = {
  clockStarving: boolean;
  batterySaver: boolean;
  thermal: boolean;
};

/** Serializable mix health state. */
export type MixLevelState = {
  shedIndex: number;
  degradedWindows: number;
  healthySinceAt: number | null;
};

export function initialMixLevelState(): MixLevelState {
  return { shedIndex: 0, degradedWindows: 0, healthySinceAt: null };
}

export function mixLevelFor(
  signals: MixSignals,
  prev: MixLevelState,
  at: number,
): MixLevelState {
  const degraded =
    signals.clockStarving || signals.batterySaver || signals.thermal;

  if (degraded) {
    const degradedWindows = prev.degradedWindows + 1;
    if (
      degradedWindows >= MIX_SHED_AFTER_WINDOWS &&
      prev.shedIndex < MIX_SHED_ORDER.length
    ) {
      return {
        shedIndex: prev.shedIndex + 1,
        degradedWindows: 0,
        healthySinceAt: null,
      };
    }
    return { ...prev, degradedWindows, healthySinceAt: null };
  }

  const healthySinceAt = prev.healthySinceAt ?? at;
  if (
    prev.shedIndex > 0 &&
    at - healthySinceAt >= MIX_RECOVER_STEP_MS
  ) {
    return {
      shedIndex: prev.shedIndex - 1,
      degradedWindows: 0,
      healthySinceAt: at,
    };
  }
  return { ...prev, degradedWindows: 0, healthySinceAt };
}

export function shedLayers(state: MixLevelState): MixShedLayer[] {
  return MIX_SHED_ORDER.slice(0, state.shedIndex);
}
