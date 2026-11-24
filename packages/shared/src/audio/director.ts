/**
 * AudioDirector — pure reducer that decides what plays (A6 / M7 shared logic).
 *
 * Public API for Lane B M7:
 * - `directorStep(state, input, world) → { state, commands }`
 * - `initialDirectorState`, `parseDirectorState`, `serializeDirectorState`
 * - Types: `DirectorState`, `DirectorInput`, `DirectorCommand`, `DirectorWorld`
 *
 * No clocks, timers, I/O or Math.random inside. Time arrives on every input.
 * Randomness comes from the seeded RNG carried in state.
 */
import { distanceMeters } from "../geo/polygon";
import {
  activeProfiles,
  eligibleLayers,
  nextOneShot,
  pickBed,
  type AmbienceLayerInput,
} from "./ambience";
import { beaconMix, chooseBeacon } from "./beacon";
import { accentAllowed, resumePointMs } from "./breath";
import {
  AFTERGLOW_MS,
  computeDuckingLevels,
  DUCK_ATTACK_MS,
  DUCK_RELEASE_MS,
} from "./DuckingPolicy";
import { depthConditionLatched, insideTierBuffersLatched } from "./depthBloom";
import { diffMix, type TargetMix } from "./directorDiff";
import {
  DIRECTOR_ACCENT_LOOKAHEAD_SEC,
  DIRECTOR_ACCENT_MAX_PENDING,
  type DirectorCommand,
  type DirectorInput,
  type DirectorState,
  type DirectorWorld,
  type PendingAccent,
} from "./directorTypes";
import { hushStepMs, HUSH_CUE_GAIN_DB } from "./hush";
import { localDayKey, lockedTeaserStep } from "./lockedTeaser";
import { mixLevelFor, shedLayers } from "./mixHealth";
import {
  selectMusicCue,
  selectMusicCueDeferred,
  stemGainDb,
  type StoryState,
} from "./music";
import { pickResolve } from "./resolve";
import { createSeededRng, type SeededRng } from "./seededRng";
import { thresholdMotifStep } from "./thresholdMotif";
import { allocateVoices, type VoiceRequest } from "./voices";

export {
  DIRECTOR_ACCENT_LOOKAHEAD_SEC,
  DIRECTOR_ACCENT_MAX_PENDING,
  DIRECTOR_HEARTBEAT_SEC,
  initialDirectorState,
  parseDirectorState,
  serializeDirectorState,
  defaultDirectorSettings,
  emptyStory,
} from "./directorTypes";
export type {
  DirectorCommand,
  DirectorFragment,
  DirectorInput,
  DirectorMusicCue,
  DirectorSessionEffect,
  DirectorSettings,
  DirectorState,
  DirectorWorld,
  PendingAccent,
} from "./directorTypes";
export type { TargetMix } from "./directorDiff";
export { emptyTargetMix, diffMix } from "./directorDiff";

function withClocks(
  state: DirectorState,
  audioSec: number,
  wallAtMs: number,
): DirectorState {
  return { ...state, audioClockSec: audioSec, wallAtMs };
}

function makeRng(state: DirectorState): { rng: SeededRng; used: () => number } {
  const base = createSeededRng(state.rngSeed);
  for (let i = 0; i < state.rngCursor; i++) base();
  let used = 0;
  const rng: SeededRng = () => {
    used += 1;
    return base();
  };
  return { rng, used: () => used };
}

function usableSha(state: DirectorState, sha: string | null | undefined): boolean {
  if (!sha) return false;
  return !state.failedShas.includes(sha);
}

