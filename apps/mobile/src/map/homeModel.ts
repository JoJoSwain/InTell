import {
  GrovePack,
  RegionPack,
  markerState,
  pickL10n,
  type CompletionRow,
  type FragmentInput,
  type TimeWindow,
} from "@intell/shared";
import type { PackRow } from "../db/repos";
import { piecesFromBoundary, ringCentroid, type GrovePiece, type MapPoint } from "./groves";
import { legacyPulse, markerLocked } from "./markers";
import { strings } from "../ui/strings";
import { webStrength, webWeight, type WebTier } from "./web";

export type HomeGrove = {
  id: string;
  name: string;
  premise: string;
  pieces: GrovePiece[];
  centroid: MapPoint | null;
};

export type HomeMarker = {
  id: string;
  groveId: string;
  tier: WebTier;
  coordinate: MapPoint;
  pulse: "tier" | "changed" | "none";
  locked: boolean;
  card: string;
  label: string;
};

export type HomeLink = {
  id: string;
  groveId: string;
  a: { lat: number; lng: number };
  b: { lat: number; lng: number };
  tierA: WebTier;
  tierB: WebTier;
  strength: number;
  weight: number;
};

export type HomeModel = {
  groves: HomeGrove[];
  markers: HomeMarker[];
  links: HomeLink[];
  sunReference: { lat: number; lng: number } | null;
  timeZone: string | null;
};

export function modelsFromPacks(
  packs: readonly PackRow[],
  completions: readonly {
    fragment_id: string;
    revision_no: number;
    time_window: string;
    on_site: number;
  }[],
  unlocks: readonly { fragment_id: string }[],
  timeWindow: TimeWindow,
): HomeModel {
  const done: CompletionRow[] = completions
    .filter((row) => row.time_window === "day" || row.time_window === "night")
    .map((row) => ({
      fragmentId: row.fragment_id,
      revisionNo: row.revision_no,
      timeWindow: row.time_window as TimeWindow,
      onSite: row.on_site === 1,
    }));
  const unlocked = unlocks.map((row) => ({ fragmentId: row.fragment_id }));

  const groves: HomeGrove[] = [];
  const markers: HomeMarker[] = [];
  const links: HomeLink[] = [];
  let sunReference: HomeModel["sunReference"] = null;
  let timeZone: string | null = null;

  for (const row of packs) {
    if (row.scope === "region") {
      const region = RegionPack.safeParse(JSON.parse(row.manifest_json));
      if (!region.success) continue;
      sunReference ??= region.data.sunReference;
      timeZone ??= region.data.timezone;
      continue;
    }
    if (row.scope !== "grove") continue;
    const parsed = GrovePack.safeParse(JSON.parse(row.manifest_json));
    if (!parsed.success) continue;
    const pack = parsed.data;
    const pieces = piecesFromBoundary(pack.grove.boundary);
    groves.push({
      id: pack.groveId,
      name: pickL10n(pack.grove.name, "en") ?? "",
      premise: pickL10n(pack.grove.premise, "en") ?? "",
      pieces,
      centroid: ringCentroid(pieces[0]?.outer ?? []),
    });

    const inputs = pack.fragments.map((fragment) => toInput(pack.groveId, fragment, pack.revisions));
    for (const fragment of pack.fragments) {
      const input = inputs.find((item) => item.id === fragment.id);
      if (!input) continue;
      const state = markerState({
        fragment: input,
        fragments: inputs,
        external: pack.externalPrerequisites,
        completions: done,
        unlocks: unlocked,
        timeWindow,
        lang: "en",
      });
      if (state.hidden) continue;
      const revision = currentRevision(fragment.id, pack.revisions);
      const card = cardText(fragment, revision?.changeTeaser, state);
      markers.push({
        id: fragment.id,
        groveId: pack.groveId,
        tier: fragment.tier,
        coordinate: { latitude: fragment.lat, longitude: fragment.lng },
        pulse: legacyPulse(state),
        locked: markerLocked(state),
        card,
        label: card,
      });
    }

    const byId = new Map(pack.fragments.map((fragment) => [fragment.id, fragment]));
    for (const fragment of pack.fragments) {
      const target = markers.find((marker) => marker.id === fragment.id);
      if (!target) continue;
      for (const group of fragment.requires) {
        for (const memberId of group) {
          const source = byId.get(memberId);
          const sourceMarker = markers.find((marker) => marker.id === memberId);
          if (!source || !sourceMarker) continue;
          links.push({
            id: `${memberId}-${fragment.id}`,
            groveId: pack.groveId,
            a: { lat: source.lat, lng: source.lng },
            b: { lat: fragment.lat, lng: fragment.lng },
            tierA: source.tier,
            tierB: fragment.tier,
            strength: webStrength(target.locked),
            weight: webWeight(source.tier, fragment.tier),
          });
        }
      }
    }
  }

  return { groves, markers, links, sunReference, timeZone };
}

function toInput(
  groveId: string,
  fragment: GrovePack["fragments"][number],
  revisions: GrovePack["revisions"],
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

function currentRevision(fragmentId: string, revisions: GrovePack["revisions"]) {
  return revisions
    .filter((revision) => revision.fragmentId === fragmentId)
    .sort((a, b) => b.revisionNo - a.revisionNo)[0];
}

function cardText(
  fragment: GrovePack["fragments"][number],
  changeTeaser: GrovePack["revisions"][number]["changeTeaser"] | undefined,
  state: { pulse: boolean; opacity: number },
): string {
  if (fragment.visibility === "physical") return strings.scanHere;
  if (state.pulse && state.opacity === 1 && changeTeaser) {
    return pickL10n(changeTeaser, "en") ?? pickL10n(fragment.teaser, "en") ?? "";
  }
  return pickL10n(fragment.teaser, "en") ?? "";
}
