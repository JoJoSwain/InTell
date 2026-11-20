import { getTimes } from "suncalc";

/** Day / Night window (AUDIO_SPEC §3.2 / DATA_MODEL time_window). */
export type TimeWindow = "day" | "night";

export type SunReference = {
  lat: number;
  lng: number;
};

/**
 * Local wall-clock minutes since midnight in `timeZone`.
 * Uses Intl so this stays free of Node-only timezone APIs when run under Deno later.
 */
export function localMinutesSinceMidnight(
  at: Date,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`could not read local time for timezone ${timeZone}`);
  }
  return hour * 60 + minute;
}

/** Polar fallback: day is 06:00–18:00 local (AUDIO_SPEC §3.2). */
export function polarFallbackTimeWindow(
  at: Date,
  timeZone: string,
): TimeWindow {
  const mins = localMinutesSinceMidnight(at, timeZone);
  return mins >= 6 * 60 && mins < 18 * 60 ? "day" : "night";
}

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Current Day/Night at `at` for a region's sun reference and timezone.
 * Day = sunrise inclusive through sunset exclusive; otherwise night.
 * When the sun does not rise or set (polar / null times), uses the polar fallback.
 */
export function currentTimeWindow(
  at: Date,
  sunReference: SunReference,
  timeZone: string,
): TimeWindow {
  const times = getTimes(at, sunReference.lat, sunReference.lng);

  if (times.alwaysUp || times.alwaysDown) {
    return polarFallbackTimeWindow(at, timeZone);
  }

  const sunrise = times.sunrise;
  const sunset = times.sunset;

  if (!isValidDate(sunrise) || !isValidDate(sunset)) {
    return polarFallbackTimeWindow(at, timeZone);
  }

  if (at.getTime() >= sunrise.getTime() && at.getTime() < sunset.getTime()) {
    return "day";
  }
  return "night";
}
