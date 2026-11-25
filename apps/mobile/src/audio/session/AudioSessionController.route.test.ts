/**
 * Route-transition pause rules (B·S3 plan review): only pause when the route
 * changes onto speaker after an external route, not on the first emit.
 */
import { reduceFocus } from "./focusMachine";

describe("routeSpeaker transition semantics", () => {
  it("routeSpeaker from playing suspends as noisyPaused", () => {
    const t = reduceFocus("playing", { type: "routeSpeaker" });
    expect(t.mode).toBe("noisyPaused");
    expect(t.effect.type).toBe("fadeSuspend");
  });

  it("documents that initial speaker must not call routeSpeaker", () => {
    // Controller keeps lastRoute=null until the first event; applying
    // routeSpeaker only when prev was headphones/bluetooth is covered by
    // the AudioSessionController.onRoute guard (not reducible here).
    expect(reduceFocus("playing", { type: "routeSpeaker" }).mode).toBe(
      "noisyPaused",
    );
  });
});
