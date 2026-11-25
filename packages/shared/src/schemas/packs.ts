import { z } from "zod";
import { L10n } from "./l10n";
import {
  musicConditionSchema,
  stemRulePackSchema,
  type PackObjMode,
} from "./music";

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

/** Builders use strict; device parsers strip unknown keys at every object level. */
function packObj<T extends z.ZodRawShape>(shape: T, mode: PackObjMode) {
  const base = z.object(shape);
  return mode === "strict" ? base.strict() : base.strip();
}

function makePackSchemas(mode: PackObjMode) {
  const PackStem = packObj(
    {
      assetSha: Sha256,
      role: z.string(),
      gainDb: z.number(),
      stateGains: z.array(stemRulePackSchema(mode)),
      loopStartMs: z.number().int().nullable().optional(),
      loopEndMs: z.number().int().nullable().optional(),
    },
    mode,
  );

  const PackAsset = packObj(
    {
      sha: Sha256,
      ext: z.string().min(1),
      bytes: z.number().int().positive(),
      kind: AssetKind,
    },
    mode,
  );

  const AmbienceZone = packObj(
    {
      id: Uuid,
      boundary: GeoJsonPolygon,
      profileSlug: z.string(),
      priority: z.number().int(),
      edgeFadeM: z.number(),
    },
    mode,
  );

  const GrovePackFragment = packObj(
    {
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
        packObj(
          {
            characterId: Uuid,
            prominence: z.enum(["major", "minor"]),
            introduces: z.boolean(),
            cardLine: L10n,
          },
          mode,
        ),
      ),
      beaconAssetSha: Sha256.optional(),
      resolveAssetSha: Sha256.optional(),
      teaserLockedAssetSha: Sha256.optional(),
    },
    mode,
  ).superRefine((frag, ctx) => {
    if (frag.visibility === "physical" && frag.radiusM !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "physical fragment must omit radiusM",
        path: ["radiusM"],
      });
    }
  });

  const GrovePack = packObj(
    {
      schema: z.literal(4),
      groveId: Uuid,
      regionId: Uuid,
      packVersion: z.number().int().nonnegative(),
      builtAt: z.string().min(1),
      grove: packObj(
        {
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
          journeys: packObj(
            {
              walk: L10n.optional(),
              bike: L10n.optional(),
              transit: L10n.optional(),
            },
            mode,
          ),
        },
        mode,
      ),
      characters: z.array(
        packObj(
          {
            id: Uuid,
            publicName: L10n,
            publicIntro: L10n,
            portraitSha: Sha256,
            portraitAlt: L10n,
            homeGroveId: Uuid,
          },
          mode,
        ),
      ),
      fragments: z.array(GrovePackFragment),
      crossGroveLinks: z.array(
        packObj(
          {
            fragmentId: Uuid,
            otherFragmentId: Uuid,
            otherGroveId: Uuid,
            direction: z.enum(["requires", "unlocks"]),
            tip: packObj(
              {
                lat: z.number(),
                lng: z.number(),
              },
              mode,
            ),
          },
          mode,
        ),
      ),
      externalPrerequisites: z.array(
        packObj(
          {
            fragmentId: Uuid,
            groveId: Uuid,
            contingencyRevisionNo: z.number().int().positive(),
          },
          mode,
        ),
      ),
      revisions: z.array(
        packObj(
          {
            id: Uuid,
            fragmentId: Uuid,
            revisionNo: z.number().int().positive(),
            changeKind: ChangeKind,
            contingencyRevisionNo: z.number().int().positive(),
            changeTeaser: L10n.optional(),
            versions: z.array(
              packObj(
                {
                  lang: z.string().min(1),
                  timeWindow: TimeWindow,
                  assetSha: Sha256,
                  durationMs: z.number().int().positive(),
                  bytes: z.number().int().positive(),
                  transcript: z.string().min(1),
                  vtt: z.string().optional(),
                  otherTimeHint: L10n.optional(),
                  breathPointsMs: z
                    .array(z.number().int().nonnegative())
                    .optional(),
                  swellCuesMs: z
                    .array(z.number().int().nonnegative())
                    .optional(),
                },
                mode,
              ),
            ),
          },
          mode,
        ),
      ),
      questions: z.array(
        packObj(
          {
            id: Uuid,
            text: L10n,
            anchorFragmentId: Uuid.optional(),
            anchorCharacterId: Uuid.optional(),
            requiresCompleted: z.boolean(),
            opensAt: z.string().nullable().optional(),
            closesAt: z.string().nullable().optional(),
          },
          mode,
        ),
      ),
      music: packObj(
        {
          cues: z.array(
            packObj(
              {
                id: Uuid,
                zone: GeoJsonPolygon.optional(),
                useGroveBoundary: z.boolean(),
                edgeFadeM: z.number().optional(),
                timeWindow: TimeWindow,
                priority: z.number().int(),
                conditions: musicConditionSchema(mode),
                minDwellS: z.number(),
                crossfadeMs: z.number().int(),
                resolveRootAssetSha: Sha256.optional(),
                resolveBranchAssetSha: Sha256.optional(),
                resolveLeafAssetSha: Sha256.optional(),
                stems: z.array(PackStem).max(4),
              },
              mode,
            ).superRefine((cue, ctx) => {
              if (cue.zone && cue.useGroveBoundary) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: "cue cannot have both zone and useGroveBoundary",
                });
              }
            }),
          ),
        },
        mode,
      ),
      soundCues: z
        .array(
          packObj(
            {
              kind: z.enum([
                "beacon_root",
                "beacon_branch",
                "beacon_leaf",
                "threshold_motif_day",
                "threshold_motif_night",
              ]),
              assetSha: Sha256,
            },
            mode,
          ),
        )
        .optional(),
      ambienceZones: z.array(AmbienceZone),
      gatherings: z.array(
        packObj(
          {
            title: L10n,
            startsAt: z.string().datetime({ offset: true }),
            url: z.string(),
          },
          mode,
        ),
      ),
      assets: z.array(PackAsset),
    },
    mode,
  );

  const PreviewManifest = packObj(
    {
      schema: z.literal("preview/1"),
      releaseId: Uuid,
      generatedAt: z.string().min(1),
      expiresAt: z.string().min(1),
      groves: z.array(GrovePack),
      assets: z.array(
        packObj(
          {
            sha: Sha256,
            ext: z.string().min(1),
            url: z.string().min(1),
            expiresAt: z.string().min(1),
          },
          mode,
        ),
      ),
    },
    mode,
  );

  const RegionPack = packObj(
    {
      schema: z.literal(2),
      regionId: Uuid,
      packVersion: z.number().int().nonnegative(),
      builtAt: z.string().min(1),
      timezone: z.string().min(1),
      sunReference: packObj(
        {
          lat: z.number(),
          lng: z.number(),
        },
        mode,
      ),
      ambienceProfiles: z.array(
        packObj(
          {
            id: Uuid,
            slug: z.string(),
            name: z.string(),
            layers: z.array(
              packObj(
                {
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
                },
                mode,
              ),
            ),
            density: z.number().optional(),
          },
          mode,
        ),
      ),
      landcover: packObj(
        {
          gridSha: Sha256,
          h3Resolution: z.number().int(),
          classes: z.array(
            packObj(
              {
                code: z.string(),
                profileSlug: z.string(),
              },
              mode,
            ),
          ),
        },
        mode,
      ).nullable(),
      ambienceZones: z.array(AmbienceZone),
      musicZones: z.array(
        packObj(
          {
            id: Uuid,
            boundary: GeoJsonPolygon,
            edgeFadeM: z.number(),
          },
          mode,
        ),
      ),
      musicCues: z.array(
        packObj(
          {
            id: Uuid,
            zoneId: Uuid.optional(),
            timeWindow: TimeWindow,
            priority: z.number().int(),
            conditions: musicConditionSchema(mode),
            minDwellS: z.number(),
            crossfadeMs: z.number().int(),
            stems: z.array(PackStem),
          },
          mode,
        ),
      ),
      uiCues: z.array(
        packObj(
          {
            key: z.string(),
            language: z.string(),
            assetSha: Sha256,
          },
          mode,
        ),
      ),
      assets: z.array(PackAsset),
    },
    mode,
  );

  return { GrovePackFragment, GrovePack, PreviewManifest, RegionPack };
}

