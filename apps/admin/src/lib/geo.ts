/** Parse GeoJSON Point / geography from PostgREST into lat/lng. */
export function coordsFromGeo(
  value: unknown,
  fallback: { lat: number; lng: number } = { lat: 41.1, lng: -111.9 },
): { lat: number; lng: number } {
  if (value && typeof value === "object" && value !== null) {
    const v = value as { type?: string; coordinates?: number[] };
    if (Array.isArray(v.coordinates) && v.coordinates.length >= 2) {
      const lng = Number(v.coordinates[0]);
      const lat = Number(v.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return fallback;
}

export function geoJsonString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function l10nEn(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const en = (value as Record<string, unknown>).en;
  return typeof en === "string" ? en : "";
}

export function asL10n(en: string): { en: string } {
  return { en };
}
