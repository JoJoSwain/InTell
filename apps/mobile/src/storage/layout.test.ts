import { ASSET_DIRECTORY_NAME, PREVIEW_DIRECTORY_NAME, STAGING_DIRECTORY_NAME, ensureStorageLayout } from "./layout";

test("ensure sets the exclude flag on both directories every call", () => {
  const calls: string[] = [];
  const native = {
    progressDirectory: () => "/progress",
    ensureExcludedDirectory: (name: string) => {
      calls.push(name);
      return `/progress/${name}`;
    },
  };

  const first = ensureStorageLayout(native);
  const second = ensureStorageLayout(native);

  expect(first.progressDirectory).toBe("/progress");
  expect(first.assetDirectory).toBe(`/progress/${ASSET_DIRECTORY_NAME}`);
  expect(second.previewDirectory).toBe(`/progress/${PREVIEW_DIRECTORY_NAME}`);
  expect(calls).toEqual([
    ASSET_DIRECTORY_NAME,
    PREVIEW_DIRECTORY_NAME,
    STAGING_DIRECTORY_NAME,
    ASSET_DIRECTORY_NAME,
    PREVIEW_DIRECTORY_NAME,
    STAGING_DIRECTORY_NAME,
  ]);
});
