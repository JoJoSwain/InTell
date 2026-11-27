import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  decodeDump,
  extractInTellMessage,
  formatTimeline,
  longestSilentNarrationStretch,
  median,
  parseMessage,
  parseWalkLog,
  summarizeWalk,
} from "./parse.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "..", "fixtures", "sample.log");
const fixture = fs.readFileSync(fixturePath, "utf8");

describe("walk-log parse", () => {
  it("parses known message shapes", () => {
    expect(parseMessage("play bbbbbbbb day")).toEqual({
      kind: "play",
      id8: "bbbbbbbb",
      window: "day",
    });
    expect(parseMessage("showTeaser locked dddddddd")).toEqual({
      kind: "showTeaser",
      reason: "locked",
      id8: "dddddddd",
    });
    expect(parseMessage("narrationEnded interrupted")?.reason).toBe(
      "interrupted",
    );
    expect(parseMessage("fix acc=12")).toEqual({ kind: "fix", accM: 12 });
    expect(parseMessage("cmd playNarration deadbeef")?.sha8).toBe("deadbeef");
    expect(parseMessage("cmd-fail load cafebabe missing")?.cmdType).toBe(
      "load",
    );
    expect(parseMessage("totally-unknown")).toBeNull();
  });

  it("parses start, remote, scan, and apply line kinds", () => {
    expect(
      parseMessage('handlePlay:start ok=true title=Walk 2 QR'),
    ).toEqual({ kind: "handlePlay:start", ok: true });
    expect(parseMessage("handlePlay:start ok=false")).toEqual({
      kind: "handlePlay:start",
      ok: false,
    });
    expect(parseMessage("resume:start ok=true")).toEqual({
      kind: "resume:start",
      ok: true,
    });
    expect(parseMessage("remote:pause")).toEqual({
      kind: "remote",
      remoteCmd: "pause",
    });
    expect(parseMessage("scan hash=0ae7c708")).toEqual({
      kind: "scan",
      sha8: "0ae7c708",
    });
    expect(parseMessage("start:interrupt-stale playedMs=1200")).toEqual({
      kind: "start:interrupt-stale",
      playedMs: 1200,
    });
    expect(parseMessage("no-uri narration a460e478")).toEqual({
      kind: "no-uri",
      assetType: "narration",
      sha8: "a460e478",
    });
    expect(parseMessage("applyCommands duck master")).toEqual({
      kind: "applyCommands",
      applyMessage: "duck master",
    });
  });

  it("counts handlePlay:start ok=false as audio busy", () => {
    const events = parseWalkLog(
      [
        "11-25 10:00:00.000 W InTellAudio: handlePlay:start ok=false",
        "11-25 10:00:01.000 W InTellAudio: handlePlay:start ok=true title=X",
        "11-25 10:00:02.000 W InTellAudio: handlePlay:start ok=false",
      ].join("\n"),
    );
    expect(summarizeWalk(events).audioBusy).toBe(2);
  });

  it("decodes a UTF-16LE dump with BOM to the same events as UTF-8", () => {
    const utf8Events = parseWalkLog(fixture);
    const bom = Buffer.from([0xff, 0xfe]);
    const body = Buffer.from(fixture, "utf16le");
    const decoded = decodeDump(Buffer.concat([bom, body]));
    expect(decoded.charCodeAt(0)).not.toBe(0xfeff);
    expect(parseWalkLog(decoded)).toEqual(utf8Events);
  });

  it("drops lines that look like lat/lng pairs", () => {
    expect(
      extractInTellMessage(
        "11-25 10:00:00.000 W InTellAudio: play ignored because 40.7600, -111.8880 looks like coords",
      ),
    ).toBeNull();
  });

  it("builds a timeline and summary from the fixture log", () => {
    const events = parseWalkLog(fixture);
    expect(events.some((e) => e.kind === "sessionStarted")).toBe(true);
    expect(events.some((e) => e.kind === "play" && e.window === "day")).toBe(
      true,
    );
    expect(events.every((e) => !/,/.test(e.raw) || e.kind !== "play")).toBe(
      true,
    );

    const names = { bbbbbbbb: "Beginning", eeeeeeee: "Overlook" };
    const summary = summarizeWalk(events, names);
    expect(summary.storiesPlayed).toBe(2);
    expect(summary.storiesCompleted).toBe(1);
    expect(summary.unlocks).toBe(1);
    expect(summary.interruptions).toBe(1);
    expect(summary.teasersByReason).toEqual({ locked: 1 });
    expect(summary.fixAccuracy.n).toBe(2);
    expect(summary.fixAccuracy.medianM).toBe(10);
    expect(summary.fixAccuracy.maxM).toBe(12);

    const silent = longestSilentNarrationStretch(events);
    // 10:00:22 → 10:00:40 = 18_000 ms of playing with out < -60
    expect(silent.ms).toBe(18_000);

    const rows = formatTimeline(events, names);
    expect(rows[0]).toMatch(/^00:00\.000\tsessionStarted/);
    expect(rows.some((r) => r.includes("bbbbbbbb (Beginning)"))).toBe(true);
    expect(rows.some((r) => r.includes("\tday\t"))).toBe(true);
  });

  it("computes median for even and odd lengths", () => {
    expect(median([1])).toBe(1);
    expect(median([1, 3])).toBe(2);
    expect(median([8, 12])).toBe(10);
  });
});
