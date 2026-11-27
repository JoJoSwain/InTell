/** Device settings stored in kv (M6 rows; beacons for M7). */
export const ACCESSIBLE_TRIGGER_KEY = "settings.accessibleTrigger";
export const LOCATION_AVAILABLE_KEY = "settings.locationAvailable";
export const BEACONS_ENABLED_KEY = "settings.beaconsEnabled";

/** FR-3 / G1: default accuracy tolerance until Pixel walk retunes. */
export const DEFAULT_ACCURACY_TOLERANCE_M = 25;

export type ExploringSettings = {
  accessibleTrigger: boolean;
  locationAvailable: boolean;
  beaconsEnabled: boolean;
  accuracyToleranceM: number;
};

export const DEFAULT_EXPLORING_SETTINGS: ExploringSettings = {
  accessibleTrigger: false,
  locationAvailable: true,
  beaconsEnabled: false,
  accuracyToleranceM: DEFAULT_ACCURACY_TOLERANCE_M,
};

export function parseBoolKv(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}
