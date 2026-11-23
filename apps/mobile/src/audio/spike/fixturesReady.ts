export const FIXTURES_MISSING_MESSAGE =
  "Spike audio fixtures missing. From the repo root run:\n\npnpm --filter @intell/audio-fixtures generate\n\nThen rebuild the app.";

/** Real Metro WAV modules are numeric asset ids. The missing-file sentinel is not. */
export function spikeAssetModulesReady(
  modules: Record<string, unknown>,
): boolean {
  return Object.values(modules).every((value) => typeof value === "number");
}
