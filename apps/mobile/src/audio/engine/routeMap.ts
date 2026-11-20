import type { AudioRoute } from "@intell/shared";

/** Subset of react-native-audio-api AudioDevicesInfo used for route heuristics. */
export interface DevicesInfoLike {
  availableOutputs?: { id?: string; name?: string; category?: string }[];
  currentOutputs?: { id?: string; name?: string; category?: string }[];
}

/**
 * Heuristic AudioRoute from getDevicesInfo() (review §6.3).
 * Android: currentOutputs is always empty — classify from availableOutputs.
 */
export function classifyRoute(info: DevicesInfoLike): AudioRoute {
  const devices = [
    ...(info.currentOutputs ?? []),
    ...(info.availableOutputs ?? []),
  ];

  const blob = devices
    .map((d) => `${d.category ?? ""} ${d.name ?? ""}`.toLowerCase())
    .join(" | ");

  if (!blob.trim()) return "unknown";

  if (
    /bluetooth|a2dp|ble|hearing.?aid|hfp|sco/.test(blob) ||
    /\bbt\b/.test(blob)
  ) {
    return "bluetooth";
  }

  if (
    /headphone|headset|wired|usb.?audio|usb.?headset|line.?out|car.?audio/.test(
      blob,
    )
  ) {
    return "headphones";
  }

  if (/speaker|receiver|earpiece|built-?in/.test(blob)) {
    const hasExternal = devices.some((d) => {
      const s = `${d.category ?? ""} ${d.name ?? ""}`.toLowerCase();
      return /headphone|headset|bluetooth|a2dp|usb|wired|line/.test(s);
    });
    if (!hasExternal) return "speaker";
  }

  if (/headphone|headset|wired|usb/.test(blob)) return "headphones";

  return "unknown";
}

/** True when the new route is the phone speaker. */
export function isSpeakerLike(route: AudioRoute): boolean {
  return route === "speaker";
}
