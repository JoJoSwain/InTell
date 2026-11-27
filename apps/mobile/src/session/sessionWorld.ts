/**
 * Build SessionWorld + play enrichment from installed Device packs.
 */
import {
  GrovePackDevice,
  RegionPackDevice,
  currentTimeWindow,
  pickL10n,
  type CompletionRow,
  type ExternalPrerequisite,
  type FragmentInput,
  type SessionWorld,
  type TimeWindow,
  type UnlockRow,
} from "@intell/shared";
import type { PackRow } from "../db/repos";
import type { ExploringSettings } from "./settingsKeys";

export type NarrationAsset = {
  sha: string;
  durationMs: number;
  breathPointsMs: number[];
  title: string;
  otherTimeHint?: string;
};

export type FragmentPackMeta = {
  teaser: string;
  changeTeaser?: string;
  characterIds: string[];
  revisionNo: number;
  /** Day/Night narration assets for the current revision. */
  narrationByWindow: Partial<Record<TimeWindow, NarrationAsset>>;
  resolveSha?: string;
  teaserLockedSha?: string;
  beaconSha?: string;
};

export type PackedSession = {
  world: SessionWorld;
  meta: Record<string, FragmentPackMeta>;
  markers: Record<string, string>;
  motifDaySha: string | null;
  motifNightSha: string | null;
  allowsSpeakerWildlife: boolean;
  depthBloomTextureM: number;
  timeZone: string | null;
  sunReference: { lat: number; lng: number } | null;
  assetUris: Record<string, string>;
};

type GrovePackParsed = ReturnType<typeof GrovePackDevice.parse>;

function currentRevision(fragmentId: string, revisions: GrovePackParsed["revisions"]) {
  const forFrag = revisions.filter((r) => r.fragmentId === fragmentId);
  if (forFrag.length === 0) return undefined;
  return forFrag.reduce((a, b) => (a.revisionNo >= b.revisionNo ? a : b));
}

function toInput(
  groveId: string,
  fragment: GrovePackParsed["fragments"][number],
  revisions: GrovePackParsed["revisions"],
): FragmentInput {
  const revision = currentRevision(fragment.id, revisions);
  return {
    id: fragment.id,
    groveId,
    tier: fragment.tier,
    visibility: fragment.visibility,
    retired: fragment.retired,
    lat: fragment.lat,
    lng: fragment.lng,
    ...(fragment.radiusM === undefined ? {} : { radiusM: fragment.radiusM }),
    requires: fragment.requires,
    threadIds: fragment.threadIds,
    contingencyRevisionNo: revision?.contingencyRevisionNo ?? 1,
    versions: (revision?.versions ?? []).map((version) => ({
      lang: version.lang,
      timeWindow: version.timeWindow,
    })),
  };
}

export function buildPackedSession(args: {
  packs: PackRow[];
  completions: CompletionRow[];
  unlocks: UnlockRow[];
  settings: ExploringSettings;
  lang?: string;
  at?: Date;
  /** sha → local file uri from assets table */
  assetUris?: Record<string, string>;
}): PackedSession {
  const lang = args.lang ?? "en";
  const at = args.at ?? new Date();
  let sunReference: { lat: number; lng: number } | null = null;
  let timeZone: string | null = null;
  const groves: { id: string; boundary: SessionWorld["groves"][number]["boundary"] }[] = [];
  const fragments: FragmentInput[] = [];
  const fragmentMeta: Record<string, SessionWorld["fragmentMeta"][string]> = {};
  const meta: Record<string, FragmentPackMeta> = {};
  const markers: Record<string, string> = {};
  const external: ExternalPrerequisite[] = [];
  let motifDaySha: string | null = null;
  let motifNightSha: string | null = null;
  let allowsSpeakerWildlife = false;
  let depthBloomTextureM = 10;

  for (const row of args.packs) {
    if (row.scope === "region") {
      const region = RegionPackDevice.safeParse(JSON.parse(row.manifest_json));
      if (!region.success) continue;
      sunReference ??= region.data.sunReference;
      timeZone ??= region.data.timezone;
      continue;
    }
    if (row.scope !== "grove") continue;
    const parsed = GrovePackDevice.safeParse(JSON.parse(row.manifest_json));
    if (!parsed.success) continue;
    const pack = parsed.data;
    groves.push({ id: pack.groveId, boundary: pack.grove.boundary });
    allowsSpeakerWildlife = pack.grove.allowsSpeakerWildlifeSounds;
    depthBloomTextureM = pack.grove.depthBloomTextureM ?? depthBloomTextureM;
    for (const link of pack.externalPrerequisites) {
      external.push(link);
    }
    for (const cue of pack.soundCues ?? []) {
      if (cue.kind === "threshold_motif_day") motifDaySha = cue.assetSha;
      if (cue.kind === "threshold_motif_night") motifNightSha = cue.assetSha;
    }
    for (const fragment of pack.fragments) {
      if (fragment.markerHash) markers[fragment.markerHash] = fragment.id;
      const revision = currentRevision(fragment.id, pack.revisions);
      fragments.push(toInput(pack.groveId, fragment, pack.revisions));
      const changeTeaser = revision?.changeTeaser
        ? pickL10n(revision.changeTeaser, lang) ?? undefined
        : undefined;
      const narrationByWindow: FragmentPackMeta["narrationByWindow"] = {};
      for (const version of revision?.versions ?? []) {
        const other =
          version.otherTimeHint != null
            ? pickL10n(version.otherTimeHint, lang) ?? undefined
            : undefined;
        narrationByWindow[version.timeWindow] = {
          sha: version.assetSha,
          durationMs: version.durationMs,
          breathPointsMs: version.breathPointsMs ?? [],
          title: pickL10n(fragment.title, lang) ?? "",
          otherTimeHint: other,
        };
      }
      fragmentMeta[fragment.id] = {
        revisionNo: revision?.revisionNo ?? 1,
        teaser: pickL10n(fragment.teaser, lang) ?? "",
        changeTeaser,
        characterIds: fragment.characters.filter((c) => c.introduces).map((c) => c.characterId),
      };
      meta[fragment.id] = {
        teaser: pickL10n(fragment.teaser, lang) ?? "",
        changeTeaser,
        characterIds: fragment.characters.filter((c) => c.introduces).map((c) => c.characterId),
        revisionNo: revision?.revisionNo ?? 1,
        narrationByWindow,
        resolveSha: fragment.resolveAssetSha,
        teaserLockedSha: fragment.teaserLockedAssetSha,
        beaconSha: fragment.beaconAssetSha,
      };
    }
  }

  const timeWindow: TimeWindow =
    sunReference && timeZone
      ? currentTimeWindow(at, sunReference, timeZone)
      : "day";

  return {
    world: {
      groves,
      fragments,
      fragmentMeta,
      externalPrerequisites: external,
      markers,
      completions: args.completions,
      unlocks: args.unlocks,
      timeWindow,
      lang,
      settings: {
        accessibleTrigger: args.settings.accessibleTrigger,
        locationAvailable: args.settings.locationAvailable,
        accuracyToleranceM: args.settings.accuracyToleranceM,
      },
    },
    meta,
    markers,
    motifDaySha,
    motifNightSha,
    allowsSpeakerWildlife,
    depthBloomTextureM,
    timeZone,
    sunReference,
    assetUris: args.assetUris ?? {},
  };
}
