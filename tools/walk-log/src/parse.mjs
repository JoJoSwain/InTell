/**
 * Parse `adb logcat -s InTellAudio` dumps for an M6 walk debrief.
 * Never treat coordinates or marker codes as events.
 */

/** @typedef {{
 *   atMs: number,
 *   raw: string,
 *   kind: string,
 *   id8?: string,
 *   window?: string,
 *   reason?: string,
 *   accM?: number,
 *   cmdType?: string,
 *   sha8?: string,
 *   outDb?: number | null,
 *   playing?: boolean,
 *   ok?: boolean,
 *   remoteCmd?: string,
 *   playedMs?: number,
 *   applyMessage?: string,
 *   assetType?: string,
 *   diag?: Record<string, string>,
 * }} WalkEvent */

const TAG = /(?:^|\s)(?:W\/)?InTellAudio(?:\([^)]*\))?:\s*(.*)$/;

/** Drop lines that look like they embed a lat/lng pair. */
const LAT_LNG =
  /(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/;

/**
 * Decode a log dump. PowerShell 5's `>` writes UTF-16 LE (often with BOM).
 * @param {Uint8Array | Buffer} bytes
 * @returns {string}
 */
export function decodeDump(bytes) {
  const buf =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // TextDecoder wants the WHATWG labels ("utf-8" / "utf-16le"), not Node's "utf16le".
  let encoding = "utf-8";
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = "utf-16le";
  } else {
    const n = Math.min(200, buf.length);
    let oddZeros = 0;
    let oddCount = 0;
    for (let i = 1; i < n; i += 2) {
      oddCount += 1;
      if (buf[i] === 0) oddZeros += 1;
    }
    if (oddCount > 0 && oddZeros === oddCount) encoding = "utf-16le";
  }
  let text = new TextDecoder(encoding).decode(buf);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/**
 * Android logcat timestamps are often `MM-DD HH:MM:SS.mmm` without a year.
 * Use a fixed year so relative deltas stay stable within one dump.
 * @param {string} line
 * @param {number} [year=2026]
 * @returns {number | null}
 */
export function parseLogTimestampMs(line, year = 2026) {
  const m = line.match(
    /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})\b/,
  );
  if (!m) return null;
  const [, mo, dy, hh, mm, ss, ms] = m;
  const d = new Date(
    Date.UTC(
      year,
      Number(mo) - 1,
      Number(dy),
      Number(hh),
      Number(mm),
      Number(ss),
      Number(ms),
    ),
  );
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * @param {string} line
 * @returns {string | null}
 */
export function extractInTellMessage(line) {
  if (LAT_LNG.test(line)) return null;
  const m = line.match(TAG);
  if (!m) return null;
  const msg = (m[1] ?? "").trim();
  if (!msg || LAT_LNG.test(msg)) return null;
  return msg;
}

/**
 * @param {string} msg
 * @returns {Omit<WalkEvent, "atMs" | "raw" | "outDb"> | null}
 */