function fillAccentHorizon(
  state: DirectorState,
  world: DirectorWorld,
  layers: { layer: AmbienceLayerInput; weight: number; density: number }[],
  rng: SeededRng,
): { pending: PendingAccent[]; oneshotByLayerId: Record<string, { nextAtSec: number | null }>; lastOneShotAtSec: number | null; accentSeq: number; rngUsedExtra: number } {
  // nextOneShot consumes rng; track via makeRng outside — here we only use passed rng
  let oneshotByLayerId = { ...state.oneshotByLayerId };
  let pending = state.pendingAccents.filter(
    (a) => a.whenSec > state.audioClockSec && usableSha(state, a.sha),
  );
  let lastOneShotAtSec = state.lastOneShotAtSec;
  let accentSeq = state.accentSeq;
  const horizon = state.audioClockSec + DIRECTOR_ACCENT_LOOKAHEAD_SEC;

  // Drop expired
  pending = pending.filter((a) => a.whenSec > state.audioClockSec);

  for (const { layer, weight, density } of layers) {
    if (layer.kind !== "oneshot") continue;
    if (pending.length >= DIRECTOR_ACCENT_MAX_PENDING) break;
    if (!layer.assets.some((a) => usableSha(state, a.sha))) continue;

    let layerState = oneshotByLayerId[layer.id] ?? { nextAtSec: null };
    // Advance nextOneShot until we fill horizon or hit pending cap
    let guard = 0;
    while (pending.length < DIRECTOR_ACCENT_MAX_PENDING && guard < 32) {
      guard += 1;
      const recent = pending
        .filter((p) => p.layerId === layer.id)
        .map((p) => p.sha);
      const result = nextOneShot({
        layer,
        profileWeight: weight,
        density,
        nowSec: state.audioClockSec,
        recentShas: recent,
        concurrent: pending.filter((p) => p.layerId === layer.id).length,
        globalConcurrent: pending.length,
        narrationPlaying: state.narration.playing,
        narrationStartedAtSec: state.narration.startedAtSec,
        narrationEndsAtSec: state.narration.endsAtSec,
        lastOneShotAtSec,
        state: layerState,
        rng,
      });
      layerState = result.state;
      oneshotByLayerId = { ...oneshotByLayerId, [layer.id]: layerState };

      if (!result.shot) {
        // If next is beyond horizon, stop this layer
        if (
          layerState.nextAtSec != null &&
          layerState.nextAtSec > horizon
        ) {
          break;
        }
        // Blocked or just armed — if nextAt is in the past relative to advances,
        // nextOneShot already re-drew; break to avoid spin when always blocked
        if (
          layerState.nextAtSec != null &&
          layerState.nextAtSec > state.audioClockSec &&
          layerState.nextAtSec <= horizon &&
          !result.shot
        ) {
          // Force schedule at nextAtSec by synthesizing when due is in horizon
          // nextOneShot only fires when nowSec >= nextAtSec. Peek-schedule:
          if (layerState.nextAtSec > state.audioClockSec) {
            const peek = nextOneShot({
              layer,
              profileWeight: weight,
              density,
              nowSec: layerState.nextAtSec,
              recentShas: recent,
              concurrent: pending.filter((p) => p.layerId === layer.id).length,
              globalConcurrent: pending.length,
              narrationPlaying: state.narration.playing,
              narrationStartedAtSec: state.narration.startedAtSec,
              narrationEndsAtSec: state.narration.endsAtSec,
              lastOneShotAtSec,
              state: layerState,
              rng,
            });
            oneshotByLayerId = {
              ...oneshotByLayerId,
              [layer.id]: peek.state,
            };
            layerState = peek.state;
            if (peek.shot && usableSha(state, peek.shot.sha)) {
              // Breath-gate at fire time: if narration playing, only keep if
              // we can't know future breath — keep pending; host drops via
              // accentAllowed at whenSec when we rebuild mix.
              accentSeq += 1;
              const id = `accent:${accentSeq}`;
              pending.push({
                id,
                layerId: layer.id,
                sha: peek.shot.sha,
                whenSec: peek.shot.atSec,
                gainDb: peek.shot.gainDb,
                pan: peek.shot.pan,
                rate: peek.shot.rate,
              });
              lastOneShotAtSec = peek.shot.atSec;
              continue;
            }
          }
          break;
        }
        break;
      }

      if (!usableSha(state, result.shot.sha)) continue;
      accentSeq += 1;
      pending.push({
        id: `accent:${accentSeq}`,
        layerId: layer.id,
        sha: result.shot.sha,
        whenSec: result.shot.atSec,
        gainDb: result.shot.gainDb,
        pan: result.shot.pan,
        rate: result.shot.rate,
      });
      lastOneShotAtSec = result.shot.atSec;
    }
  }

  // Cap and horizon trim
  pending = pending
    .filter((a) => a.whenSec <= horizon && a.whenSec > state.audioClockSec)
    .slice(0, DIRECTOR_ACCENT_MAX_PENDING);

  return {
    pending,
    oneshotByLayerId,
    lastOneShotAtSec,
    accentSeq,
    rngUsedExtra: 0,
  };
}

