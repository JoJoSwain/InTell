/**
 * Maps render only when both the API key and Map ID are set (M3c review answer 16).
 * CI / Playwright / preview hosts leave these empty and use GeoJSON + lat/lng alone.
 */
export function mapsEnabled(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() ?? "";
  return key.length > 0 && mapId.length > 0;
}

export function googleMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
}

export function googleMapId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() ?? "";
}

export function linkDomain(): string {
  return (
    process.env.NEXT_PUBLIC_LINK_DOMAIN?.trim() || "intell.replaceplace.com"
  );
}
