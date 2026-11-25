import {
  GrovePackDevice,
  RegionPackDevice,
  currentTimeWindow,
  markerState,
  pickL10n,
  storyWebLinks,
  type CompletionRow,
  type FragmentInput,
  type GeoJsonMultiPolygon,
  type PulseKind,
  type TimeWindow,
} from "@intell/shared";
import type { PackRow } from "../db/repos";
import { piecesFromBoundary, ringCentroid, type GrovePiece, type MapPoint } from "./groves";
import { accessibilityLabel, markerLocked, markerPulse } from "./markers";
import { strings } from "../ui/strings";
import { webStrength, webWeight, type WebTier } from "./web";

type GrovePackData = import("@intell/shared").GrovePackDevice;

export type HomeGrove = {
  id: string;
  name: string;
  premise: string;
  boundary: GeoJsonMultiPolygon;
  pieces: GrovePiece[];
  centroid: MapPoint | null;
  shapeFragments: { id: string; tier: WebTier; lat: number; lng: number }[];
};

export type HomeMarker = {
  id: string;
  groveId: string;
  tier: WebTier;
  coordinate: MapPoint;
  pulse: PulseKind;
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

export type HomeCrossLink = {
  id: string;
  groveId: string;
  from: { lat: number; lng: number };
  tip: { lat: number; lng: number };
  strength: number;
};

export type HomeModel = {
  groves: HomeGrove[];
  markers: HomeMarker[];
  links: HomeLink[];
  crossLinks: HomeCrossLink[];
  sunReference: { lat: number; lng: number } | null;
  timeZone: string | null;
};

export function storyTimeWindow(
  at: Date,
  sunReference: { lat: number; lng: number } | null,
  timeZone: string | null,
): TimeWindow {
  if (!sunReference || !timeZone) return "day";
  return currentTimeWindow(at, sunReference, timeZone);
}

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
  const crossLinks: HomeCrossLink[] = [];
  let sunReference: HomeModel["sunReference"] = null;
  let timeZone: string | null = null;

  for (const row of packs) {
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
    const pieces = piecesFromBoundary(pack.grove.boundary);
    const shapeFragments = pack.fragments
      .filter((fragment) => !fragment.retired)
      .map((fragment) => ({
        id: fragment.id,
        tier: fragment.tier,
        lat: fragment.lat,
        lng: fragment.lng,
      }));
    groves.push({
      id: pack.groveId,
      name: pickL10n(pack.grove.name, "en") ?? "",
      premise: pickL10n(pack.grove.premise, "en") ?? "",
      boundary: pack.grove.boundary,
      pieces,
      centroid: ringCentroid(pieces[0]?.outer ?? []),
      shapeFragments,
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
      const pulse = markerPulse(state);
      const locked = markerLocked(state);
      const card = cardText(fragment, revision?.changeTeaser, pulse);
      markers.push({
        id: fragment.id,
        groveId: pack.groveId,
        tier: fragment.tier,
        coordinate: { latitude: fragment.lat, longitude: fragment.lng },
        pulse,
        locked,
        card,
        label: accessibilityLabel(fragment.tier, pulse, locked, card),
      });
    }

    const byId = new Map(pack.fragments.map((fragment) => [fragment.id, fragment]));
    for (const link of storyWebLinks(pack.fragments)) {
      const source = byId.get(link.fromId);
      const target = byId.get(link.toId);
      const targetMarker = markers.find((marker) => marker.id === link.toId);
      if (!source || !target || !targetMarker) continue;
      links.push({
        id: `${link.fromId}-${link.toId}`,
        groveId: pack.groveId,
        a: { lat: source.lat, lng: source.lng },
        b: { lat: target.lat, lng: target.lng },
        tierA: source.tier,
        tierB: target.tier,
        strength: webStrength(targetMarker.locked),
        weight: webWeight(source.tier, target.tier),
      });
    }

    for (const link of pack.crossGroveLinks) {
      const here = markers.find((marker) => marker.id === link.fragmentId);
      if (!here) continue;
      crossLinks.push({
        id: `${link.fragmentId}-${link.otherFragmentId}-${link.direction}`,
        groveId: pack.groveId,
        from: { lat: here.coordinate.latitude, lng: here.coordinate.longitude },
        tip: link.tip,
        strength: webStrength(here.locked),
      });
    }
  }

  return { groves, markers, links, crossLinks, sunReference, timeZone };
}

function toInput(
  groveId: string,
  fragment: GrovePackData["fragments"][number],
  revisions: GrovePackData["revisions"],
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

function currentRevision(fragmentId: string, revisions: GrovePackData["revisions"]) {
  return revisions
    .filter((revision) => revision.fragmentId === fragmentId)
    .sort((a, b) => b.revisionNo - a.revisionNo)[0];
}

function cardText(
  fragment: GrovePackData["fragments"][number],
  changeTeaser: GrovePackData["revisions"][number]["changeTeaser"] | undefined,
  pulse: PulseKind,
): string {
  const teaser = pickL10n(fragment.teaser, "en") ?? "";
  if (fragment.visibility === "physical") {
    return teaser ? `${teaser} ${strings.scanHere}` : strings.scanHere;
  }
  if (pulse === "changed" && changeTeaser) {
    return pickL10n(changeTeaser, "en") ?? teaser;
  }
  return teaser;
}