function buildTargetMix(state: DirectorState, world: DirectorWorld): TargetMix {
  const shed = new Set(shedLayers(state.mix));
  const duck = computeDuckingLevels({
    narrationActive: state.narration.playing,
    route: state.settings.route,
    afterglowActive:
      state.afterglowEndsAtMs != null &&
      state.wallAtMs < state.afterglowEndsAtMs,
  });

  const busDb = { ...duck.busDb };
  for (const bus of Object.keys(busDb) as (keyof typeof busDb)[]) {
    busDb[bus] = (busDb[bus] ?? 0) + (state.settings.busGainDb[bus] ?? 0);
  }
  const hushActive =
    state.hush.phase === "fadingOut" ||
    state.hush.phase === "cue" ||
    state.hush.phase === "holding";
  if (hushActive) {
    busDb.music = Number.NEGATIVE_INFINITY;
    busDb.surroundings = Number.NEGATIVE_INFINITY;
  }

  const busRampMs = {
    story: 0,
    music: state.narration.playing ? DUCK_ATTACK_MS : DUCK_RELEASE_MS,
    surroundings: state.narration.playing ? DUCK_ATTACK_MS : DUCK_RELEASE_MS,
    ui: 0,
    moment: state.narration.playing ? DUCK_ATTACK_MS : DUCK_RELEASE_MS,
  };

  // Music
  let music: TargetMix["music"] = null;
  if (!shed.has("music") && state.currentCueId) {
    const cue = world.musicCues.find((c) => c.id === state.currentCueId);
    if (cue) {
      const stems = cue.stems
        .filter((s) => usableSha(state, s.assetSha))
        .map((s, i) => {
          // shed "extra stems" keeps foundation (index 0)
          if (shed.has("extraStems") && i > 0) {
            return {
              sha: s.assetSha,
              gainDb: Number.NEGATIVE_INFINITY,
              loopStartMs: 0,
              loopEndMs: 0,
            };
          }
          return {
            sha: s.assetSha,
            gainDb: stemGainDb(s, state.story),
            loopStartMs: 0,
            loopEndMs: 0,
          };
        });
      music = {
        cueId: cue.id,
        groupId: `music:${cue.id}`,
        stems,
        crossfadeMs: cue.crossfadeMs,
        edgeGain: 1,
      };
    }
  }

  // Beds
  const beds: TargetMix["beds"] = [];
  {
    let bedCount = 0;
    for (const [layerId, bed] of Object.entries(state.bedByLayerId)) {
      if (!usableSha(state, bed.sha)) continue;
      if (shed.has("secondBed") && bedCount >= 1) break;
      beds.push({
        id: `bed:${layerId}`,
        sha: bed.sha,
        gainDb: bed.gainDb,
        fadeMs: bed.fadeMs,
        loopStartMs: 0,
        loopEndMs: 0,
      });
      bedCount += 1;
    }
  }

  // Accents — breath gate when narration playing; shed accents
  let accentsPending: TargetMix["accentsPending"] = [];
  if (!shed.has("accents") && !hushActive) {
    accentsPending = state.pendingAccents
      .filter((a) => usableSha(state, a.sha))
      .filter((a) => {
        if (!state.narration.playing) return true;
        // At schedule time we approximate with current position; drop if not in pause
        return accentAllowed(
          state.narration.positionMs,
          state.narration.breathPointsMs,
        );
      })
      .map((a) => ({
        id: a.id,
        sha: a.sha,
        whenSec: a.whenSec,
        gainDb: a.gainDb,
        pan: a.pan,
        rate: a.rate,
      }));
  }

  // Beacon
  let beacon: TargetMix["beacon"] = null;
  if (
    !shed.has("beacon") &&
    !hushActive &&
    !state.narration.playing &&
    state.currentBeaconId
  ) {
    const frag = world.fragments.find((f) => f.id === state.currentBeaconId);
    const sha =
      (frag?.beaconSha && usableSha(state, frag.beaconSha)
        ? frag.beaconSha
        : null) ??
      (frag
        ? world.groveBeaconByTier[frag.tier]
        : undefined);
    if (frag && sha && usableSha(state, sha)) {
      const mix = beaconMix(
        state.point,
        state.courseDeg,
        { lat: frag.lat, lng: frag.lng },
        state.lastBeaconPan,
      );
      if (Number.isFinite(mix.gainDb)) {
        beacon = {
          id: `beacon:${frag.id}`,
          fragmentId: frag.id,
          sha,
          gainDb: mix.gainDb,
          pan: mix.pan,
          lowpassHz: mix.lowpassHz,
        };
      }
    }
  }

  const narration: TargetMix["narration"] =
    state.narration.playing &&
    state.narration.sha &&
    usableSha(state, state.narration.sha)
      ? {
          id: `narration:${state.narration.fragmentId ?? "x"}`,
          sha: state.narration.sha,
          startAtMs: state.resumePointMs ?? undefined,
          meta: state.narration.meta ?? {
            title: state.narration.fragmentId ?? "Narration",
            artist: "Replaceplace",
          },
        }
      : null;

  let moment: TargetMix["moment"] = null;
  if (state.resolvePlay && usableSha(state, state.resolvePlay.sha)) {
    moment = {
      id: state.resolvePlay.id,
      sha: state.resolvePlay.sha,
      gainDb: -8,
    };
  } else if (state.motifPlay && usableSha(state, state.motifPlay.sha)) {
    moment = {
      id: state.motifPlay.id,
      sha: state.motifPlay.sha,
      gainDb: -8,
    };
  } else if (state.teaserPlay && usableSha(state, state.teaserPlay.sha)) {
    // Teaser on story bus — represented as narration-like; use moment slot only for resolve/motif
    // Locked teasers play on story per AUDIO_SPEC — put on narration path via separate field
  }

  // Teaser as story oneshot via accents-like: encode in moment? Spec: story bus.
  // We emit via narration stop + playOneShot in diff by stuffing hushCue-like:
  // Use a dedicated approach: if teaserPlay, add as accent on story — handle in evaluate after mix.

  const hushCue: TargetMix["hushCue"] =
    state.hushPlayCue && world.hushListenSha && usableSha(state, world.hushListenSha)
      ? {
          sha: world.hushListenSha,
          gainDb: HUSH_CUE_GAIN_DB,
          whenSec: state.audioClockSec,
        }
      : null;

  const desiredLoaded = new Set<string>();
  const decodeHzBySha: Record<string, number> = {};
  const narrHz = world.engineCaps.narrationDecodeHz;

  if (narration) {
    desiredLoaded.add(narration.sha);
    decodeHzBySha[narration.sha] = narrHz;
  }
  if (music) for (const s of music.stems) desiredLoaded.add(s.sha);
  for (const b of beds) desiredLoaded.add(b.sha);
  for (const a of accentsPending) desiredLoaded.add(a.sha);
  if (beacon) desiredLoaded.add(beacon.sha);
  if (moment) desiredLoaded.add(moment.sha);
  if (hushCue) desiredLoaded.add(hushCue.sha);
  if (state.teaserPlay && usableSha(state, state.teaserPlay.sha)) {
    desiredLoaded.add(state.teaserPlay.sha);
  }

  // Prefetch at most one next playable narration (current + next only)
  const playable = world.fragments
    .filter(
      (f) =>
        f.visibility !== "physical" &&
        f.visibility !== "locked" &&
        !state.story.heard.has(f.id) &&
        f.id !== state.narration.fragmentId,
    )
    .map((f) => ({
      ...f,
      d: distanceMeters(state.point, f),
    }))
    .sort((a, b) => a.d - b.d);
  const nearest = playable[0];
  if (nearest?.narrationShaByWindow?.[state.timeWindow]) {
    const sha = nearest.narrationShaByWindow[state.timeWindow]!;
    if (usableSha(state, sha)) {
      desiredLoaded.add(sha);
      decodeHzBySha[sha] = narrHz;
    }
  }

  return {
    busDb,
    busRampMs,
    music,
    beds,
    accentsPending,
    beacon,
    narration,
    moment,
    hushCue,
    desiredLoaded: [...desiredLoaded],
    decodeHzBySha,
    suspended: state.suspended,
  };
}

