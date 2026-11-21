/**
 * Deep links from checklist / release items to admin routes.
 * Sound entities are omitted until M4 (no authoring UI).
 */

export type StoryEntity =
  | "grove"
  | "fragment"
  | "revision"
  | "character"
  | "image"
  | "audio"
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

export function entityAdminHref(
  entity: StoryEntity,
  entityId: string | undefined | null,
  ctx?: { groveId?: string; fragmentId?: string },
): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "grove":
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
    default:
      return null;
  }
}

export const RELEASE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing…",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};
