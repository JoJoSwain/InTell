/**
 * M6 director world: narration + moments only (plan G4).
 * M7 flips M6_LAYERS on and fills music / ambience / hush / beacons.
 */
import {
  defaultDirectorSettings,
  type DirectorCommand,
  type DirectorFragment,
  type DirectorSettings,
  type DirectorWorld,
  type TimeWindow,
} from "@intell/shared";
import type { FragmentPackMeta, PackedSession } from "../../session/sessionWorld";

/** Documented gate — M7 sets these true and supplies pack data. */
export const M6_LAYERS = {
  surroundings: false,
  music: false,
  beacons: false,
  hush: false,
} as const;

export function m6DirectorSettings(
  route: DirectorSettings["route"] = "headphones",
): DirectorSettings {
  return {
    ...defaultDirectorSettings(route),
    hushOn: M6_LAYERS.hush,
    beaconsEnabled: M6_LAYERS.beacons,
    chimeOn: false,
  };
}

export function directorFragmentsFromMeta(
  meta: Record<string, FragmentPackMeta>,
  fragments: PackedSession["world"]["fragments"],
): DirectorFragment[] {
  return fragments.map((f) => {
    const m = meta[f.id];
    const narrationShaByWindow: Partial<Record<TimeWindow, string>> = {};
    if (m) {
      for (const [window, asset] of Object.entries(m.narrationByWindow) as [
        TimeWindow,
        { sha: string },
      ][]) {
        narrationShaByWindow[window] = asset.sha;
      }
    }
    return {
      id: f.id,
      lat: f.lat,
      lng: f.lng,
      radiusM: f.radiusM ?? 0,
      tier: f.tier,
      visibility: f.visibility === "physical" ? "physical" : "standard",
      title: m?.narrationByWindow.day?.title ?? m?.narrationByWindow.night?.title ?? "",
      beaconSha: M6_LAYERS.beacons ? m?.beaconSha : null,
      teaserLockedSha: m?.teaserLockedSha ?? null,
      resolveSha: m?.resolveSha ?? null,
      breathPointsMs: m?.narrationByWindow.day?.breathPointsMs ?? m?.narrationByWindow.night?.breathPointsMs,
      narrationShaByWindow,
    };
  });
}

export function buildM6DirectorWorld(
  packed: PackedSession,
  groveId: string,
): DirectorWorld {
  return {
    groveId,
    timeZone: packed.timeZone ?? "UTC",
    allowsSpeakerWildlife: packed.allowsSpeakerWildlife,
    hushIntervalMin: 20,
    depthBloomTextureM: packed.depthBloomTextureM,
    fragments: directorFragmentsFromMeta(packed.meta, packed.world.fragments),
    // G4: empty music / ambience — no commands on those buses
    musicCues: [],
    ambienceZones: [],
    ambienceProfiles: [],
    classToProfile: new Map(),
    landcoverCells: [],
    motifDaySha: packed.motifDaySha,
    motifNightSha: packed.motifNightSha,
    groveBeaconByTier: {},
    hushListenSha: null,
    engineCaps: { canStreamBeds: false, narrationDecodeHz: 24_000 },
  };
}

/**
 * Drop music / surroundings / beacon commands in M6.
 * Locked teasers use playOneShot on the story bus — those stay.
 */
export function isM6BlockedCommand(command: DirectorCommand): boolean {
  if (!M6_LAYERS.music && (command.type === "startLoopGroup" || command.type === "setStemGain")) {
    return true;
  }
  if (!M6_LAYERS.surroundings) {
    if (command.type === "crossfadeBed") return true;
    if (command.type === "playOneShot" && command.bus === "surroundings") return true;
  }
  if (
    !M6_LAYERS.beacons &&
    (command.type === "startBeacon" ||
      command.type === "updateBeacon" ||
      command.type === "stopBeacon")
  ) {
    return true;
  }
  return false;
}