function applyVoiceBudget(
  mix: TargetMix,
  crossfading: boolean,
): { mix: TargetMix; granted: string[]; denied: string[] } {
  const requests: VoiceRequest[] = [];
  if (mix.narration) requests.push({ kind: "narration", id: mix.narration.id });
  if (mix.music) {
    mix.music.stems.forEach((_, i) => {
      requests.push({ kind: "stem", id: `${mix.music!.groupId}:stem:${i}` });
    });
  }
  for (const bed of mix.beds) requests.push({ kind: "bed", id: bed.id });
  for (const a of mix.accentsPending) requests.push({ kind: "accent", id: a.id });
  if (mix.beacon) requests.push({ kind: "beacon", id: mix.beacon.id });
  if (mix.moment) requests.push({ kind: "moment", id: mix.moment.id });

  const alloc = allocateVoices(requests, crossfading);
  const denied = new Set(alloc.denied);
  const next: TargetMix = {
    ...mix,
    music: mix.music
      ? {
          ...mix.music,
          stems: mix.music.stems.map((s, i) =>
            denied.has(`${mix.music!.groupId}:stem:${i}`)
              ? { ...s, gainDb: Number.NEGATIVE_INFINITY }
              : s,
          ),
        }
      : null,
    beds: mix.beds.filter((b) => !denied.has(b.id)),
    accentsPending: mix.accentsPending.filter((a) => !denied.has(a.id)),
    beacon: mix.beacon && !denied.has(mix.beacon.id) ? mix.beacon : null,
    moment: mix.moment && !denied.has(mix.moment.id) ? mix.moment : null,
    narration:
      mix.narration && !denied.has(mix.narration.id) ? mix.narration : null,
  };
  return { mix: next, granted: alloc.granted, denied: alloc.denied };
}

