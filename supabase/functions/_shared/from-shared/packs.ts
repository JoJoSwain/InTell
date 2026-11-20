import { z } from "zod";
import { L10n } from "./l10n.ts";
import { MusicCondition, StemRulePack } from "./music.ts";

const Uuid = z.string().uuid();
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);

const GeoJsonPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

/** Forbidden on any pack fragment. */
const ForbiddenFragmentKeys = z
  .object({
    markerCode: z.never().optional(),
    marker_code: z.never().optional(),
  })
  .passthrough();

export const GrovePackFragment = z
  .object({
    id: Uuid,
    tier: z.enum(["root", "branch", "leaf"]),
    isEnding: z.boolean(),
    requires: z.array(z.array(Uuid)),
    title: L10n,
    visibility: z.enum(["marked", "unmarked", "protected"]),
    storyOrder: z.number().int(),
    gapHint: L10n.nullable().optional(),
    retired: z.boolean(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    radiusM: z.number().optional(),
    markerHash: Sha256.optional(),
    threadIds: z.array(Uuid),
    characterIds: z.array(Uuid),
  })
  .strict()
  .superRefine((frag, ctx) => {
    if (frag.visibility === "protected") {
      if (frag.lat !== undefined || frag.lng !== undefined || frag.radiusM !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "protected fragment must omit lat/lng/radiusM",
        });
      }
    }
  });

