/**
 * C1: tour-loop gate is a pure predicate so production can never enable it by accident.
 * (RNAudioApiEngine itself needs the native audio module — not loadable under jest.)
 */
import { shouldRunTourLoop } from "./spikeGate";

describe("spike tour-loop gate (C1)", () => {
  it("never runs when spikeMode is off (production default)", () => {
    expect(shouldRunTourLoop(false, true, true)).toBe(false);
    expect(shouldRunTourLoop(false, false, true)).toBe(false);
  });

  it("runs only when spikeMode, mixActive, and a template are all set", () => {
    expect(shouldRunTourLoop(true, true, true)).toBe(true);
    expect(shouldRunTourLoop(true, false, true)).toBe(false);
    expect(shouldRunTourLoop(true, true, false)).toBe(false);
  });
});
