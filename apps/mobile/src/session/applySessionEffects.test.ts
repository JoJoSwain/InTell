import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { listCompletions, listUnlocks } from "../db/repos";
import { applySessionEffects } from "./applySessionEffects";
import type { SessionEffect } from "@intell/shared";

describe("applySessionEffects", () => {
  it("writes completion and unlocks; counts analytics; ignores growthMoment", async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const modes: string[] = [];
    const analytics: string[] = [];
    let unlockBanner = false;

    const effects: SessionEffect[] = [
      {
        type: "recordCompletion",
        fragmentId: "f1",
        revisionNo: 1,
        timeWindow: "day",
        onSite: true,
        trigger: "proximity",
        sessionId: "s1",
      },
      { type: "writeUnlocks", fragmentIds: ["f2"] },
      {
        type: "analytics",
        name: "fragment_completed",
        props: { time_window: "day", change_kind: null },
        refs: { fragmentId: "f1", sessionId: "s1" },
      },
      { type: "growthMoment", fragmentId: "f1", revisionNo: 1 },
      { type: "setLocationMode", mode: "balanced" },
    ];

    const result = await applySessionEffects(effects, {
      db,
      nowIso: () => "2026-06-15T17:00:00.000Z",
      setLocationMode: (m) => {
        modes.push(m);
      },
      onPlay: async () => undefined,
      onStopNarration: async () => undefined,
      onTeaser: () => undefined,
      onAfterglow: () => undefined,
      onUnlockBanner: () => {
        unlockBanner = true;
      },
      resolveTeaserCopy: () => ({ teaserText: "" }),
      onAnalytics: (name) => analytics.push(name),
    });

    expect((await listCompletions(db))[0]?.fragment_id).toBe("f1");
    expect((await listUnlocks(db))[0]?.fragment_id).toBe("f2");
    expect(modes).toEqual(["balanced"]);
    expect(analytics).toEqual(["fragment_completed"]);
    expect(result.growthMomentsIgnored).toBe(1);
    expect(unlockBanner).toBe(true);
  });
});
