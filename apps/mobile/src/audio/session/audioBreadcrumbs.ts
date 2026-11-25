/**
 * Release-visible audio breadcrumbs (M6 review 4 / F5).
 * Mirrored to native Log.i tag InTellAudio — never coordinates or marker codes.
 */
import NativeAudioSession from "audio-session";

export type AudioBreadcrumb = {
  at: number;
  message: string;
};

const MAX = 30;
const crumbs: AudioBreadcrumb[] = [];

export function pushAudioBreadcrumb(message: string): void {
  const entry = { at: Date.now(), message };
  crumbs.push(entry);
  if (crumbs.length > MAX) crumbs.shift();
  try {
    void NativeAudioSession.logBreadcrumb(message);
  } catch {
    // Native module absent in unit tests / web.
  }
}

export function getAudioBreadcrumbs(): readonly AudioBreadcrumb[] {
  return crumbs;
}

export function clearAudioBreadcrumbs(): void {
  crumbs.length = 0;
}