function evaluateContinuous(
  state: DirectorState,
  world: DirectorWorld,
  rng: SeededRng,
): DirectorState {
  let next = { ...state };

  next.depthBloomInside = depthConditionLatched(
    next.depthBloomInside,
    next.depthM ?? 0,
    world.depthBloomTextureM,
  );
  next.bufferTiers = insideTierBuffersLatched(
    next.bufferTiers,
    next.point,
    world.fragments.map((f) => ({ tier: f.tier, lat: f.lat, lng: f.lng })),
  );

  next.story = {
    ...next.story,
    timeWindow: next.timeWindow,
    narrationPlaying: next.narration.playing,
    depthM: next.depthM,
    insideTierBuffers: next.bufferTiers,
  };

  // Afterglow expiry clears pending growth deferral flag handling
  const afterglowActive =
    next.pendingGrowthCueId != null &&
    next.afterglowEndsAtMs != null &&
    next.wallAtMs < next.afterglowEndsAtMs;
  if (
    next.pendingGrowthCueId &&
    next.afterglowEndsAtMs != null &&
    next.wallAtMs >= next.afterglowEndsAtMs
  ) {
    next.pendingGrowthCueId = null;
    next.afterglowEndsAtMs = null;
  }

  // Music
  const cueResult = selectMusicCueDeferred({
    cues: world.musicCues,
    point: next.point,
    story: next.story,
    current:
      next.currentCueId && next.cueStartedAtMs != null
        ? {
            cueId: next.currentCueId,
            startedAt: new Date(next.cueStartedAtMs),
          }
        : null,
    now: new Date(next.wallAtMs),
    pendingGrowthCueId: afterglowActive ? next.pendingGrowthCueId : null,
    afterglowEndsAt: afterglowActive ? next.afterglowEndsAtMs : null,
    at: next.wallAtMs,
  });
  if (cueResult.cue) {
    if (cueResult.cue.id !== next.currentCueId) {
      // First start is not a crossfade — accents/beacon may play.
      next.crossfading =
        next.currentCueId != null && cueResult.crossfadeMs > 0;
      next.currentCueId = cueResult.cue.id;
      next.cueStartedAtMs = next.wallAtMs;
    } else {
      next.crossfading = false;
    }
  } else {
    next.currentCueId = null;
    next.cueStartedAtMs = null;
    next.crossfading = false;
  }

  // Profiles + beds + accents
  const weights = activeProfiles({
    zones: world.ambienceZones,
    point: next.point,
    landcoverCells: world.landcoverCells,
    classToProfile: world.classToProfile,
  });
  const routeForLayers =
    next.settings.route === "speaker" ? "speaker" : "headphones";
  const hushActive =
    next.hush.phase === "fadingOut" ||
    next.hush.phase === "cue" ||
    next.hush.phase === "holding";

  const oneshotLayers: {
    layer: AmbienceLayerInput;
    weight: number;
    density: number;
  }[] = [];
  const bedByLayerId = { ...next.bedByLayerId };
  const recentBedShas = { ...next.recentBedShas };

  for (const w of weights) {
    const profile = world.ambienceProfiles.find((p) => p.slug === w.profileSlug);
    if (!profile) continue;
    const layers = eligibleLayers({
      profile,
      timeWindow: next.timeWindow,
      month: next.month,
      route: routeForLayers,
      muteAllSurroundingsOnSpeaker: !world.allowsSpeakerWildlife,
      hushActive,
    });
    for (const layer of layers) {
      if (layer.kind === "bed") {
        if (!bedByLayerId[layer.id]) {
          const picked = pickBed({
            layer,
            profileWeight: w.weight,
            recentShas: recentBedShas[layer.id] ?? [],
            rng,
          });
          if (picked && usableSha(next, picked.sha)) {
            bedByLayerId[layer.id] = {
              sha: picked.sha,
              gainDb: picked.gainDb,
              fadeMs: layer.crossfadeMs,
            };
            recentBedShas[layer.id] = [
              ...(recentBedShas[layer.id] ?? []),
              picked.sha,
            ].slice(-4);
          }
        }
      } else {
        oneshotLayers.push({
          layer,
          weight: w.weight,
          density: profile.density,
        });
      }
    }
  }
  // Drop beds whose layers are no longer eligible
  const eligibleBedIds = new Set(
    weights.flatMap((w) => {
      const profile = world.ambienceProfiles.find((p) => p.slug === w.profileSlug);
      if (!profile) return [];
      return eligibleLayers({
        profile,
        timeWindow: next.timeWindow,
        month: next.month,
        route: routeForLayers,
        muteAllSurroundingsOnSpeaker: !world.allowsSpeakerWildlife,
        hushActive,
      })
        .filter((l) => l.kind === "bed")
        .map((l) => l.id);
    }),
  );
  for (const id of Object.keys(bedByLayerId)) {
    if (!eligibleBedIds.has(id)) delete bedByLayerId[id];
  }
  next.bedByLayerId = bedByLayerId;
  next.recentBedShas = recentBedShas;

  // Accents only schedule into breath pauses while narration plays
  if (
    next.narration.playing &&
    !accentAllowed(next.narration.positionMs, next.narration.breathPointsMs)
  ) {
    next.pendingAccents = [];
  } else {
    const filled = fillAccentHorizon(next, world, oneshotLayers, rng);
    next.pendingAccents = filled.pending;
    next.oneshotByLayerId = filled.oneshotByLayerId;
    next.lastOneShotAtSec = filled.lastOneShotAtSec;
    next.accentSeq = filled.accentSeq;
  }

  // Beacon
  const headphones =
    next.settings.route === "headphones" ||
    next.settings.route === "bluetooth";
  const playableUnexplored = world.fragments
    .filter(
      (f) =>
        f.visibility !== "physical" &&
        f.visibility !== "locked" &&
        !next.story.heard.has(f.id),
    )
    .map((f) => ({
      id: f.id,
      tier: f.tier,
      lat: f.lat,
      lng: f.lng,
    }));
  next.currentBeaconId = chooseBeacon({
    listener: next.point,
    playableUnexplored,
    currentId: next.currentBeaconId,
    narrationPlaying: next.narration.playing || hushActive,
    beaconsEnabled: next.settings.beaconsEnabled,
    headphones,
  });
  if (next.currentBeaconId) {
    const frag = world.fragments.find((f) => f.id === next.currentBeaconId);
    if (frag) {
      const mix = beaconMix(
        next.point,
        next.courseDeg,
        { lat: frag.lat, lng: frag.lng },
        next.lastBeaconPan,
      );
      next.lastBeaconPan = mix.pan;
    }
  }

  // Motif tick
  const motif = thresholdMotifStep(next.motif, {
    type: "tick",
    at: next.wallAtMs,
    narrationPlaying: next.narration.playing,
    depthM: next.depthM ?? 0,
  });
  next.motif = motif.state;
  if (motif.playSha && usableSha(next, motif.playSha)) {
    next.motifPlay = { id: `moment:motif:${motif.playSha}`, sha: motif.playSha };
  }

  // Hush
  const hush = hushStepMs({
    state: next.hush,
    settingOn: next.settings.hushOn,
    insideGrove: next.insideGrove,
    narrationPlaying: next.narration.playing,
    queuedFragment: next.queuedFragment,
    lastNarrationEndedAt: next.lastNarrationEndedAtMs,
    now: next.wallAtMs,
    intervalMin: world.hushIntervalMin,
    rng,
    triggerArrived: next.triggerArrived,
  });
  next.hush = {
    phase: hush.phase,
    phaseStartedAt: hush.phaseStartedAt,
    nextHushAt: hush.nextHushAt,
    holdEndsAt: hush.holdEndsAt,
    fadeInMs: hush.fadeInMs,
  };
  next.hushPlayCue = hush.playCue;
  next.triggerArrived = false;

  // Mix health
  next.mix = mixLevelFor(
    {
      clockStarving: next.clockStarving,
      batterySaver: next.settings.batterySaver,
      thermal: next.settings.thermal,
    },
    next.mix,
    next.wallAtMs,
  );

  // Clear one-shot moment after it has been emitted once
  if (
    next.resolvePlay &&
    next.lastEmitted.moment?.id === next.resolvePlay.id
  ) {
    next.resolvePlay = null;
  }
  if (next.motifPlay && next.lastEmitted.moment?.id === next.motifPlay.id) {
    next.motifPlay = null;
  }

  return next;
}

