/**
 * Deep links from checklist / release items to admin routes.
 */

export type StoryEntity =
  | "grove"
  | "fragment"
  | "revision"
  | "character"
  | "image"
  | "audio"
  | "audio_asset"
  | "ambience_profile"
  | "ambience_layer"
  | "ambience_zone"
  | "music_zone"
  | "music_cue"
  | string;

/** Release item entity types shown in M3d UI (sound types hidden until M4). */
export const RELEASE_ITEM_ENTITIES = [
  "revision",
  "grove",
  "fragment",
  "character",
  "image",
] as const;

export type ReleaseItemEntity = (typeof RELEASE_ITEM_ENTITIES)[number];

export type EntityHrefContext = {
  groveId?: string;
  fragmentId?: string;
  characterId?: string;
  profileId?: string;
};

/** A5 publish-check codes surfaced on release detail. */
export const A5_PUBLISH_CHECK_CODES = [
  "STEMS_OVER_MAX",
  "RESOLVE_MISSING",
  "RESOLVE_DURATION",
  "BED_MONO",
  "BED_LONG",
  "REGION_AMBIENCE_BUDGET",
  "TRANSIENT",
  "NARRATION_STEREO",
  "AUDIO_FORMAT",
  "GROWTH_STEPS_OVER_MAX",
] as const;

export function entityAdminHref(
  entity: StoryEntity,
  entityId: string | undefined | null,
  ctx?: EntityHrefContext,
): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "grove":
      // NO_ROOT deep-links to the grove's fragments list
      return `/story/groves/${entityId}`;
    case "fragment":
      return ctx?.groveId
        ? `/story/groves/${ctx.groveId}?fragment=${entityId}`
        : `/story/groves`;
    case "revision":
      if (ctx?.groveId && ctx?.fragmentId) {
        return `/story/groves/${ctx.groveId}/fragments/${ctx.fragmentId}/revisions/${entityId}`;
      }
      return null;
    case "character":
      return `/story/characters/${entityId}`;
    case "image":
      return `/media/images/${entityId}`;
    case "audio":
    case "audio_asset":
      return `/media/audio/${entityId}`;
    case "ambience_profile":
      return `/sound/profiles/${entityId}`;
    case "ambience_layer": {
      const profileId = ctx?.profileId;
      return profileId
        ? `/sound/profiles/${profileId}/layers/${entityId}`
        : `/sound/profiles`;
    }
    case "ambience_zone":
    case "music_zone":
      return "/sound/zones";
    case "music_cue":
      return `/sound/music/cues/${entityId}`;
    default:
      return null;
  }
}

/** Build href context from a checklist failure that may carry G3 keys. */
export function hrefContextFromFailure(f: {
  grove_id?: string;
  fragment_id?: string;
  character_id?: string;
  entity?: string;
  entity_id?: string;
}): EntityHrefContext {
  return {
    groveId: f.grove_id,
    fragmentId: f.fragment_id,
    characterId: f.character_id ?? (f.entity === "character" ? f.entity_id : undefined),
  };
}

export const RELEASE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing…",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};
