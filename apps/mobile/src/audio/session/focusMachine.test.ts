import { reduceFocus, type FocusMode } from "./focusMachine";

describe("focusMachine", () => {
  it("ducks from playing and unducks on gain", () => {
    let mode: FocusMode = "playing";
    let t = reduceFocus(mode, { type: "focus", change: { kind: "duck" } });
    expect(t.mode).toBe("ducked");
    expect(t.effect).toEqual({ type: "duck", db: -10 });
    mode = t.mode;
    t = reduceFocus(mode, { type: "focus", change: { kind: "gain" } });
    expect(t.mode).toBe("playing");
    expect(t.effect).toEqual({ type: "unduck" });
  });

  it("suspends on lossTransient and resumes on gain", () => {
    let mode: FocusMode = "playing";
    let t = reduceFocus(mode, {
      type: "focus",
      change: { kind: "lossTransient", shouldResume: true },
    });
    expect(t.mode).toBe("suspendedTransient");
    expect(t.effect.type).toBe("fadeSuspend");
    mode = t.mode;
    t = reduceFocus(mode, { type: "focus", change: { kind: "gain" } });
    expect(t.mode).toBe("playing");
    expect(t.effect).toEqual({ type: "resumeFadeIn", ms: 1000 });
  });

  it("does not resume transient after user pause", () => {
    let mode: FocusMode = "playing";
    mode = reduceFocus(mode, {
      type: "focus",
      change: { kind: "lossTransient", shouldResume: true },
    }).mode;
    // User somehow pauses while suspended — treat as userPaused
    mode = reduceFocus(mode, { type: "userPause" }).mode;
    expect(mode).toBe("userPaused");
    const t = reduceFocus(mode, { type: "focus", change: { kind: "gain" } });
    expect(t.mode).toBe("userPaused");
    expect(t.effect.type).toBe("noop");
  });

  it("hard loss does not auto-resume on gain", () => {
    let mode: FocusMode = "playing";
    mode = reduceFocus(mode, {
      type: "focus",
      change: { kind: "loss", shouldResume: false },
    }).mode;
    expect(mode).toBe("suspendedLoss");
    const t = reduceFocus(mode, { type: "focus", change: { kind: "gain" } });
    expect(t.mode).toBe("suspendedLoss");
    expect(t.effect.type).toBe("noop");
  });

  it("userPlay from suspendedLoss resumes", () => {
    const t = reduceFocus("suspendedLoss", { type: "userPlay" });
    expect(t.mode).toBe("playing");
    expect(t.effect).toEqual({ type: "resumeFadeIn", ms: 1000 });
  });

  it("noisy pauses and never auto-resumes on gain", () => {
    let mode: FocusMode = "playing";
    mode = reduceFocus(mode, { type: "noisy" }).mode;
    expect(mode).toBe("noisyPaused");
    const t = reduceFocus(mode, { type: "focus", change: { kind: "gain" } });
    expect(t.mode).toBe("noisyPaused");
    expect(t.effect.type).toBe("noop");
  });

  it("routeSpeaker behaves like noisy", () => {
    const t = reduceFocus("playing", { type: "routeSpeaker" });
    expect(t.mode).toBe("noisyPaused");
    expect(t.effect.type).toBe("fadeSuspend");
  });

  it("duck ignored when already suspended", () => {
    const t = reduceFocus("suspendedTransient", {
      type: "focus",
      change: { kind: "duck" },
    });
    expect(t.mode).toBe("suspendedTransient");
    expect(t.effect.type).toBe("noop");
  });

  it("userPause from playing suspends", () => {
    const t = reduceFocus("playing", { type: "userPause" });
    expect(t.mode).toBe("userPaused");
    expect(t.effect.type).toBe("fadeSuspend");
  });

  it("userPlay from noisyPaused resumes", () => {
    const t = reduceFocus("noisyPaused", { type: "userPlay" });
    expect(t.mode).toBe("playing");
    expect(t.effect).toEqual({ type: "resumeFadeIn", ms: 1000 });
  });

  it("userPlay from userPaused resumes", () => {
    const t = reduceFocus("userPaused", { type: "userPlay" });
    expect(t.mode).toBe("playing");
    expect(t.effect).toEqual({ type: "resumeFadeIn", ms: 1000 });
  });

  it("gain while playing is noop", () => {
    const t = reduceFocus("playing", { type: "focus", change: { kind: "gain" } });
    expect(t.mode).toBe("playing");
    expect(t.effect.type).toBe("noop");
  });

  it("lossTransient from ducked suspends", () => {
    const t = reduceFocus("ducked", {
      type: "focus",
      change: { kind: "lossTransient", shouldResume: true },
    });
    expect(t.mode).toBe("suspendedTransient");
    expect(t.effect.type).toBe("fadeSuspend");
  });

  it("noisy from ducked pauses", () => {
    const t = reduceFocus("ducked", { type: "noisy" });
    expect(t.mode).toBe("noisyPaused");
    expect(t.effect.type).toBe("fadeSuspend");
  });

  it("userPause from ducked suspends", () => {
    const t = reduceFocus("ducked", { type: "userPause" });
    expect(t.mode).toBe("userPaused");
    expect(t.effect.type).toBe("fadeSuspend");
  });

  it("loss while userPaused stays suspendedLoss without extra fade", () => {
    const t = reduceFocus("userPaused", {
      type: "focus",
      change: { kind: "loss", shouldResume: false },
    });
    expect(t.mode).toBe("suspendedLoss");
    expect(t.effect.type).toBe("noop");
  });

  it("gain while noisyPaused is noop", () => {
    const t = reduceFocus("noisyPaused", {
      type: "focus",
      change: { kind: "gain" },
    });
    expect(t.mode).toBe("noisyPaused");
    expect(t.effect.type).toBe("noop");
  });

  it("noisy while already noisyPaused is noop", () => {
    const t = reduceFocus("noisyPaused", { type: "noisy" });
    expect(t.mode).toBe("noisyPaused");
    expect(t.effect.type).toBe("noop");
  });
});
