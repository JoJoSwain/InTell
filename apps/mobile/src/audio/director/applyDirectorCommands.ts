/**
 * Apply DirectorCommand list to RNAudioApiEngine (M6 subset).
 */
import {
  BACK_SKIP_MS,
  type AudioEngine,
  type BufferHandle,
  type DirectorCommand,
  type VoiceHandle,
} from "@intell/shared";
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
};

type VoiceMap = Map<string, VoiceHandle>;

export async function applyDirectorCommands(
  commands: readonly DirectorCommand[],
  deps: CommandApplyDeps,
  voices: VoiceMap = new Map(),
): Promise<VoiceMap> {
  const next = new Map(voices);

  for (const command of commands) {
    if (isM6BlockedCommand(command)) continue;

    switch (command.type) {
      case "load": {
        const uri = deps.resolveUri(command.sha);
        if (!uri) break;
        await deps.engine.load(command.sha, uri, command.decodeHz);
        break;
      }
      case "unload":
        // Engine LRU handles eviction; no-op if unsupported.
        break;
      case "setBusGain":
        deps.engine.setGain(command.bus, command.gainDb, command.rampMs);
        break;
      case "playNarration": {
        const uri = deps.resolveUri(command.sha);
        if (!uri) break;
        const handle = await deps.engine.load(command.sha, uri, 24_000);
        const voice = deps.engine.playNarration(handle, command.meta, command.startAtMs);
        next.set(command.id, voice);
        deps.setNowPlaying?.(command.meta.title);
        deps.onHapticTrigger?.();
        break;
      }
      case "playMoment": {
        const uri = deps.resolveUri(command.sha);
        if (!uri) break;
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
        if (!uri) break;
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
        break;
      }
      case "suspend":
        deps.engine.pauseNarration();
        break;
      case "resume":
        deps.engine.resumeNarration();
        break;
      default:
        break;
    }
  }

  return next;
}

/** R5: shared BACK_SKIP_MS. */
export function narrationBackSkipMs(positionMs: number): number {
  return Math.max(0, positionMs - BACK_SKIP_MS);
}
