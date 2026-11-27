#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  decodeDump,
  formatSummary,
  formatTimeline,
  parseWalkLog,
  summarizeWalk,
} from "./parse.mjs";

function usage() {
  return [
    "Usage: node src/cli.mjs <logcat-dump.txt> [--names <map.json>]",
    "",
    "Reads an `adb logcat -s InTellAudio` dump and prints a timeline + summary.",
    "--names maps id8 → a short label (JSON object).",
  ].join("\n");
}

/**
 * @param {string[]} argv
 */
async function main(argv) {
  /** @type {string | null} */
  let logPath = null;
  /** @type {string | null} */
  let namesPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--names") {
      namesPath = argv[++i] ?? null;
      continue;
    }
    if (a === "--help" || a === "-h") {
      console.log(usage());
      return;
    }
    if (!logPath) logPath = a;
  }
  if (!logPath) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const bytes = await fs.readFile(path.resolve(logPath));
  const text = decodeDump(bytes);
  /** @type {Record<string, string>} */
  let names = {};
  if (namesPath) {
    names = JSON.parse(await fs.readFile(path.resolve(namesPath), "utf8"));
  }

  const events = parseWalkLog(text);
  const summary = summarizeWalk(events, names);

  console.log("relative\tevent\tid8\twindow\tout");
  for (const row of formatTimeline(events, names)) {
    console.log(row);
  }
  console.log("");
  console.log(formatSummary(summary));
}

main(process.argv.slice(2)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
