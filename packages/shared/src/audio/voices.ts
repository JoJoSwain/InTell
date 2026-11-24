import {
  VOICE_SLOT_ACCENTS,
  VOICE_SLOT_BEACON,
  VOICE_SLOT_BEDS,
  VOICE_SLOT_MOMENT,
  VOICE_SLOT_NARRATION,
  VOICE_SLOT_SPARE,
  VOICE_SLOT_STEMS,
} from "./soundFeatures";

export type VoiceKind =
  | "narration"
  | "teaser"
  | "stem"
  | "bed"
  | "accent"
  | "beacon"
  | "moment";

export type VoiceRequest = { kind: VoiceKind; id: string };

export type AllocatedVoices = {
  granted: string[];
  denied: string[];
};

/**
 * Allocate within the 12-voice budget. During cue crossfade, accents and
 * beacon are paused (denied).
 */
export function allocateVoices(
  requests: readonly VoiceRequest[],
  crossfading: boolean,
): AllocatedVoices {
  const caps: Record<VoiceKind, number> = {
    narration: VOICE_SLOT_NARRATION,
    teaser: VOICE_SLOT_NARRATION,
    stem: VOICE_SLOT_STEMS,
    bed: VOICE_SLOT_BEDS,
    accent: VOICE_SLOT_ACCENTS,
    beacon: VOICE_SLOT_BEACON,
    moment: VOICE_SLOT_MOMENT,
  };
  const used: Record<VoiceKind, number> = {
    narration: 0,
    teaser: 0,
    stem: 0,
    bed: 0,
    accent: 0,
    beacon: 0,
    moment: 0,
  };
  // narration and teaser share the story slot
  let storyUsed = 0;
  let spare = VOICE_SLOT_SPARE;
  const granted: string[] = [];
  const denied: string[] = [];

  for (const req of requests) {
    if (
      crossfading &&
      (req.kind === "accent" || req.kind === "beacon")
    ) {
      denied.push(req.id);
      continue;
    }
    if (req.kind === "narration" || req.kind === "teaser") {
      if (storyUsed < VOICE_SLOT_NARRATION) {
        storyUsed++;
        granted.push(req.id);
      } else if (spare > 0) {
        spare--;
        granted.push(req.id);
      } else {
        denied.push(req.id);
      }
      continue;
    }
    if (used[req.kind] < caps[req.kind]) {
      used[req.kind]++;
      granted.push(req.id);
    } else if (spare > 0) {
      spare--;
      granted.push(req.id);
    } else {
      denied.push(req.id);
    }
  }
  return { granted, denied };
}
