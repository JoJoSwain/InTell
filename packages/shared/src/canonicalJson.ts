/**
 * Canonical JSON for pack manifests (DATA_MODEL §12 / M2b review #3).
 * Deno-safe: no Node builtins.
 *
 * - Deep-sorted object keys
 * - No insignificant whitespace
 * - UTF-8 string (same as JS string for BMP + surrogates)
 * - Coordinates: callers must round to 6 decimals before passing in
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Recursively sort object keys; arrays keep caller-defined order. */
export function sortKeysDeep(value: unknown): JsonValue {
  if (value === null || typeof value !== "object") {
    return value as JsonPrimitive;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, JsonValue> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

/** Round a coordinate to 6 decimal places (GeoJSON / pack lat/lng). */
export function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function roundCoordsDeep(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Only round values that look like lon/lat when used via helpers;
    // generic deep round is applied by pack builder on known coord fields.
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(roundCoordsDeep);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (
        (k === "lat" || k === "lng" || k === "lon" || k === "longitude" || k === "latitude") &&
        typeof v === "number"
      ) {
        out[k] = roundCoord(v);
      } else if (k === "coordinates") {
        out[k] = roundGeoJsonCoordinates(v);
      } else {
        out[k] = roundCoordsDeep(v);
      }
    }
    return out;
  }
  return value;
}

function roundGeoJsonCoordinates(coords: unknown): unknown {
  if (typeof coords === "number") return roundCoord(coords);
  if (Array.isArray(coords)) return coords.map(roundGeoJsonCoordinates);
  return coords;
}

/** Canonical JSON bytes as a UTF-8 string (no spaces). */
export function canonicalJson(value: unknown): string {
  const prepared = roundCoordsDeep(value);
  return JSON.stringify(sortKeysDeep(prepared));
}

/** Hex sha256 of canonical JSON. Pass a digest fn so Deno/Node can supply crypto. */
export async function contentSha256(
  value: unknown,
  digestHex: (utf8: string) => Promise<string> | string,
): Promise<string> {
  return await digestHex(canonicalJson(value));
}
