import { z } from "zod";
import { L10n } from "./l10n.ts";
import { MusicCondition, StemRule } from "./music.ts";

const Uuid = z.string().uuid();
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const TimeWindow = z.enum(["day", "night"]);
const PublishStatus = z.enum([
  "draft",
  "in_review",
  "approved",
  "published",
  "retired",
  "unpublished",
]);

const GeoJsonPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const GeoJsonPoint = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
});

/**
 * published_snapshots.data for entity = 'grove'.
 * Story Notes fields are never included (.strict()).
 */
export const GroveSnapshot = z
  .object({
    id: Uuid,
    regionId: Uuid,
    name: L10n,
    premise: L10n,
    websiteUrl: z.string().nullable().optional(),
    gatheringsUrl: z.string().nullable().optional(),
    allowsSpeakerWildlifeSounds: z.boolean(),
    /** Present on pre-A2 snapshots; ignored after the derived pack boundary. */
    boundary: GeoJsonPolygon.optional(),
    growthCueAssetId: Uuid.nullable().optional(),
    growthCueAssetSha: Sha256.nullable().optional(),
    status: PublishStatus,
    journeys: z
      .object({
        walk: L10n.optional(),
        bike: L10n.optional(),
        transit: L10n.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type GroveSnapshot = z.infer<typeof GroveSnapshot>;

export const FragmentSnapshot = z
  .object({
    id: Uuid,
    groveId: Uuid,
    tier: z.enum(["root", "branch", "leaf"]),
    isEnding: z.boolean(),
    title: L10n,
    teaser: L10n,
    location: GeoJsonPoint,
    visibility: z.enum(["standard", "physical"]),
    triggerRadiusM: z.number().nullable().optional(),
    markerHash: Sha256.nullable().optional(),
    storyOrder: z.number(),
    status: PublishStatus,
    requires: z.array(
      z
        .object({
          id: Uuid.optional(),
          sortOrder: z.number().int(),
          members: z.array(
            z
              .object({
                fragmentId: Uuid,
                sortOrder: z.number().int(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    threadIds: z.array(Uuid),
    characters: z.array(
      z
        .object({
          characterId: Uuid,
          prominence: z.enum(["major", "minor"]),
          introduces: z.boolean(),
          cardLine: L10n,
        })
        .strict(),
    ),
  })
  .strict();

export type FragmentSnapshot = z.infer<typeof FragmentSnapshot>;

export const CharacterSnapshot = z
  .object({
    id: Uuid,
    publicName: L10n,
    publicIntro: L10n,
    portraitImageId: Uuid.nullable().optional(),
    portraitSha: Sha256.nullable().optional(),
    portraitAlt: L10n.nullable().optional(),
    homeGroveId: Uuid.nullable().optional(),
    status: PublishStatus,
  })
  .strict();

export type CharacterSnapshot = z.infer<typeof CharacterSnapshot>;

export const ImageSnapshot = z
  .object({
    id: Uuid,
    sha256: Sha256,
    ext: z.string().min(1),
    bytes: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    altText: L10n,
  })
  .strict();

export type ImageSnapshot = z.infer<typeof ImageSnapshot>;

export const AmbienceLayerSnapshot = z
  .object({
    id: Uuid,
    name: z.string(),
    kind: z.enum(["bed", "oneshot"]),
    timeWindow: TimeWindow,
    wildlifeCall: z.boolean(),
    speakerSafe: z.boolean(),
    assetShas: z.array(Sha256),
    assets: z
      .array(
        z
          .object({
            assetId: Uuid.optional(),
            assetSha: Sha256,
            weight: z.number().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type AmbienceLayerSnapshot = z.infer<typeof AmbienceLayerSnapshot>;

export const AmbienceProfileSnapshot = z
  .object({
    id: Uuid,
    regionId: Uuid.nullable().optional(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    density: z.number(),
    layers: z.array(AmbienceLayerSnapshot),
  })
  .strict();

export type AmbienceProfileSnapshot = z.infer<typeof AmbienceProfileSnapshot>;

export const AmbienceZoneSnapshot = z
  .object({
    id: Uuid,
    regionId: Uuid,
    name: z.string(),
    boundary: GeoJsonPolygon,
    profileId: Uuid,
    profileSlug: z.string().optional(),
    priority: z.number().int(),
    edgeFadeM: z.number(),
    status: PublishStatus,
  })
  .strict();

export type AmbienceZoneSnapshot = z.infer<typeof AmbienceZoneSnapshot>;

export const MusicZoneSnapshot = z
  .object({
    id: Uuid,
    regionId: Uuid,
    name: z.string(),
    boundary: GeoJsonPolygon,
    priority: z.number().int(),
    edgeFadeM: z.number(),
    status: PublishStatus,
  })
  .strict();

export type MusicZoneSnapshot = z.infer<typeof MusicZoneSnapshot>;

export const MusicCueStemSnapshot = z
  .object({
    id: Uuid.optional(),
    assetId: Uuid.optional(),
    assetSha: Sha256,
    role: z.string(),
    gainDb: z.number(),
    stateGains: z.array(StemRule),
    loopStartMs: z.number().int().nullable().optional(),
    loopEndMs: z.number().int().nullable().optional(),
    durationMs: z.number().int().optional(),
    bytes: z.number().int().optional(),
  })
  .strict();

export type MusicCueStemSnapshot = z.infer<typeof MusicCueStemSnapshot>;

export const MusicCueSnapshot = z
  .object({
    id: Uuid,
    name: z.string(),
    musicZoneId: Uuid.nullable().optional(),
    groveId: Uuid.nullable().optional(),
    timeWindow: TimeWindow,
    priority: z.number().int(),
    conditions: MusicCondition,
    minDwellS: z.number(),
    crossfadeMs: z.number().int(),
    status: PublishStatus,
    stems: z.array(MusicCueStemSnapshot),
  })
  .strict();

export type MusicCueSnapshot = z.infer<typeof MusicCueSnapshot>;

export const UiCueSnapshot = z
  .object({
    id: Uuid,
    regionId: Uuid.nullable().optional(),
    key: z.string(),
    language: z.string(),
    assetId: Uuid.optional(),
    assetSha: Sha256,
    status: PublishStatus,
  })
  .strict();

export type UiCueSnapshot = z.infer<typeof UiCueSnapshot>;

/** Map of entity name → zod schema for published_snapshots.data. */
export const SnapshotSchemas = {
  grove: GroveSnapshot,
  fragment: FragmentSnapshot,
  character: CharacterSnapshot,
  image: ImageSnapshot,
  ambience_profile: AmbienceProfileSnapshot,
  ambience_zone: AmbienceZoneSnapshot,
  music_zone: MusicZoneSnapshot,
  music_cue: MusicCueSnapshot,
  ui_cue: UiCueSnapshot,
} as const;

export type SnapshotEntity = keyof typeof SnapshotSchemas;

export type SnapshotData = {
  [K in SnapshotEntity]: z.infer<(typeof SnapshotSchemas)[K]>;
};

export function parseSnapshot<E extends SnapshotEntity>(
  entity: E,
  data: unknown,
): SnapshotData[E] {
  return SnapshotSchemas[entity].parse(data) as SnapshotData[E];
}

export function safeParseSnapshot<E extends SnapshotEntity>(
  entity: E,
  data: unknown,
) {
  return SnapshotSchemas[entity].safeParse(data);
}
