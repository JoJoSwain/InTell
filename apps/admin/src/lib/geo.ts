/** Parse GeoJSON Point into lat/lng. Returns null when unreadable — never invent coordinates. */
export function coordsFromGeo(
  value: unknown,
): { lat: number; lng: number } | null {
  if (value && typeof value === "object" && value !== null) {
    const v = value as { type?: string; coordinates?: number[] };
    if (Array.isArray(v.coordinates) && v.coordinates.length >= 2) {
      const lng = Number(v.coordinates[0]);
      const lat = Number(v.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

export function geoJsonString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    // Reject EWKB hex / non-JSON strings so the form never posts them as "GeoJSON".
    const t = value.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) return "";
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

/** Canonical JSON for comparing GeoJSON payloads (ignore whitespace / key order). */
export function geoJsonEqual(a: string, b: string): boolean {
  try {
    return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
  } catch {
    return a.trim() === b.trim();
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