function emit(
  prevEmitted: TargetMix,
  state: DirectorState,
  world: DirectorWorld,
): { state: DirectorState; commands: DirectorCommand[] } {
  let mix = buildTargetMix(state, world);

  // Teaser on story: inject as playOneShot via accents-like temporary field
  // Encode teaser into moment only if no resolve/motif; else append command manually
  const extra: DirectorCommand[] = [];
  let teaserPlay = state.teaserPlay;
  if (
    teaserPlay &&
    usableSha(state, teaserPlay.sha) &&
    !state.suspended
  ) {
    const already =
      prevEmitted.desiredLoaded.includes(teaserPlay.sha) &&
      state.lastEmitted.desiredLoaded.includes(teaserPlay.sha);
    // Fire once when freshly set
    if (!already || state.teaserPlay?.id !== prevEmitted.narration?.id) {
      extra.push({
        type: "playOneShot",
        id: teaserPlay.id,
        sha: teaserPlay.sha,
        bus: "story",
        gainDb: 0,
        pan: 0,
        rate: 1,
        whenSec: state.audioClockSec,
      });
    }
    // Consume so a later showTeaser without a new grant does not re-fire
    teaserPlay = null;
  }

  const budgeted = applyVoiceBudget(mix, state.crossfading);
  mix = budgeted.mix;
  const commands = [...diffMix(prevEmitted, mix), ...extra];
  return {
    state: {
      ...state,
      teaserPlay,
      lastEmitted: mix,
      activeVoiceIds: budgeted.granted,
      loadedShas: mix.desiredLoaded,
    },
    commands,
  };
}

