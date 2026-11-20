import type { EngineDiagnostics } from "@intell/shared";
import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";

const LOG_NAME = "audio-spike-log.jsonl";

/** Wall time of the previous diagnostics write (for jsTickGapMs). */
let lastDiagWallMs: number | null = null;

function logUri(): string {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error("documentDirectory unavailable");
  return base + LOG_NAME;
}

export function resetDiagnosticsTickClock(): void {
  lastDiagWallMs = null;
}

export async function appendSpikeLog(
  entry: Record<string, unknown>,
): Promise<void> {
  const line = JSON.stringify({ ...entry, wallClockMs: Date.now() });
  console.log("[audio-spike-log]", line);
  try {
    const uri = logUri();
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
  } catch (err) {
    console.warn("[audio-spike] log append failed", err);
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
