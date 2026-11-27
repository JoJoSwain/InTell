/**
 * Apply DirectorCommand list to RNAudioApiEngine (M6 subset).
 * RC7: per-command try/catch so one failure cannot abort playNarration.
 */
import {
  BACK_SKIP_MS,
  type AudioEngine,
  type BufferHandle,
  type DirectorCommand,
  type VoiceHandle,
} from "@intell/shared";
import { pushAudioBreadcrumb } from "../session/audioBreadcrumbs";
import { isM6BlockedCommand } from "./m6World";

export type CommandApplyDeps = {
  engine: AudioEngine & {
    load: (sha: string, uri: string, sampleRate?: number) => Promise<BufferHandle>;
    seekNarration?: (positionMs: number) => void;
    getNarrationPositionMs?: () => number;
  };
  resolveUri: (sha: string) => string | null;
  setNowPlaying?: (title: string) => void;
  onHapticTrigger?: () => void;
  /** Load / playNarration / playMoment failures with a sha. */
  onAssetFailed?: (sha: string) => void | Promise<void>;
};

type VoiceMap = Map<string, VoiceHandle>;

function sha8(sha: string | undefined): string {
  return sha && sha.length > 0 ? sha.slice(0, 8) : "";
}

function breadcrumbApplied(command: DirectorCommand): void {
  switch (command.type) {
    case "load":
      pushAudioBreadcrumb(`cmd load ${sha8(command.sha)}`);
      break;
    case "playNarration":
      pushAudioBreadcrumb(`cmd playNarration ${sha8(command.sha)}`);
      break;
    case "stop":
      pushAudioBreadcrumb(`cmd stop ${command.id.slice(0, 8)}`);
      break;
    case "setBusGain":
      if (command.bus === "story") {
        pushAudioBreadcrumb(`cmd setBusGain story`);
      }
      break;
    default:
      break;
  }
}

function commandSha(command: DirectorCommand): string | undefined {
  if (
    command.type === "load" ||
    command.type === "playNarration" ||
    command.type === "playMoment" ||
    command.type === "playOneShot" ||
    command.type === "unload"
  ) {
    return "sha" in command ? command.sha : undefined;
  }
  return undefined;
}

export async function applyDirectorCommands(
  commands: readonly DirectorCommand[],
  deps: CommandApplyDeps,
  voices: VoiceMap = new Map(),
): Promise<VoiceMap> {
  const next = new Map(voices);

  for (const command of commands) {
    if (isM6BlockedCommand(command)) continue;

    try {
      switch (command.type) {
        case "load": {
          const uri = deps.resolveUri(command.sha);
          if (!uri) {
            pushAudioBreadcrumb(`no-uri load ${sha8(command.sha)}`);
            break;
          }
          try {
            await deps.engine.load(command.sha, uri, command.decodeHz);
          } catch (cause) {
            const err = new Error(`load failed: ${command.sha}`) as Error & {
              sha: string;
            };
            err.sha = command.sha;
            err.cause = cause;
            throw err;
          }
          breadcrumbApplied(command);
          break;
        }
        case "unload":
          // Engine LRU handles eviction; no-op if unsupported.
          break;
        case "setBusGain":
          deps.engine.setGain(command.bus, command.gainDb, command.rampMs);
          breadcrumbApplied(command);
          break;
        case "playNarration": {
          const uri = deps.resolveUri(command.sha);
          if (!uri) {
            pushAudioBreadcrumb(`no-uri playNarration ${sha8(command.sha)}`);
            break;
          }
          const handle = await deps.engine.load(command.sha, uri, 24_000);
          const voice = deps.engine.playNarration(
            handle,
            command.meta,
            command.startAtMs,
          );
          next.set(command.id, voice);
          deps.setNowPlaying?.(command.meta.title);
          deps.onHapticTrigger?.();
          breadcrumbApplied(command);
          break;
        }
        case "playMoment": {
          const uri = deps.resolveUri(command.sha);
          if (!uri) {
            pushAudioBreadcrumb(`no-uri playMoment ${sha8(command.sha)}`);
            break;
          }
          const handle = await deps.engine.load(command.sha, uri);
          const voice = deps.engine.playOneShot(handle, {
            bus: "moment",
            gainDb: command.gainDb,
            pan: 0,
            rate: 1,
          });
          next.set(command.id, voice);
          break;
        }
        case "playOneShot": {
          if (command.bus === "surroundings") break;
          const uri = deps.resolveUri(command.sha);
          if (!uri) {
            pushAudioBreadcrumb(`no-uri playOneShot ${sha8(command.sha)}`);
            break;
          }
          const handle = await deps.engine.load(command.sha, uri);
          const voice = deps.engine.playOneShot(handle, {
            bus: command.bus,
            gainDb: command.gainDb,
            pan: command.pan,
            rate: command.rate,
            whenSec: command.whenSec,
          });
          next.set(command.id, voice);
          break;
        }
        case "stop": {
          const voice = next.get(command.id);
          if (voice) {
            deps.engine.stop(voice, command.fadeMs);
            next.delete(command.id);
          }
          breadcrumbApplied(command);
          break;
        }
        case "suspend":
          // B·S3 focus path usually already fade-suspended; pauseNarration is safe idempotent.
          deps.engine.pauseNarration();
          break;
        case "resume":
          deps.engine.resumeNarration();
          break;
        default:
          break;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "failed";
      const sha = commandSha(command);
      pushAudioBreadcrumb(
        `cmd-fail ${command.type} ${sha8(sha)} ${message}`.trim(),
      );
      if (
        sha &&
        (command.type === "load" ||
          command.type === "playNarration" ||
          command.type === "playMoment")
      ) {
        await deps.onAssetFailed?.(sha);
      }
      // Continue with the next command (RC7).
    }
  }

  return next;
}

/** R5: shared BACK_SKIP_MS. */
export function narrationBackSkipMs(positionMs: number): number {
  return Math.max(0, positionMs - BACK_SKIP_MS);
}
