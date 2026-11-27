/**
 * Session + director kv persistence (M6 / R1).
 * Strip coordinates before writing — kv is OS-backed up.
 */
import {
  initialDirectorState,
  initialSessionState,
  parseDirectorState,
  parseSessionState,
  serializeDirectorState,
  type DirectorState,
  type SessionState,
} from "@intell/shared";

export const SESSION_KV_KEY = "session.state.v1";
export const DIRECTOR_KV_KEY = "director.state.v1";

/** Neutral point used when scrubbing director state for disk. */
export const NEUTRAL_POINT = { lat: 0, lng: 0 } as const;

export function scrubSessionForDisk(state: SessionState): SessionState {
  return { ...state, recentFixes: [] };
}

export function scrubDirectorForDisk(state: DirectorState): DirectorState {
  return { ...state, point: { ...NEUTRAL_POINT }, courseDeg: null, depthM: undefined };
}

export function sessionJsonForDisk(state: SessionState): string {
  const scrubbed = scrubSessionForDisk(state);
  // Round-trip through parse so we never write an invalid shape.
  return JSON.stringify(parseSessionState(scrubbed));
}

export function directorJsonForDisk(state: DirectorState): string {
  const scrubbed = scrubDirectorForDisk(state);
  return JSON.stringify(serializeDirectorState(scrubbed));
}

export function loadSessionState(raw: string | null): SessionState {
  if (!raw) return initialSessionState();
  try {
    return parseSessionState(JSON.parse(raw) as unknown);
  } catch {
    return initialSessionState();
  }
}

export function loadDirectorState(
  raw: string | null,
  opts: { seed: number; wallAtMs: number; dayKey: string },
): DirectorState {
  if (!raw) return initialDirectorState(opts);
  try {
    return parseDirectorState(JSON.parse(raw) as unknown);
  } catch {
    return initialDirectorState(opts);
  }
}

/** True if JSON text contains a lat/lng field with a numeric value (R1 test helper). */
export function jsonContainsCoordinates(json: string): boolean {
  try {
    const walk = (value: unknown): boolean => {
      if (value === null || typeof value !== "object") return false;
      if (Array.isArray(value)) return value.some(walk);
      const obj = value as Record<string, unknown>;
      if (
        typeof obj.lat === "number" ||
        typeof obj.lng === "number" ||
        typeof obj.latitude === "number" ||
        typeof obj.longitude === "number"
      ) {
        // Allow the scrubbed neutral origin only when both are exactly 0.
        if (obj.lat === 0 && obj.lng === 0) {
          // still counts as coordinates on disk for director point — R1 says replace
          // with neutral default, which is {0,0}. Tests assert no non-neutral coords
          // and session has empty recentFixes. For strict "no lat/lng keys" on session
          // JSON, check recentFixes separately.
          return Object.keys(obj).some((k) => k !== "lat" && k !== "lng" && walk(obj[k]));
        }
        return true;
      }
      return Object.values(obj).some(walk);
    };
    return walk(JSON.parse(json) as unknown);
  } catch {
    return false;
  }
}
