export type ManifestAssets = { assets: readonly { sha: string }[] };

/** Stand-in until A1 exports these from @intell/shared. */
export function manifestShas(manifests: readonly ManifestAssets[]): Set<string> {
  const shas = new Set<string>();
  for (const manifest of manifests) {
    for (const asset of manifest.assets) shas.add(asset.sha);
  }
  return shas;
}

export function assetsToFetch(needed: readonly string[], localShas: ReadonlySet<string>): string[] {
  return needed.filter((sha) => !localShas.has(sha));
}

export function assetsToDelete(localShas: readonly string[], kept: ReadonlySet<string>): string[] {
  return localShas.filter((sha) => !kept.has(sha));
}
