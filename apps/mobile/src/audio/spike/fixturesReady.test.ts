import { spikeAssetModulesReady } from "./fixturesReady";

test("a numeric asset id counts as a bundled spike fixture", () => {
  expect(spikeAssetModulesReady({ narration: 1 })).toBe(true);
});

test("the missing-file sentinel is not a bundled spike fixture", () => {
  expect(spikeAssetModulesReady({ narration: { missing: true } })).toBe(false);
});
