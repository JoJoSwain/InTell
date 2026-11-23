import { currentTimeWindow, type TimeWindow } from "@intell/shared";

export type AppearancePreference = "story" | "phone";
export type PhoneScheme = "light" | "dark" | null | undefined;

export const APPEARANCE_KEY = "appearance";

export function parseAppearance(value: string | null): AppearancePreference {
  return value === "phone" ? "phone" : "story";
}

export function resolveMapTheme(input: {
  preference: AppearancePreference;
  phoneScheme: PhoneScheme;
  hasRegion: boolean;
  at: Date;
  sunReference: { lat: number; lng: number } | null;
  timeZone: string | null;
}): TimeWindow {
  if (
    input.preference === "phone" ||
    !input.hasRegion ||
    input.sunReference === null ||
    input.timeZone === null
  ) {
    return input.phoneScheme === "dark" ? "night" : "day";
  }
  return currentTimeWindow(input.at, input.sunReference, input.timeZone);
}
