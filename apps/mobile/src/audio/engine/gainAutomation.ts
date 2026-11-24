import type { GainNode } from "react-native-audio-api";

type GainParam = GainNode["gain"];

/**
 * Click-free gain change. Prefer cancelAndHoldAtTime (library 1.0.1 has it)
 * so we never restart a ramp from a stale param.value.
 */
export function rampGainHeld(
  param: GainParam,
  currentTime: number,
  target: number,
  rampMs: number,
): void {
  const now = currentTime;
  const safe = Math.max(target, 0.0001);
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(param.value, 0.0001), now);
  }
  if (rampMs <= 0) {
    param.setValueAtTime(safe, now);
    return;
  }
  param.linearRampToValueAtTime(safe, now + rampMs / 1000);
}

/** Equal-power crossfade curves into Float32Arrays for setValueCurveAtTime. */
export function equalPowerCurve(
  fromLinear: number,
  toLinear: number,
  steps = 32,
): Float32Array {
  const values = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Equal-power blend between from and to.
    const a = Math.cos((t * Math.PI) / 2);
    const b = Math.sin((t * Math.PI) / 2);
    values[i] = Math.max(0.0001, fromLinear * a + toLinear * b);
  }
  return values;
}
