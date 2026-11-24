/**
 * Apply AudioDirector commands to the admin WebAudioEngine (A6).
 * Shared AudioEngine has no beacon/suspend methods yet — those are admin-local.
 */
import type { DirectorCommand } from "@intell/shared";
import type { WebAudioEngine } from "../audio/webAudioEngine";

export async function applyDirectorCommands(
  engine: WebAudioEngine,
  commands: readonly DirectorCommand[],
  urlBySha: ReadonlyMap<string, string>,
): Promise<string[]> {
  const warnings: string[] = [];

  for (const cmd of commands) {
    switch (cmd.type) {
      case "suspend":
        engine.suspendHost();
        break;
      case "resume":
        engine.resumeHost();
        break;
      case "load": {
        const uri = urlBySha.get(cmd.sha);
        if (!uri) {
          warnings.push(`missing url for ${cmd.sha.slice(0, 8)}`);
          break;
        }
        const loaded = await engine.tryLoad(cmd.sha, uri);
        if (!loaded.ok) warnings.push(loaded.error);
        break;
      }
      case "unload":
        // Engine LRU handles eviction; no explicit unload API on AudioEngine
        break;
      case "playNarration": {
        const buf = await ensure(engine, cmd.sha, urlBySha, warnings);
        if (!buf) break;
        engine.playNarration(buf, cmd.meta, cmd.startAtMs);
        break;
      }
      case "playOneShot": {
        const buf = await ensure(engine, cmd.sha, urlBySha, warnings);
        if (!buf) break;
        engine.playOneShot(buf, {
          bus: cmd.bus,
          gainDb: cmd.gainDb,
          pan: cmd.pan,
          rate: cmd.rate,
          whenSec: cmd.whenSec,
        });
        break;
      }
      case "playMoment": {
        const buf = await ensure(engine, cmd.sha, urlBySha, warnings);
        if (!buf) break;
        engine.playOneShot(buf, {
          bus: "moment",
          gainDb: cmd.gainDb,
          pan: 0,
          rate: 1,
        });
        break;
      }
      case "startLoopGroup": {
        const stems = [];
        for (const s of cmd.stems) {
          const buf = await ensure(engine, s.sha, urlBySha, warnings);
          if (!buf) continue;
          stems.push({
            h: buf,
            gainDb: s.gainDb,
            loopStartMs: s.loopStartMs,
            loopEndMs: s.loopEndMs,
          });
        }
        if (stems.length > 0) engine.startLoopGroup(cmd.bus, stems);
        break;
      }
      case "crossfadeBed": {
        const buf = await ensure(engine, cmd.toSha, urlBySha, warnings);
        if (!buf) break;
        engine.crossfadeBed(cmd.bus, null, buf, {
          gainDb: cmd.gainDb,
          fadeMs: cmd.fadeMs,
          loopStartMs: cmd.loopStartMs,
          loopEndMs: cmd.loopEndMs,
        });
        break;
      }
      case "setStemGain":
        // Host maps groupId → LoopGroupHandle; Simulator keeps that table
        break;
      case "setBusGain":
        engine.setGain(cmd.bus, cmd.gainDb, cmd.rampMs);
        break;
      case "startBeacon": {
        const buf = await ensure(engine, cmd.sha, urlBySha, warnings);
        if (!buf) break;
        engine.startBeacon(buf, {
          id: cmd.id,
          gainDb: cmd.gainDb,
          pan: cmd.pan,
          lowpassHz: cmd.lowpassHz,
        });
        break;
      }
      case "updateBeacon":
        engine.updateBeacon(cmd.id, {
          gainDb: cmd.gainDb,
          pan: cmd.pan,
          lowpassHz: cmd.lowpassHz,
        });
        break;
      case "stopBeacon":
        engine.stopBeacon(cmd.id, cmd.fadeMs);
        break;
      case "stop":
        engine.stop({ id: cmd.id }, cmd.fadeMs);
        break;
      default:
        break;
    }
  }

  return warnings;
}

async function ensure(
  engine: WebAudioEngine,
  sha: string,
  urlBySha: ReadonlyMap<string, string>,
  warnings: string[],
) {
  const uri = urlBySha.get(sha);
  if (!uri) {
    warnings.push(`missing url for ${sha.slice(0, 8)}`);
    return null;
  }
  const result = await engine.tryLoad(sha, uri);
  if (!result.ok) {
    warnings.push(result.error);
    return null;
  }
  return result.handle;
}
