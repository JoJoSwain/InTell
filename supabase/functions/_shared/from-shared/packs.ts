import { z } from "zod";
import { L10n } from "./l10n.ts";
import { MusicCondition, StemRulePack } from "./music.ts";

const Uuid = z.string().uuid();
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);

const TimeWindow = z.enum(["day", "night"]);
const ChangeKind = z.enum(["contingency", "correction"]);
const AssetKind = z.enum([
  "narration",
  "sfx_oneshot",
  "sfx_bed",
  "music_stem",
  "music_moment",
  "beacon",
  "voice_cue",
  "growth_cue",
  "image",
]);

const GeoJsonPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const GeoJsonMultiPolygon = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))),
});

const PackStem = z
  .object({
    assetSha: Sha256,
    role: z.string(),
    gainDb: z.number(),
    stateGains: z.array(StemRulePack),
    loopStartMs: z.number().int().nullable().optional(),
    loopEndMs: z.number().int().nullable().optional(),
  })
  .strict();

const PackAsset = z
  .object({
    sha: Sha256,
    ext: z.string().min(1),
    bytes: z.number().int().positive(),
    kind: AssetKind,
  })
  .strict();

const AmbienceZone = z
  .object({
    id: Uuid,
    boundary: GeoJsonPolygon,
    profileSlug: z.string(),
    priority: z.number().int(),
    edgeFadeM: z.number(),
  })
  .strict();

export const GrovePackFragment = z
  .object({
    id: Uuid,
    tier: z.enum(["root", "branch", "leaf"]),
    isEnding: z.boolean(),
    requires: z.array(z.array(Uuid)),
    title: L10n,
    teaser: L10n,
    visibility: z.enum(["standard", "physical"]),
    storyOrder: z.number(),
    retired: z.boolean(),
    lat: z.number(),
    lng: z.number(),
    radiusM: z.number().optional(),
    markerHash: Sha256.optional(),
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
    beaconAssetSha: Sha256.optional(),
    resolveAssetSha: Sha256.optional(),
    teaserLockedAssetSha: Sha256.optional(),
  })
  .strict()
  .superRefine((frag, ctx) => {
    if (frag.visibility === "physical" && frag.radiusM !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "physical fragment must omit radiusM",
        path: ["radiusM"],
      });
    }
  });

