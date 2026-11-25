import { shouldDemoteSessionOnSuspend } from "./sessionDemote";

describe("shouldDemoteSessionOnSuspend", () => {
  it("keeps FGS through suspendedTransient", () => {
    expect(shouldDemoteSessionOnSuspend("suspendedTransient")).toBe(false);
  });

  it("demotes on hard LOSS / user pause / noisy", () => {
    expect(shouldDemoteSessionOnSuspend("suspendedLoss")).toBe(true);
    expect(shouldDemoteSessionOnSuspend("userPaused")).toBe(true);
    expect(shouldDemoteSessionOnSuspend("noisyPaused")).toBe(true);
  });

  it("demotes from playing/ducked (unexpected fadeSuspend)", () => {
    expect(shouldDemoteSessionOnSuspend("playing")).toBe(true);
    expect(shouldDemoteSessionOnSuspend("ducked")).toBe(true);
  });
});
