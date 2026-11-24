import {
  EmbarkRequest,
  EmbarkResponse,
  type EmbarkMode,
} from "../_shared/from-shared/embark.ts";
import { distanceMeters } from "../_shared/from-shared/polygon.ts";
import { json } from "../_shared/http.ts";
import {
  buildComputeRoutesRequest,
  mapComputeRoutesResponse,
} from "./google.ts";

export const EMBARK_ENDPOINT = "embark";
export const EMBARK_LIMIT = 60;
export const EMBARK_WINDOW_SECONDS = 86_400;
export const EMBARK_MAX_DISTANCE_M = 150_000;
export const GOOGLE_TIMEOUT_MS = 10_000;

export type EmbarkDeps = {
  fetch: typeof fetch;
  deviceExists: (deviceId: string) => Promise<boolean>;
  rateAllow: (deviceId: string) => Promise<boolean>;
  lookupOpening: (
    groveId: string,
  ) => Promise<{ lat: number; lng: number } | null>;
  routesBaseUrl: string;
  routesApiKey: string;
  /** deviceId null only for pre-parse failures (invalid-body). */
  log: (
    deviceId: string | null,
    outcome: string,
    mode?: EmbarkMode,
  ) => void;
};

/**
 * Pure embark handler. Body must already be a parsed JSON value;
 * invalid shapes return 400 without zod issue details (R2).
 */
export async function handleEmbark(
  body: unknown,
  deps: EmbarkDeps,
): Promise<Response> {
  const parsed = EmbarkRequest.safeParse(body);
  if (!parsed.success) {
    // Do not log or return zod issues — they can echo request values (R2).
    deps.log(null, "invalid-body");
    return json({ error: "invalid body" }, 400);
  }

  const { deviceId, groveId, mode, origin, lang } = parsed.data;

  let exists: boolean;
  try {
    exists = await deps.deviceExists(deviceId);
  } catch {
    deps.log(deviceId, "internal-error", mode);
    return json({ error: "internal" }, 500);
  }
  if (!exists) {
    deps.log(deviceId, "unregistered", mode);
    return json({ error: "device not registered" }, 403);
  }

  let allowed: boolean;
  try {
    allowed = await deps.rateAllow(deviceId);
  } catch {
    deps.log(deviceId, "rate-limit-error", mode);
    return json({ error: "rate limit unavailable" }, 500);
  }
  if (!allowed) {
    deps.log(deviceId, "rate-limited", mode);
    return json({ error: "rate limited" }, 429);
  }

  let opening: { lat: number; lng: number } | null;
  try {
    opening = await deps.lookupOpening(groveId);
  } catch {
    deps.log(deviceId, "internal-error", mode);
    return json({ error: "internal" }, 500);
  }
  if (!opening) {
    deps.log(deviceId, "no-opening", mode);
    return json({ error: "no opening" }, 404);
  }

  if (distanceMeters(origin, opening) > EMBARK_MAX_DISTANCE_M) {
    deps.log(deviceId, "too-far", mode);
    return json({ error: "origin too far" }, 400);
  }

  const { body: googleBody, fieldMask, travelMode } = buildComputeRoutesRequest({
    mode,
    origin,
    destination: opening,
    languageCode: lang,
  });

  const base = deps.routesBaseUrl.replace(/\/$/, "");
  const url = `${base}/directions/v2:computeRoutes`;

  let googleRes: Response;
  try {
    googleRes = await deps.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": deps.routesApiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(googleBody),
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });
  } catch {
    // Never log the error object — it may hold request URLs or bodies (R2).
    deps.log(deviceId, "upstream-error", mode);
    return json({ error: "route unavailable" }, 502);
  }

  if (!googleRes.ok) {
    // Drain body without echoing it.
    try {
      await googleRes.arrayBuffer();
    } catch {
      /* ignore */
    }
    deps.log(deviceId, "upstream-error", mode);
    return json({ error: "route unavailable" }, 502);
  }

  let payload: unknown;
  try {
    payload = await googleRes.json();
  } catch {
    deps.log(deviceId, "upstream-error", mode);
    return json({ error: "route unavailable" }, 502);
  }

  const mapped = mapComputeRoutesResponse(payload, mode);
  if (!mapped.ok) {
    if (mapped.kind === "no-route") {
      deps.log(deviceId, "no-route", mode);
      return json({ error: "no route" }, 404);
    }
    deps.log(deviceId, "upstream-error", mode);
    return json({ error: "route unavailable" }, 502);
  }

  // Assert travelMode was the one we intended (tests inspect fetch; this is documentation).
  void travelMode;

  let response: EmbarkResponse;
  try {
    response = EmbarkResponse.parse(mapped.response);
  } catch {
    deps.log(deviceId, "upstream-error", mode);
    return json({ error: "route unavailable" }, 502);
  }

  deps.log(deviceId, "ok", mode);
  return json(response);
}

/** Log helper used by index and tests: prefix only, never full id. */
export function formatEmbarkLog(
  deviceId: string | null,
  outcome: string,
  mode?: EmbarkMode,
): string {
  if (!deviceId) return `embark ${outcome}`;
  const ref = deviceId.slice(0, 8);
  return mode
    ? `embark ${outcome} device=${ref} mode=${mode}`
    : `embark ${outcome} device=${ref}`;
}