/**
 * Pure AudioDirector step.
 */
export function directorStep(
  state: DirectorState,
  input: DirectorInput,
  world: DirectorWorld,
): { state: DirectorState; commands: DirectorCommand[] } {
  let next = withClocks(state, input.audioSec, input.wallAtMs);
  const { rng, used } = makeRng(next);
  let remountNarration = false;

  switch (input.type) {
    case "heartbeat":
      break;
    case "story":
      next = {
        ...next,
        story: {
          ...input.story,
          heard: new Set(input.story.heard),
          insideTierBuffers: [...input.story.insideTierBuffers],
        },
      };
      break;
    case "location":
      next = {
        ...next,
        point: { ...input.point },
        courseDeg: input.courseDeg,
        depthM: input.depthM,
        month: input.month,
        timeWindow: input.timeWindow,
        insideGrove: input.insideGrove,
      };
      break;
    case "settings":
      next = {
        ...next,
        settings: { ...next.settings, ...input.settings },
      };
      // chimeOn is intentionally a no-op (G7)
      break;
    case "sessionEffect": {
      const effect = input.effect;
      if (effect.type === "play") {
        next.triggerArrived = true;
        const frag = world.fragments.find((f) => f.id === effect.fragmentId);
        const sha =
          effect.sha ??
          frag?.narrationShaByWindow?.[next.timeWindow] ??
          null;
        next.narration = {
          playing: true,
          fragmentId: effect.fragmentId,
          sha,
          startedAtSec: next.audioClockSec,
          endsAtSec:
            effect.durationMs != null
              ? next.audioClockSec + effect.durationMs / 1000
              : null,
          positionMs: effect.startAtMs ?? 0,
          breathPointsMs: effect.breathPointsMs ?? frag?.breathPointsMs ?? [],
          meta: {
            title: effect.title ?? frag?.title ?? effect.fragmentId,
            artist: "Replaceplace",
          },
        };
        next.resumePointMs = effect.startAtMs ?? null;
        const motif = thresholdMotifStep(next.motif, {
          type: "narrationStarted",
          at: next.wallAtMs,
        });
        next.motif = motif.state;
      } else if (effect.type === "stopNarration") {
        next.narration = {
          ...next.narration,
          playing: false,
          sha: null,
          fragmentId: null,
          startedAtSec: null,
          endsAtSec: null,
          meta: null,
        };
        next.lastNarrationEndedAtMs = next.wallAtMs;
      } else if (effect.type === "startAfterglow") {
        next.narration = {
          ...next.narration,
          playing: false,
          sha: null,
          fragmentId: null,
          startedAtSec: null,
          endsAtSec: null,
          meta: null,
        };
        next.afterglowEndsAtMs = effect.endsAt;
        next.lastNarrationEndedAtMs = next.wallAtMs;
        const cue = world.musicCues.find((c) => c.id === next.currentCueId);
        const frag = world.fragments.find((f) => f.id === effect.fragmentId);
        const pick = pickResolve({
          tier: effect.tier,
          cue: {
            resolveRootSha: cue?.resolveRootSha,
            resolveBranchSha: cue?.resolveBranchSha,
            resolveLeafSha: cue?.resolveLeafSha,
          },
          fragmentResolveSha: frag?.resolveSha ?? undefined,
        });
        if (pick.kind === "asset" && usableSha(next, pick.assetSha)) {
          next.resolvePlay = {
            id: `moment:resolve:${effect.fragmentId}`,
            sha: pick.assetSha,
          };
        }
        // Growth deferral: see if heardAll would change cue
        const heard = new Set(next.story.heard);
        heard.add(effect.fragmentId);
        const storyAfter: StoryState = {
          ...next.story,
          heard,
          lastFragmentId: effect.fragmentId,
          lastTier: effect.tier,
          narrationPlaying: false,
        };
        next.story = storyAfter;
        const would = selectMusicCue({
          cues: world.musicCues,
          point: next.point,
          story: storyAfter,
          current: null,
          now: new Date(next.wallAtMs),
        });
        const current = world.musicCues.find((c) => c.id === next.currentCueId);
        // Defer any higher-priority cue change that appeared after this completion
        // (growth steps are heardAll-driven upgrades).
        if (
          would.cue &&
          would.cue.id !== next.currentCueId &&
          (current == null || would.cue.priority > current.priority)
        ) {
          next.pendingGrowthCueId = would.cue.id;
        }
        const motif = thresholdMotifStep(next.motif, {
          type: "narrationEnded",
          at: next.wallAtMs,
        });
        next.motif = motif.state;
        if (motif.playSha && usableSha(next, motif.playSha)) {
          next.motifPlay = {
            id: `moment:motif:${motif.playSha}`,
            sha: motif.playSha,
          };
        }
      } else if (effect.type === "groveEntered") {
        const motif = thresholdMotifStep(next.motif, {
          type: "groveEntered",
          at: next.wallAtMs,
          depthM: next.depthM ?? 0,
          timeWindow: next.timeWindow,
          motifDaySha: world.motifDaySha ?? undefined,
          motifNightSha: world.motifNightSha ?? undefined,
        });
        next.motif = motif.state;
        if (motif.playSha && usableSha(next, motif.playSha)) {
          next.motifPlay = {
            id: `moment:motif:${motif.playSha}`,
            sha: motif.playSha,
          };
        }
      } else if (effect.type === "showTeaser") {
        const frag = world.fragments.find((f) => f.id === effect.fragmentId);
        const dayKey = localDayKey(new Date(next.wallAtMs), world.timeZone);
        const teaser = lockedTeaserStep(next.teaser, {
          at: next.wallAtMs,
          dayKey,
          reason: effect.reason,
          fragmentId: effect.fragmentId,
          teaserSha: frag?.teaserLockedSha ?? undefined,
          narrationPlaying: next.narration.playing,
        });
        next.teaser = teaser.state;
        if (teaser.playSha && usableSha(next, teaser.playSha)) {
          next.teaserPlay = {
            id: `teaser:${effect.fragmentId}`,
            sha: teaser.playSha,
          };
        }
      } else if (effect.type === "sessionEnded") {
        next.narration = {
          playing: false,
          fragmentId: null,
          sha: null,
          startedAtSec: null,
          endsAtSec: null,
          positionMs: 0,
          breathPointsMs: [],
          meta: null,
        };
        next.currentBeaconId = null;
        next.pendingAccents = [];
        next.afterglowEndsAtMs = null;
        next.pendingGrowthCueId = null;
      }
      break;
    }
    case "voiceEnded":
      next.activeVoiceIds = next.activeVoiceIds.filter(
        (id) => id !== input.voiceId,
      );
      if (input.kind === "moment") {
        if (next.resolvePlay?.id === input.voiceId) next.resolvePlay = null;
        if (next.motifPlay?.id === input.voiceId) next.motifPlay = null;
      }
      if (input.kind === "accent") {
        next.pendingAccents = next.pendingAccents.filter(
          (a) => a.id !== input.voiceId,
        );
      }
      if (next.teaserPlay?.id === input.voiceId) next.teaserPlay = null;
      next.crossfading = false;
      break;
    case "narrationProgress":
      next.narration = {
        ...next.narration,
        positionMs: input.positionMs,
        endsAtSec:
          next.narration.startedAtSec != null
            ? next.narration.startedAtSec + input.durationMs / 1000
            : next.narration.endsAtSec,
      };
      break;
    case "interruption":
      if (input.phase === "began") {
        next.suspended = true;
        if (next.narration.playing) {
          next.resumePointMs = resumePointMs(
            next.narration.breathPointsMs,
            next.narration.positionMs,
          );
        }
      } else if (input.shouldResume === true) {
        next.suspended = false;
        // Force remount so diff emits playNarration at resumePointMs
        if (next.narration.playing && next.narration.sha) {
          remountNarration = true;
        }
      }
      // unpaired ended → nothing (gap in react-native-audio-api)
      break;
    case "health":
      next = { ...next, clockStarving: input.clockStarving };
      break;
    case "assetFailed":
      if (!next.failedShas.includes(input.sha)) {
        next.failedShas = [...next.failedShas, input.sha];
      }
      // Drop layers using that sha
      if (next.narration.sha === input.sha) {
        next.narration = {
          ...next.narration,
          playing: false,
          sha: null,
        };
      }
      next.pendingAccents = next.pendingAccents.filter(
        (a) => a.sha !== input.sha,
      );
      for (const [id, bed] of Object.entries(next.bedByLayerId)) {
        if (bed.sha === input.sha) delete next.bedByLayerId[id];
      }
      if (next.resolvePlay?.sha === input.sha) next.resolvePlay = null;
      if (next.motifPlay?.sha === input.sha) next.motifPlay = null;
      if (next.teaserPlay?.sha === input.sha) next.teaserPlay = null;
      break;
    default:
      break;
  }

  next = evaluateContinuous(next, world, rng);
  next = { ...next, rngCursor: next.rngCursor + used() };

  const prevEmitted = remountNarration
    ? { ...state.lastEmitted, narration: null }
    : state.lastEmitted;
  return emit(prevEmitted, next, world);
}

/** @deprecated import AFTERGLOW_MS from DuckingPolicy — re-export for tests */
export { AFTERGLOW_MS };