export const GrovePack = z
  .object({
    schema: z.literal(1),
    groveId: Uuid,
    packVersion: z.number().int().nonnegative(),
    builtAt: z.string().datetime({ offset: true }),
    grove: z
      .object({
        id: Uuid,
        name: L10n,
        premise: L10n,
        accessNotes: L10n.nullable().optional(),
        boundary: GeoJsonPolygon,
        site: z
          .object({
            name: z.string(),
            accessInfo: L10n.nullable().optional(),
            websiteUrl: z.string().nullable().optional(),
            gatheringsUrl: z.string().nullable().optional(),
          })
          .strict(),
        growthCueAssetSha: Sha256.optional(),
      })
      .strict(),
    rings: z.array(
      z
        .object({
          id: Uuid,
          ringNo: z.number().int(),
          name: L10n,
          themeNote: L10n.nullable().optional(),
          status: z.string(),
          plantingOpensAt: z.string().datetime({ offset: true }).nullable().optional(),
          plantingClosesAt: z.string().datetime({ offset: true }).nullable().optional(),
          releasedAt: z.string().datetime({ offset: true }).nullable().optional(),
          writerNoteSha: Sha256.optional(),
        })
        .strict(),
    ),
    characters: z.array(
      z
        .object({
          id: Uuid,
          publicName: L10n,
          publicBio: L10n.nullable().optional(),
          introducedByFragmentIds: z.array(Uuid),
        })
        .strict(),
    ),
    fragments: z.array(GrovePackFragment),
    revisions: z.array(
      z
        .object({
          id: Uuid,
          fragmentId: Uuid,
          revisionNo: z.number().int(),
          ringId: Uuid,
          publishAt: z.string().datetime({ offset: true }),
          contentNote: L10n.nullable().optional(),
          changeNote: L10n.nullable().optional(),
          versions: z.array(
            z
              .object({
                lang: z.string().min(1),
                assetSha: Sha256,
                durationMs: z.number().int().positive(),
                bytes: z.number().int().positive(),
                transcript: z.string().min(1),
                vtt: z.string().optional(),
              })
              .strict(),
          ),
          credits: z.array(
            z
              .object({
                display: z.string(),
                role: z.string(),
                license: z.string().optional(),
              })
              .strict(),
          ),
          grownFromSeedCount: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    currentRevisionByFragment: z.record(Uuid, Uuid),
    questions: z.array(
      z
        .object({
          id: Uuid,
          ringId: Uuid,
          text: L10n,
          anchorFragmentId: Uuid.optional(),
          anchorCharacterId: Uuid.optional(),
          requiresHeard: z.boolean(),
          opensAt: z.string().datetime({ offset: true }).nullable().optional(),
          closesAt: z.string().datetime({ offset: true }).nullable().optional(),
        })
        .strict(),
    ),
    crossroads: z.array(
      z
        .object({
          id: Uuid,
          ringId: Uuid,
          anchorFragmentId: Uuid,
          prompt: L10n,
          teaserSha: Sha256.optional(),
          voteRadiusM: z.number(),
          opensAt: z.string().datetime({ offset: true }),
          closesAt: z.string().datetime({ offset: true }),
          status: z.string(),
          options: z.array(
            z
              .object({
                id: Uuid,
                label: L10n,
                description: L10n.nullable().optional(),
              })
              .strict(),
          ),
          outcome: z
            .object({
              optionId: Uuid,
              note: L10n.nullable().optional(),
            })
            .strict()
            .optional(),
        })
        .strict()
        .superRefine((c, ctx) => {
          // Forbidden: vote counts before decided
          const extra = c as Record<string, unknown>;
          for (const k of Object.keys(extra)) {
            if (/vote|tally|count/i.test(k) && k !== "voteRadiusM") {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `forbidden crossroads field: ${k}`,
              });
            }
          }
        }),
    ),
    music: z
      .object({
        cues: z.array(
          z
            .object({
              id: Uuid,
              zone: GeoJsonPolygon.optional(),
              useGroveBoundary: z.boolean(),
              priority: z.number().int(),
              conditions: MusicCondition,
              minDwellS: z.number(),
              crossfadeMs: z.number().int(),
              stems: z.array(
                z
                  .object({
                    assetSha: Sha256,
                    role: z.string(),
                    gainDb: z.number(),
                    stateGains: z.array(StemRulePack),
                    loopStartMs: z.number().int().nullable().optional(),
                    loopEndMs: z.number().int().nullable().optional(),
                  })
                  .strict(),
              ),
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
    ambienceZones: z.array(
      z
        .object({
          id: Uuid,
          boundary: GeoJsonPolygon,
          profileSlug: z.string(),
          priority: z.number().int(),
          edgeFadeM: z.number(),
        })
        .strict(),
    ),
    ledger: z.array(
      z
        .object({
          ringId: Uuid,
          growers: z.array(z.string()),
          anonymousCount: z.number().int().nonnegative(),
          seedsPlanted: z.number().int().nonnegative(),
          seedsGrown: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    gatherings: z.array(
      z
        .object({
          title: z.string(),
          startsAt: z.string().datetime({ offset: true }),
          url: z.string(),
        })
        .strict(),
    ),
    assets: z.array(
      z
        .object({
          sha: Sha256,
          ext: z.string().min(1),
          bytes: z.number().int().positive(),
          kind: z.string(),
        })
        .strict(),
    ),
  })
  .strict()
  .and(ForbiddenFragmentKeys.optional());

export type GrovePack = z.infer<typeof GrovePack>;

export const RegionPack = z
  .object({
    schema: z.literal(1),
    regionId: Uuid,
    packVersion: z.number().int().nonnegative(),
    builtAt: z.string().datetime({ offset: true }),
    ambienceProfiles: z.array(
      z
        .object({
          id: Uuid,
          slug: z.string(),
          name: L10n,
          layers: z.array(
            z
              .object({
                id: Uuid,
                kind: z.string(),
                wildlifeCall: z.boolean(),
                speakerSafe: z.boolean(),
                assetShas: z.array(Sha256),
              })
              .strict(),
          ),
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
    ambienceZones: z.array(
      z
        .object({
          id: Uuid,
          boundary: GeoJsonPolygon,
          profileSlug: z.string(),
          priority: z.number().int(),
          edgeFadeM: z.number(),
        })
        .strict(),
    ),
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
          priority: z.number().int(),
          conditions: MusicCondition,
          minDwellS: z.number(),
          crossfadeMs: z.number().int(),
          stems: z.array(
            z
              .object({
                assetSha: Sha256,
                role: z.string(),
                gainDb: z.number(),
                stateGains: z.array(StemRulePack),
                loopStartMs: z.number().int().nullable().optional(),
                loopEndMs: z.number().int().nullable().optional(),
              })
              .strict(),
          ),
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
    assets: z.array(
      z
        .object({
          sha: Sha256,
          ext: z.string().min(1),
          bytes: z.number().int().positive(),
          kind: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export type RegionPack = z.infer<typeof RegionPack>;

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
  })
  .strict();

export type PackIndexEntry = z.infer<typeof PackIndexEntry>;