export function parseMessage(msg) {
  let m;

  m = msg.match(/^play\s+([0-9a-f]{8})\s+(day|night)\b/i);
  if (m) {
    return {
      kind: "play",
      id8: m[1].toLowerCase(),
      window: m[2].toLowerCase(),
    };
  }

  m = msg.match(/^showTeaser\s+(\S+)\s+([0-9a-f]{8})\b/i);
  if (m) {
    return { kind: "showTeaser", reason: m[1], id8: m[2].toLowerCase() };
  }

  m = msg.match(/^queued\s+([0-9a-f]{8})\b/i);
  if (m) return { kind: "queued", id8: m[1].toLowerCase() };

  m = msg.match(/^narrationEnded\s+(natural|stopped|interrupted)\b/i);
  if (m) return { kind: "narrationEnded", reason: m[1].toLowerCase() };

  if (/^stopNarration\b/i.test(msg)) return { kind: "stopNarration" };
  if (/^sessionStarted\b/i.test(msg)) return { kind: "sessionStarted" };
  if (/^sessionEnded\b/i.test(msg)) return { kind: "sessionEnded" };

  m = msg.match(/^groveEntered\s+([0-9a-f]{8})\b/i);
  if (m) return { kind: "groveEntered", id8: m[1].toLowerCase() };

  m = msg.match(/^unlocked\s+([0-9a-f]{8})\b/i);
  if (m) return { kind: "unlocked", id8: m[1].toLowerCase() };

  m = msg.match(/^completed\s+([0-9a-f]{8})\b/i);
  if (m) return { kind: "completed", id8: m[1].toLowerCase() };

  m = msg.match(/^fix\s+acc=(-?\d+(?:\.\d+)?)\b/i);
  if (m) return { kind: "fix", accM: Number(m[1]) };

  m = msg.match(/^cmd-fail\s+(\S+)(?:\s+([0-9a-f]{0,8}))?/i);
  if (m) {
    return {
      kind: "cmd-fail",
      cmdType: m[1],
      sha8: m[2] && m[2].length > 0 ? m[2].toLowerCase() : undefined,
    };
  }

  m = msg.match(/^cmd\s+(\S+)(?:\s+([0-9a-f]{8}|story))?\b/i);
  if (m) {
    return {
      kind: "cmd",
      cmdType: m[1],
      sha8: m[2] && m[2] !== "story" ? m[2].toLowerCase() : m[2],
    };
  }

  // handlePlay:start ok=<bool> …title ignored…
  m = msg.match(/^handlePlay:start\s+ok=(true|false)\b/i);
  if (m) {
    return { kind: "handlePlay:start", ok: m[1].toLowerCase() === "true" };
  }

  m = msg.match(/^resume:start\s+ok=(true|false)\b/i);
  if (m) {
    return { kind: "resume:start", ok: m[1].toLowerCase() === "true" };
  }

  m = msg.match(/^remote:(\S+)/i);
  if (m) return { kind: "remote", remoteCmd: m[1] };

  m = msg.match(/^scan\s+hash=([0-9a-f]{8})\b/i);
  if (m) return { kind: "scan", sha8: m[1].toLowerCase() };

  m = msg.match(/^start:interrupt-stale\s+playedMs=(-?\d+)\b/i);
  if (m) {
    return { kind: "start:interrupt-stale", playedMs: Number(m[1]) };
  }

  m = msg.match(/^no-uri\s+(\S+)\s+([0-9a-f]{8})\b/i);
  if (m) {
    return {
      kind: "no-uri",
      assetType: m[1],
      sha8: m[2].toLowerCase(),
    };
  }

  m = msg.match(/^applyCommands\s+(.+)$/i);
  if (m) {
    return { kind: "applyCommands", applyMessage: m[1].trim() };
  }

  if (/^diag\s+/i.test(msg)) {
    const diag = {};
    for (const part of msg.slice(5).trim().split(/\s+/)) {
      const eq = part.indexOf("=");
      if (eq <= 0) continue;
      diag[part.slice(0, eq)] = part.slice(eq + 1);
    }
    const outRaw = diag.out;
    let outDb = null;
    if (outRaw != null && outRaw !== "n/a") {
      const n = Number(outRaw);
      if (Number.isFinite(n)) outDb = n;
    }
    const playing =
      diag.playing === "true" || diag.playing === "1"
        ? true
        : diag.playing === "false" || diag.playing === "0"
          ? false
          : undefined;
    return {
      kind: "diag",
      id8: diag.narr && diag.narr !== "none" ? diag.narr : undefined,
      outDb,
      playing,
      diag,
    };
  }

  return null;
}

/**
 * @param {string} text
 * @returns {WalkEvent[]}
 */
export function parseWalkLog(text) {
  /** @type {WalkEvent[]} */
  const events = [];
  let lastOut = null;
  let synthetic = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const msg = extractInTellMessage(line);
    if (msg == null) continue;
    const parsed = parseMessage(msg);
    if (!parsed) continue;

    let atMs = parseLogTimestampMs(line);
    if (atMs == null) {
      atMs = synthetic;
      synthetic += 1;
    }

    /** @type {WalkEvent} */
    const ev = { atMs, raw: line, ...parsed };
    if (ev.kind === "diag") {
      if (ev.outDb != null) lastOut = ev.outDb;
    } else {
      ev.outDb = lastOut;
    }
    events.push(ev);
  }

  return events;
}

/**
 * @param {number[]} values
 * @returns {number | null}
 */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Longest contiguous stretch (ms) where a narration is live and out < -60 dB.
 * Uses diag samples; open-ended at the end uses the last sample time.
 * @param {WalkEvent[]} events
 * @returns {{ ms: number, fromMs: number | null, toMs: number | null }}
 */
export function longestSilentNarrationStretch(events) {
  let best = 0;
  let bestFrom = null;
  let bestTo = null;
  let runStart = null;
  let prevAt = null;
  let inRun = false;

  for (const ev of events) {
    if (ev.kind !== "diag") continue;
    const silent =
      ev.playing === true && ev.outDb != null && ev.outDb < -60;
    if (silent) {
      if (!inRun) {
        inRun = true;
        runStart = ev.atMs;
      }
    } else if (inRun) {
      const end = prevAt ?? ev.atMs;
      const dur = end - (runStart ?? end);
      if (dur > best) {
        best = dur;
        bestFrom = runStart;
        bestTo = end;
      }
      inRun = false;
      runStart = null;
    }
    prevAt = ev.atMs;
  }
  if (inRun && runStart != null && prevAt != null) {
    const dur = prevAt - runStart;
    if (dur > best) {
      best = dur;
      bestFrom = runStart;
      bestTo = prevAt;
    }
  }
  return { ms: best, fromMs: bestFrom, toMs: bestTo };
}

/**
 * @param {WalkEvent[]} events
 * @param {Record<string, string>} [names]
 */
