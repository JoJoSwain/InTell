/**
 * RC7: per-command isolation — one failure must not block playNarration.
 */
import type { DirectorCommand, NowPlayingMeta } from "@intell/shared";
import { BUS_DEFAULT_DB } from "@intell/shared";
import { getAudioBreadcrumbs, clearAudioBreadcrumbs } from "../session/audioBreadcrumbs";
import { FakeExploringEngine } from "../../session/fakeExploringEngine";
import { applyDirectorCommands } from "./applyDirectorCommands";

const META: NowPlayingMeta = {
  title: "Walk 2 QR",
  artist: "InTell",
};

const SHA =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("applyDirectorCommands (RC7)", () => {
  beforeEach(() => {
    clearAudioBreadcrumbs();
  });

  it("strict fake throws on unknown bus", () => {
    const engine = new FakeExploringEngine();
    expect(() => engine.setGain("not-a-bus" as never, 0, 0)).toThrow(
      /Unknown bus/,
    );
    for (const bus of Object.keys(BUS_DEFAULT_DB)) {
      expect(() => engine.setGain(bus as never, 0, 0)).not.toThrow();
    }
  });

  it("failing setBusGain does not block later playNarration", async () => {
    const engine = new FakeExploringEngine();
    const original = engine.setGain.bind(engine);
    engine.setGain = ((target, gainDb, rampMs) => {
      if (typeof target === "string" && target === "moment") {
        throw new Error("Unknown bus moment");
      }
      return original(target, gainDb, rampMs);
    }) as typeof engine.setGain;

    const assetFailed: string[] = [];
    const commands: DirectorCommand[] = [
      { type: "load", sha: SHA, decodeHz: 24_000 },
      { type: "setBusGain", bus: "story", gainDb: 0, rampMs: 0 },
      { type: "setBusGain", bus: "moment", gainDb: -8, rampMs: 0 },
      {
        type: "playNarration",
        id: "narr-cmd-1",
        sha: SHA,
        meta: META,
        startAtMs: 0,
      },
    ];

    const voices = await applyDirectorCommands(commands, {
      engine: engine as never,
      resolveUri: () => "file:///tmp/a.m4a",
      onAssetFailed: (sha) => {
        assetFailed.push(sha);
      },
    });

    expect(voices.get("narr-cmd-1")?.id).toBeTruthy();
    expect(engine.playedNarration.some((p) => p.title === "Walk 2 QR")).toBe(
      true,
    );
    expect(engine.getNarrationDiag()?.id).toBeTruthy();
    const crumbs = getAudioBreadcrumbs().map((c) => c.message);
    expect(crumbs.some((m) => m.startsWith("cmd-fail setBusGain"))).toBe(true);
    expect(crumbs.some((m) => m.includes("cmd playNarration"))).toBe(true);
    expect(assetFailed).toEqual([]);
  });

  it("no-uri is breadcrumbed and does not throw", async () => {
    const engine = new FakeExploringEngine();
    await applyDirectorCommands(
      [{ type: "load", sha: SHA, decodeHz: 24_000 }],
      {
        engine: engine as never,
        resolveUri: () => null,
      },
    );
    const crumbs = getAudioBreadcrumbs().map((c) => c.message);
    expect(crumbs.some((m) => m.startsWith("no-uri load"))).toBe(true);
    expect(engine.loads).toEqual([]);
  });
});
