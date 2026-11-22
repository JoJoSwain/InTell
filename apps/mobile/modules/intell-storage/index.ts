import { requireNativeModule } from "expo";

export type IntellStorageNative = {
  progressDirectory(): string;
  /**
   * Creates the directory if needed and, on iOS, sets NSURLIsExcludedFromBackupKey.
   * Call it every time the directory may have been recreated (N2).
   */
  ensureExcludedDirectory(name: string): string;
};

export default requireNativeModule<IntellStorageNative>("IntellStorage");
