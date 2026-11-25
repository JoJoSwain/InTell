import { AudioSessionController } from "./AudioSessionController";

jest.mock("audio-session", () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    requestFocus: jest.fn(async () => true),
    abandonFocus: jest.fn(async () => undefined),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe("AudioSessionController remote play after hard LOSS", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("denied focus stays paused and next play retries", async () => {
    const updates: string[] = [];
    let focusCalls = 0;
    const focusResults = [false, false, false, true];
    const ctrl = new AudioSessionController({
      requestFocusOnce: async () => {
        const i = focusCalls;
        focusCalls += 1;
        return focusResults[i] ?? false;
      },
      updateSession: async (_meta, state) => {
        updates.push(state);
      },
    });
    ctrl.markStartedForTest(true);
    ctrl.setModeForTest("suspendedLoss");

    const busy: string[] = [];
    ctrl.setBusyHandler((s) => busy.push(s));

    const first = ctrl.userPlay();
    // Flush the 3×500 ms retry gaps.
    await jest.runAllTimersAsync();
    await expect(first).resolves.toBe(false);

    expect(focusCalls).toBe(3);
    expect(ctrl.getMode()).toBe("suspendedLoss");
    expect(ctrl.getBusy()).toBe("audioBusy");
    expect(busy).toContain("audioBusy");
    expect(updates).toEqual(["paused"]);

    // Later gain clears busy (no auto-resume).
    await ctrl.applyFocusEvent({ kind: "gain" });
    expect(ctrl.getBusy()).toBe("ok");
    expect(ctrl.getMode()).toBe("suspendedLoss");

    // Next play retries and succeeds on first attempt of the new call.
    focusCalls = 0;
    focusResults.length = 0;
    focusResults.push(true);
    const second = ctrl.userPlay();
    await jest.runAllTimersAsync();
    await expect(second).resolves.toBe(true);
    expect(focusCalls).toBe(1);
    expect(ctrl.getMode()).toBe("playing");
    expect(updates.at(-1)).toBe("playing");
  });
});
