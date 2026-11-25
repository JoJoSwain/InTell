import { AudioSessionController } from "./AudioSessionController";

jest.mock("audio-session", () => ({
  __esModule: true,
  default: {
    start: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    update: jest.fn(async () => undefined),
    requestFocus: jest.fn(async () => true),
    abandonFocus: jest.fn(async () => undefined),
    logContextState: jest.fn(async () => undefined),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe("AudioSessionController remote play (review 3)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("denied focus reverts to paused within the retry window", async () => {
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
    // Native already flipped playWhenReady=true in the media command (WIU FGS).
    ctrl.setModeForTest("suspendedLoss");

    const busy: string[] = [];
    ctrl.setBusyHandler((s) => busy.push(s));

    const first = ctrl.userPlay();
    await jest.runAllTimersAsync();
    await expect(first).resolves.toBe(false);

    expect(focusCalls).toBe(3);
    expect(ctrl.getMode()).toBe("suspendedLoss");
    expect(ctrl.getBusy()).toBe("audioBusy");
    expect(busy).toContain("audioBusy");
    // setPlayback(false) via update paused — shade returns to paused.
    expect(updates).toEqual(["paused"]);

    await ctrl.applyFocusEvent({ kind: "gain" });
    expect(ctrl.getBusy()).toBe("ok");
    expect(ctrl.getMode()).toBe("suspendedLoss");

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

  it("successful remote play confirms playing after focus", async () => {
    const updates: string[] = [];
    const ctrl = new AudioSessionController({
      requestFocusOnce: async () => true,
      updateSession: async (_meta, state) => {
        updates.push(state);
      },
    });
    ctrl.markStartedForTest(true);
    ctrl.setModeForTest("suspendedLoss");

    const p = ctrl.userPlay();
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBe(true);
    expect(ctrl.getMode()).toBe("playing");
    expect(updates).toEqual(["playing"]);
  });
});
