import type { GrovePack, PreviewManifest, RegionPack } from "../schemas/packs";

/** A pack the phone may keep installed, including a staff preview manifest. */
export type PackManifest = GrovePack | RegionPack | PreviewManifest;

function add(out: Set<string>, sha: string | undefined): void {
  if (sha) out.add(sha);
}

/** Asset shas only. markerHash is a code hash, not a file the phone downloads. */
function addGrove(pack: GrovePack, out: Set<string>): void {
  add(out, pack.grove.growthCueAssetSha);
  for (const character of pack.characters) add(out, character.portraitSha);
  for (const fragment of pack.fragments) {
    add(out, fragment.beaconAssetSha);
    add(out, fragment.resolveAssetSha);
    add(out, fragment.teaserLockedAssetSha);
  }
  for (const revision of pack.revisions) {
    for (const version of revision.versions) add(out, version.assetSha);
  }
  for (const cue of pack.music.cues) {
    add(out, cue.resolveRootAssetSha);
    add(out, cue.resolveBranchAssetSha);
    add(out, cue.resolveLeafAssetSha);
    for (const stem of cue.stems) add(out, stem.assetSha);
  }
  for (const cue of pack.soundCues ?? []) add(out, cue.assetSha);
  for (const asset of pack.assets) add(out, asset.sha);
}

function addRegion(pack: RegionPack, out: Set<string>): void {
  for (const profile of pack.ambienceProfiles) {
    for (const layer of profile.layers) {
      for (const sha of layer.assetShas) add(out, sha);
    }
  }
  if (pack.landcover) add(out, pack.landcover.gridSha);
  for (const cue of pack.musicCues) {
    for (const stem of cue.stems) add(out, stem.assetSha);
  }
  for (const cue of pack.uiCues) add(out, cue.assetSha);
  for (const asset of pack.assets) add(out, asset.sha);
}

function isPreview(pack: PackManifest): pack is PreviewManifest {
  return pack.schema === "preview/1";
}

function isRegion(pack: PackManifest): pack is RegionPack {
  return pack.schema === 2;
}

/** Every asset sha this pack references, unique and sorted. */
export function manifestShas(pack: PackManifest): string[] {
  const out = new Set<string>();
  if (isPreview(pack)) {
    for (const grove of pack.groves) addGrove(grove, out);
    for (const asset of pack.assets) add(out, asset.sha);
  } else if (isRegion(pack)) {
    addRegion(pack, out);
  } else {
    addGrove(pack, out);
  }
  return [...out].sort();
}

/** Shas in the pack that are not already on the device. */
export function assetsToFetch(
  pack: PackManifest,
  localShas: readonly string[],
): string[] {
  const local = new Set(localShas);
  return manifestShas(pack).filter((sha) => !local.has(sha));
}

/**
 * Local shas that no kept pack references. The caller passes installed packs
 * and, while a staff member is signed in, the active preview manifest too.
 */
export function assetsToDelete(
  localShas: readonly string[],
  keptPacks: readonly PackManifest[],
): string[] {
  const kept = new Set<string>();
  for (const pack of keptPacks) {
    for (const sha of manifestShas(pack)) kept.add(sha);
  }
  return [...new Set(localShas)].filter((sha) => !kept.has(sha)).sort();
}
