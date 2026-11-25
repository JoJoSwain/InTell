/**
 * Background location task name + registration (must load at app startup).
 * Never logs coordinates.
 */
import * as TaskManager from "expo-task-manager";
import type * as Location from "expo-location";

export const EXPLORING_LOCATION_TASK = "intell-exploring-location";

export type LocationFixListener = (fix: {
  at: number;
  lat: number;
  lng: number;
  accuracyM: number;
}) => void;

let listener: LocationFixListener | null = null;

export function setExploringLocationListener(next: LocationFixListener | null): void {
  listener = next;
}

TaskManager.defineTask(EXPLORING_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.info("location task error", error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length || !listener) return;
  for (const loc of locations) {
    listener({
      at: loc.timestamp,
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? 50,
    });
  }
});