const strictPacks = makePackSchemas("strict");
const devicePacks = makePackSchemas("device");

export const GrovePackFragment = strictPacks.GrovePackFragment;
export type GrovePackFragment = z.infer<typeof GrovePackFragment>;

export const GrovePack = strictPacks.GrovePack;
export type GrovePack = z.infer<typeof GrovePack>;

/**
 * Device parser (DATA_MODEL §12.4 / A5): strips unknown keys at every object
 * level so older builds keep working when packs gain optional fields.
 * Builder tests use GrovePack (strict).
 */
export const GrovePackDevice = devicePacks.GrovePack;
export type GrovePackDevice = z.infer<typeof GrovePackDevice>;

/** Staff preview manifest (DATA_MODEL §12.5 / M3d D3). */
export const PreviewManifest = strictPacks.PreviewManifest;
export type PreviewManifest = z.infer<typeof PreviewManifest>;

/** Device preview parser — groves use GrovePackDevice nesting. */
export const PreviewManifestDevice = devicePacks.PreviewManifest;
export type PreviewManifestDevice = z.infer<typeof PreviewManifestDevice>;

export const RegionPack = strictPacks.RegionPack;
export type RegionPack = z.infer<typeof RegionPack>;

/** Device parser — strips unknown keys at every object level. */
export const RegionPackDevice = devicePacks.RegionPack;
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
