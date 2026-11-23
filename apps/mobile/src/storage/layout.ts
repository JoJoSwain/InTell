export const ASSET_DIRECTORY_NAME = "intell-assets";
export const PREVIEW_DIRECTORY_NAME = "intell-preview";
export const STAGING_DIRECTORY_NAME = "intell-staging";

export type StorageNative = {
  progressDirectory(): string;
  ensureExcludedDirectory(name: string): string;
};

export type StorageLayout = {
  progressDirectory: string;
  assetDirectory: string;
  previewDirectory: string;
  stagingDirectory: string;
};

/**
 * Asks native code for the progress directory and re-applies the exclude flag
 * on the asset and preview directories. Call again after either directory is
 * deleted and recreated.
 */
export function ensureStorageLayout(native: StorageNative): StorageLayout {
  return {
    progressDirectory: native.progressDirectory(),
    assetDirectory: native.ensureExcludedDirectory(ASSET_DIRECTORY_NAME),
    previewDirectory: native.ensureExcludedDirectory(PREVIEW_DIRECTORY_NAME),
    stagingDirectory: native.ensureExcludedDirectory(STAGING_DIRECTORY_NAME),
  };
}
