import type { EngineDiagnostics } from "@intell/shared";
import * as FileSystem from "expo-file-system/legacy";
import { Platform, Share } from "react-native";

const LOG_NAME = "audio-spike-log.jsonl";

/** App-specific external files dir — adb-pullable on release (no run-as). */
const ANDROID_EXTERNAL_FILES =
  "file:///sdcard/Android/data/org.replaceplace.intell/files/";

/** Wall time of the previous diagnostics write (for jsTickGapMs). */
let lastDiagWallMs: number | null = null;

function primaryLogUri(): string {
  // documentDirectory is always writable; on release, Share exports it.
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error("documentDirectory unavailable");
  return base + LOG_NAME;
}

function mirrorLogUri(): string | null {
  // Best-effort adb-pullable copy. Expo may refuse this path (smoke showed
  // ERR_UNEXPECTED); Share remains the release export path.
  if (Platform.OS !== "android") return null;
  return ANDROID_EXTERNAL_FILES + LOG_NAME;
}

function logUri(): string {
  return primaryLogUri();
}

/** Absolute path hint for adb pull on release builds. */
export function spikeLogAdbHint(): string {
  return `/sdcard/Android/data/org.replaceplace.intell/files/${LOG_NAME}`;
}

export function resetDiagnosticsTickClock(): void {
  lastDiagWallMs = null;
}

/** Wall ms since the previous diagnostics write, or null if none yet. */
export function msSinceLastDiagnostics(): number | null {
  if (lastDiagWallMs == null) return null;
  return Date.now() - lastDiagWallMs;
}

async function appendLine(uri: string, line: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.writeAsStringAsync(uri, line + "\n", {
      encoding: FileSystem.EncodingType.UTF8,
      append: true,
    });
  } else {
    await FileSystem.writeAsStringAsync(uri, line + "\n", {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }
}

export async function appendSpikeLog(
  entry: Record<string, unknown>,
): Promise<void> {
  const line = JSON.stringify({ ...entry, wallClockMs: Date.now() });
  console.log("[audio-spike-log]", line);
  try {
    await appendLine(primaryLogUri(), line);
  } catch (err) {
    console.warn("[audio-spike] log append failed (external)", err);
  }
  const mirror = mirrorLogUri();
  if (mirror) {
    try {
      await appendLine(mirror, line);
    } catch (err) {
      console.warn("[audio-spike] log append failed (mirror)", err);
    }
  }
}

export async function appendDiagnostics(
  diagnostics: EngineDiagnostics,
  extra?: Record<string, unknown>,
): Promise<void> {
  const now = Date.now();
  const jsTickGapMs =
    lastDiagWallMs == null ? 0 : now - lastDiagWallMs;
  lastDiagWallMs = now;
  await appendSpikeLog({
    type: "diagnostics",
    ...diagnostics,
    jsTickGapMs,
    ...extra,
  });
}

/**
 * Write a full diagnostics line if at least `minGapMs` have passed since the
 * last one (used from voiceEnded while locked, when setInterval is frozen).
 */
export async function appendDiagnosticsIfDue(
  diagnostics: EngineDiagnostics,
  minGapMs = 60_000,
  extra?: Record<string, unknown>,
): Promise<boolean> {
  const gap = msSinceLastDiagnostics();
  if (gap != null && gap < minGapMs) return false;
  await appendDiagnostics(diagnostics, extra);
  return true;
}

export async function shareSpikeLog(): Promise<void> {
  try {
    const uri = logUri();
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      await Share.share({ message: "(no audio-spike-log.jsonl yet)" });
      return;
    }
    const text = await FileSystem.readAsStringAsync(uri);
    await Share.share({
      title: LOG_NAME,
      message: text,
      url: uri,
    });
  } catch (err) {
    console.warn("[audio-spike] share failed", err);
  }
}

export function spikeLogUri(): string | null {
  return FileSystem.documentDirectory
    ? FileSystem.documentDirectory + LOG_NAME
    : null;
}
