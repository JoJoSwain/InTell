import { AFTERGLOW_MS } from "./DuckingPolicy";

export type ResolvePick =
  | { kind: "asset"; assetSha: string }
  | { kind: "pause"; ms: number };

/**
 * Afterglow resolve from startAfterglow{fragmentId, tier}.
 * Fragment override wins; else cue tier sha; else plain afterglow pause.
 */
export function pickResolve(input: {
  tier: "root" | "branch" | "leaf";
  cue: {
    resolveRootSha?: string;
    resolveBranchSha?: string;
    resolveLeafSha?: string;
  };
  fragmentResolveSha?: string;
}): ResolvePick {
  if (input.fragmentResolveSha) {
    return { kind: "asset", assetSha: input.fragmentResolveSha };
  }
  const sha =
    input.tier === "root"
      ? input.cue.resolveRootSha
      : input.tier === "branch"
        ? input.cue.resolveBranchSha
        : input.cue.resolveLeafSha;
  if (sha) return { kind: "asset", assetSha: sha };
  return { kind: "pause", ms: AFTERGLOW_MS };
}