export function summarizeWalk(events, names = {}) {
  const plays = events.filter((e) => e.kind === "play");
  const completed = events.filter((e) => e.kind === "completed");
  const unlocks = events.filter((e) => e.kind === "unlocked");
  const interruptions = events.filter(
    (e) => e.kind === "narrationEnded" && e.reason === "interrupted",
  );
  /** @type {Record<string, number>} */
  const teasersByReason = {};
  for (const e of events) {
    if (e.kind !== "showTeaser" || !e.reason) continue;
    teasersByReason[e.reason] = (teasersByReason[e.reason] ?? 0) + 1;
  }
  const accs = events
    .filter((e) => e.kind === "fix" && e.accM != null)
    .map((e) => e.accM);
  const silent = longestSilentNarrationStretch(events);
  const audioBusy = events.filter(
    (e) => e.kind === "handlePlay:start" && e.ok === false,
  ).length;

  return {
    storiesPlayed: plays.length,
    storiesCompleted: completed.length,
    unlocks: unlocks.length,
    interruptions: interruptions.length,
    audioBusy,
    teasersByReason,
    fixAccuracy: {
      n: accs.length,
      medianM: median(accs),
      maxM: accs.length ? Math.max(...accs) : null,
    },
    longestSilentNarrationMs: silent.ms,
    longestSilentNarration: silent,
    names,
  };
}

/**
 * @param {number} ms
 */
export function formatRelative(ms) {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const millis = abs % 1000;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/**
 * @param {WalkEvent[]} events
 * @param {Record<string, string>} [names]
 * @returns {string[]}
 */
export function formatTimeline(events, names = {}) {
  if (events.length === 0) return [];
  const t0 = events[0].atMs;
  /** @type {string[]} */
  const rows = [];
  for (const ev of events) {
    if (ev.kind === "diag") continue;
    const rel = formatRelative(ev.atMs - t0);
    const label =
      ev.id8 && names[ev.id8] ? `${ev.id8} (${names[ev.id8]})` : (ev.id8 ?? "");
    const window = ev.window ?? "";
    const out =
      ev.outDb != null && Number.isFinite(ev.outDb) ? `${ev.outDb} dB` : "n/a";
    let detail = ev.kind;
    if (ev.kind === "showTeaser") detail = `showTeaser ${ev.reason ?? ""}`.trim();
    if (ev.kind === "narrationEnded") {
      detail = `narrationEnded ${ev.reason ?? ""}`.trim();
    }
    if (ev.kind === "fix") detail = `fix acc=${ev.accM}`;
    if (ev.kind === "cmd") {
      detail = `cmd ${ev.cmdType ?? ""}${ev.sha8 ? ` ${ev.sha8}` : ""}`.trim();
    }
    if (ev.kind === "cmd-fail") {
      detail =
        `cmd-fail ${ev.cmdType ?? ""}${ev.sha8 ? ` ${ev.sha8}` : ""}`.trim();
    }
    if (ev.kind === "handlePlay:start") {
      detail = `handlePlay:start ok=${ev.ok}`;
    }
    if (ev.kind === "resume:start") {
      detail = `resume:start ok=${ev.ok}`;
    }
    if (ev.kind === "remote") detail = `remote:${ev.remoteCmd ?? ""}`;
    if (ev.kind === "scan") detail = `scan hash=${ev.sha8 ?? ""}`;
    if (ev.kind === "start:interrupt-stale") {
      detail = `start:interrupt-stale playedMs=${ev.playedMs}`;
    }
    if (ev.kind === "no-uri") {
      detail = `no-uri ${ev.assetType ?? ""} ${ev.sha8 ?? ""}`.trim();
    }
    if (ev.kind === "applyCommands") {
      detail = `applyCommands ${ev.applyMessage ?? ""}`.trim();
    }
    rows.push(
      [rel, detail, label, window, out].join("\t"),
    );
  }
  return rows;
}

/**
 * @param {ReturnType<typeof summarizeWalk>} summary
 */
export function formatSummary(summary) {
  const lines = [];
  lines.push(`stories played: ${summary.storiesPlayed}`);
  lines.push(`stories completed: ${summary.storiesCompleted}`);
  lines.push(`unlocks: ${summary.unlocks}`);
  lines.push(`interruptions: ${summary.interruptions}`);
  lines.push(`audio busy: ${summary.audioBusy}`);
  const teaserKeys = Object.keys(summary.teasersByReason).sort();
  if (teaserKeys.length === 0) {
    lines.push("teasers: (none)");
  } else {
    lines.push("teasers by reason:");
    for (const k of teaserKeys) {
      lines.push(`  ${k}: ${summary.teasersByReason[k]}`);
    }
  }
  const { n, medianM, maxM } = summary.fixAccuracy;
  lines.push(
    `fix accuracy: n=${n} median=${medianM == null ? "n/a" : `${medianM} m`} max=${maxM == null ? "n/a" : `${maxM} m`}`,
  );
  lines.push(
    `longest silent narration (playing && out < -60 dB): ${summary.longestSilentNarrationMs} ms`,
  );
  return lines.join("\n");
}