export const GrovePack = z
  .object({
    schema: z.literal(4),
    groveId: Uuid,
    regionId: Uuid,
    packVersion: z.number().int().nonnegative(),
    builtAt: z.string().min(1),
    grove: z
      .object({
        id: Uuid,
        name: L10n,
        premise: L10n,
        websiteUrl: z.string().nullable().optional(),
        gatheringsUrl: z.string().nullable().optional(),
        boundary: GeoJsonMultiPolygon,
        allowsSpeakerWildlifeSounds: z.boolean(),
        growthCueAssetSha: Sha256.optional(),
        depthBloomTextureM: z.number().positive().optional(),
        openingFragmentId: Uuid,
        journeys: z
          .object({
            walk: L10n.optional(),
            bike: L10n.optional(),
            transit: L10n.optional(),
          })
          .strict(),
      })
      .strict(),
    characters: z.array(
      z
        .object({
          id: Uuid,
          publicName: L10n,
          publicIntro: L10n,
          portraitSha: Sha256,
          portraitAlt: L10n,
          homeGroveId: Uuid,
        })
        .strict(),
    ),
    fragments: z.array(GrovePackFragment),
    crossGroveLinks: z.array(
      z
        .object({
          fragmentId: Uuid,
          otherFragmentId: Uuid,
          otherGroveId: Uuid,
          direction: z.enum(["requires", "unlocks"]),
          tip: z
            .object({
              lat: z.number(),
              lng: z.number(),
            })
            .strict(),
        })
        .strict(),
    ),
    externalPrerequisites: z.array(
      z
        .object({
          fragmentId: Uuid,
          groveId: Uuid,
          contingencyRevisionNo: z.number().int().positive(),
        })
        .strict(),
    ),
    revisions: z.array(
      z
        .object({
          id: Uuid,
          fragmentId: Uuid,
          revisionNo: z.number().int().positive(),
          changeKind: ChangeKind,
          contingencyRevisionNo: z.number().int().positive(),
          changeTeaser: L10n.optional(),
          versions: z.array(
            z
              .object({
                lang: z.string().min(1),
                timeWindow: TimeWindow,
                assetSha: Sha256,
                durationMs: z.number().int().positive(),
                bytes: z.number().int().positive(),
                transcript: z.string().min(1),
                vtt: z.string().optional(),
                otherTimeHint: L10n.optional(),
                breathPointsMs: z.array(z.number().int().nonnegative()).optional(),
                swellCuesMs: z.array(z.number().int().nonnegative()).optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    questions: z.array(
      z
        .object({
          id: Uuid,
          text: L10n,
          anchorFragmentId: Uuid.optional(),
          anchorCharacterId: Uuid.optional(),
          requiresCompleted: z.boolean(),
          opensAt: z.string().nullable().optional(),
          closesAt: z.string().nullable().optional(),
        })
        .strict(),
    ),
    music: z
      .object({
        cues: z.array(
          z
            .object({
              id: Uuid,
              zone: GeoJsonPolygon.optional(),
              useGroveBoundary: z.boolean(),
              edgeFadeM: z.number().optional(),
              timeWindow: TimeWindow,
              priority: z.number().int(),
              conditions: MusicCondition,
              minDwellS: z.number(),
              crossfadeMs: z.number().int(),
              resolveRootAssetSha: Sha256.optional(),
              resolveBranchAssetSha: Sha256.optional(),
              resolveLeafAssetSha: Sha256.optional(),
              stems: z.array(PackStem).max(4),
            })
            .strict()
            .superRefine((cue, ctx) => {
              if (cue.zone && cue.useGroveBoundary) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "cue cannot have both zone and useGroveBoundary",
                });
              }
            }),
        ),
      })
      .strict(),
    soundCues: z
      .array(
        z
          .object({
            kind: z.enum([
              "beacon_root",
              "beacon_branch",
              "beacon_leaf",
              "threshold_motif_day",
              "threshold_motif_night",
            ]),
            assetSha: Sha256,
          })
          .strict(),
      )
      .optional(),
    ambienceZones: z.array(AmbienceZone),
    gatherings: z.array(
      z
        .object({
          title: L10n,
          startsAt: z.string().datetime({ offset: true }),
          url: z.string(),
        })
        .strict(),
    ),
    assets: z.array(PackAsset),
  })
  .strict();

export type GrovePack = z.infer<typeof GrovePack>;

/**
 * Device parser (DATA_MODEL §12.4 / A5): strips unknown keys so older builds
 * keep working when packs gain optional fields. Builder tests use GrovePack
 * (strict). Lane B should import these in apps/mobile (M6 checklist).
 */
export const GrovePackDevice = GrovePack.strip();
export type GrovePackDevice = z.infer<typeof GrovePackDevice>;

/** Staff preview manifest (DATA_MODEL §12.5 / M3d D3). */
export const PreviewManifest = z
  .object({
    schema: z.literal("preview/1"),
    releaseId: Uuid,
    generatedAt: z.string().min(1),
    expiresAt: z.string().min(1),
    groves: z.array(GrovePack),
    assets: z.array(
      z
        .object({
          sha: Sha256,
          ext: z.string().min(1),
          url: z.string().min(1),
          expiresAt: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict();

export type PreviewManifest = z.infer<typeof PreviewManifest>;

export const RegionPack = z
  .object({
    schema: z.literal(2),
    regionId: Uuid,
    packVersion: z.number().int().nonnegative(),
    builtAt: z.string().min(1),
    timezone: z.string().min(1),
    sunReference: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .strict(),
    ambienceProfiles: z.array(
      z
        .object({
          id: Uuid,
          slug: z.string(),
          name: z.string(),
          layers: z.array(
            z
              .object({
                id: Uuid,
                name: z.string(),
                kind: z.string(),
                timeWindow: TimeWindow,
                wildlifeCall: z.boolean(),
                speakerSafe: z.boolean(),
                assetShas: z.array(Sha256),
                months: z.array(z.number().int()).optional(),
                nestingMuteMonths: z.array(z.number().int()).optional(),
                gainDbMin: z.number().optional(),
                gainDbMax: z.number().optional(),
                panMin: z.number().optional(),
                panMax: z.number().optional(),
                pitchCentsMin: z.number().int().optional(),
                pitchCentsMax: z.number().int().optional(),
                meanIntervalS: z.number().optional(),
                minIntervalS: z.number().optional(),
                maxConcurrent: z.number().int().optional(),
                noRepeatLast: z.number().int().optional(),
                crossfadeMs: z.number().int().optional(),
                assetWeights: z.array(z.number()).optional(),
              })
              .strict(),
          ),
          density: z.number().optional(),
        })
        .strict(),
    ),
    landcover: z
      .object({
        gridSha: Sha256,
        h3Resolution: z.number().int(),
        classes: z.array(
          z
            .object({
              code: z.string(),
              profileSlug: z.string(),
            })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    ambienceZones: z.array(AmbienceZone),
    musicZones: z.array(
      z
        .object({
          id: Uuid,
          boundary: GeoJsonPolygon,
          edgeFadeM: z.number(),
        })
        .strict(),
    ),
    musicCues: z.array(
      z
        .object({
          id: Uuid,
          zoneId: Uuid.optional(),
          timeWindow: TimeWindow,
          priority: z.number().int(),
          conditions: MusicCondition,
          minDwellS: z.number(),
          crossfadeMs: z.number().int(),
          stems: z.array(PackStem),
        })
        .strict(),
    ),
    uiCues: z.array(
      z
        .object({
          key: z.string(),
          language: z.string(),
          assetSha: Sha256,
        })
        .strict(),
    ),
    assets: z.array(PackAsset),
  })
  .strict();

export type RegionPack = z.infer<typeof RegionPack>;

/** Device parser — strips unknown keys (DATA_MODEL §12.4 / A5). */
export const RegionPackDevice = RegionPack.strip();
export type RegionPackDevice = z.infer<typeof RegionPackDevice>;

export const PackIndexEntry = z
  .object({
    scope: z.enum(["grove", "region"]),
    id: Uuid,
    version: z.number().int().nonnegative(),
    manifestPath: z.string(),
    manifestSha256: Sha256,
    bytesTotal: z.number().int().nonnegative(),
    name: L10n,
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    opening: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PackIndexEntry = z.infer<typeof PackIndexEntry>;
