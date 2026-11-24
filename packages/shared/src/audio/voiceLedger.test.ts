import { describe, expect, it } from "vitest";
import { VoiceLedger } from "./voiceLedger";

function afterEachScenario(ledger: VoiceLedger): void {
  ledger.assertBalanced();
}

describe("VoiceLedger", () => {
  it("tracks create, start, release and stays balanced", () => {
    const ledger = new VoiceLedger();
    ledger.create("n1", "narration", 100);
    ledger.markStarted("n1", 10);
    ledger.create("o1", "oneshot", 50);
    ledger.markStarted("o1", 40);
    expect(ledger.liveCount()).toBe(2);
    expect(ledger.getStats().created).toBe(2);
    ledger.markReleased("n1");
    ledger.markReleased("o1");
    expect(ledger.liveCount()).toBe(0);
    expect(ledger.getStats().released).toBe(2);
    afterEachScenario(ledger);
  });

  it("markReleased is idempotent", () => {
    const ledger = new VoiceLedger();
    ledger.create("a", "bed", 20);
    expect(ledger.markReleased("a")).toBe(true);
    expect(ledger.markReleased("a")).toBe(false);
    expect(ledger.getStats().released).toBe(1);
    afterEachScenario(ledger);
  });

  it("excludes heartbeats from liveCount when requested", () => {
    const ledger = new VoiceLedger();
    ledger.create("h1", "heartbeat", 15);
    ledger.create("h2", "heartbeat", 25);
    ledger.create("s1", "stem", 30);
    expect(ledger.liveCount(true)).toBe(1);
    expect(ledger.liveCount(false)).toBe(3);
    ledger.markReleased("h1");
    ledger.markReleased("h2");
    ledger.markReleased("s1");
    afterEachScenario(ledger);
  });

  it("counts pending one-shots by future startSec", () => {
    const ledger = new VoiceLedger();
    const now = 100;
    ledger.create("live", "oneshot", 110);
    ledger.markStarted("live", 95);
    ledger.create("pending", "oneshot", 125);
    ledger.markStarted("pending", 120);
    expect(ledger.pendingOneShotCount(now)).toBe(1);
    ledger.markReleased("live");
    ledger.markReleased("pending");
    afterEachScenario(ledger);
  });

  it("liveOrPendingSources matches budget counting", () => {
    const ledger = new VoiceLedger();
    const now = 50;
    ledger.create("nar", "narration", 200);
    ledger.markStarted("nar", 0);
    ledger.create("stem0", "stem", 200);
    ledger.markStarted("stem0", 0);
    ledger.create("bed0", "bed", 200);
    ledger.markStarted("bed0", 0);
    ledger.create("pending", "oneshot", 70);
    ledger.markStarted("pending", 60);
    ledger.create("hb", "heartbeat", 55);
    expect(ledger.liveOrPendingSources(now, true)).toBe(4);
    ledger.markReleased("nar");
    ledger.markReleased("stem0");
    ledger.markReleased("bed0");
    ledger.markReleased("pending");
    ledger.markReleased("hb");
    afterEachScenario(ledger);
  });

  it("releaseIfPast returns ids past expected end plus grace", () => {
    const ledger = new VoiceLedger();
    ledger.create("stale", "oneshot", 10);
    ledger.markStarted("stale", 5);
    ledger.create("ok", "oneshot", 100);
    ledger.markStarted("ok", 90);
    const now = 11;
    expect(ledger.releaseIfPast(now, 0.5)).toEqual(["stale"]);
    ledger.markReleased("stale");
    ledger.recordMissedEnded(1);
    expect(ledger.getStats().missedEnded).toBe(1);
    ledger.markReleased("ok");
    afterEachScenario(ledger);
  });

  it("cancel before start: release without start marks", () => {
    const ledger = new VoiceLedger();
    ledger.create("queued", "oneshot", 108);
    ledger.setExpectedEnd("queued", 108);
    expect(ledger.pendingOneShotCount(100)).toBe(1);
    ledger.markReleased("queued");
    expect(ledger.pendingOneShotCount(100)).toBe(0);
    afterEachScenario(ledger);
  });

  it("stop all during fade: sweep then release keeps balance", () => {
    const ledger = new VoiceLedger();
    ledger.create("n", "narration", 95);
    ledger.markStarted("n", 0);
    ledger.create("b", "bed", 92);
    ledger.markStarted("b", 0);
    ledger.setExpectedEnd("n", 95);
    ledger.setExpectedEnd("b", 92);
    const now = 96;
    const toSweep = ledger.releaseIfPast(now, 0.5);
    expect(toSweep.sort()).toEqual(["b", "n"]);
    for (const id of toSweep) {
      ledger.markReleased(id);
    }
    ledger.recordMissedEnded(toSweep.length);
    expect(ledger.liveCount()).toBe(0);
    expect(ledger.getStats().missedEnded).toBe(2);
    afterEachScenario(ledger);
  });

  it("getStats reports created, released, live and missedEnded", () => {
    const ledger = new VoiceLedger();
    ledger.create("x", "stem", 10);
    ledger.recordMissedEnded(3);
    expect(ledger.getStats()).toEqual({
      created: 1,
      released: 0,
      missedEnded: 3,
      live: 1,
    });
    ledger.markReleased("x");
    afterEachScenario(ledger);
  });
});