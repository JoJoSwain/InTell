import type { EmbarkMode, EmbarkResponse, EmbarkStep } from "../_shared/from-shared/embark.ts";

export const TRAVEL_MODE: Record<EmbarkMode, "WALK" | "BICYCLE" | "TRANSIT"> = {
  walk: "WALK",
  bike: "BICYCLE",
  transit: "TRANSIT",
};

const FIELD_MASK_BASE =
  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.warnings";

const FIELD_MASK_TRANSIT =
  `${FIELD_MASK_BASE},` +
  "routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration," +
  "routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.travelMode," +
  "routes.legs.steps.transitDetails";

export function fieldMaskFor(mode: EmbarkMode): string {
  return mode === "transit" ? FIELD_MASK_TRANSIT : FIELD_MASK_BASE;
}

export function parseDurationS(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(raw.trim());
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export type ComputeRoutesInput = {
  mode: EmbarkMode;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  languageCode: string;
};

export function buildComputeRoutesRequest(input: ComputeRoutesInput): {
  body: Record<string, unknown>;
  fieldMask: string;
  travelMode: "WALK" | "BICYCLE" | "TRANSIT";
} {
  const travelMode = TRAVEL_MODE[input.mode];
  return {
    travelMode,
    fieldMask: fieldMaskFor(input.mode),
    body: {
      origin: {
        location: {
          latLng: {
            latitude: input.origin.lat,
            longitude: input.origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: input.destination.lat,
            longitude: input.destination.lng,
          },
        },
      },
      travelMode,
      units: "METRIC",
      languageCode: input.languageCode,
    },
  };
}

type GoogleStep = {
  distanceMeters?: number;
  staticDuration?: string;
  polyline?: { encodedPolyline?: string };
  travelMode?: string;
  transitDetails?: {
    stopDetails?: {
      departureStop?: { name?: string };
      arrivalStop?: { name?: string };
      departureTime?: string;
      arrivalTime?: string;
    };
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      color?: string;
      textColor?: string;
      vehicle?: { type?: string };
    };
  };
};

type GoogleRoute = {
  duration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  warnings?: string[];
  legs?: { steps?: GoogleStep[] }[];
};

export type MapRoutesResult =
  | { ok: true; response: Omit<EmbarkResponse, "mode"> & { mode?: EmbarkMode } }
  | { ok: false; kind: "no-route" | "unusable" };

/**
 * Map Google's first route into Embark fields.
 * R1: missing transit stop details keep the step; drop only when polyline is absent.
 * 502/unusable only when the route lacks polyline, distance or duration.
 */
export function mapComputeRoutesResponse(
  payload: unknown,
  mode: EmbarkMode,
): MapRoutesResult {
  const routes = (payload as { routes?: GoogleRoute[] } | null)?.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    return { ok: false, kind: "no-route" };
  }
  const route = routes[0];
  if (!route) return { ok: false, kind: "no-route" };

  const polyline = route.polyline?.encodedPolyline;
  const distanceM = route.distanceMeters;
  const durationS = parseDurationS(route.duration);
  if (
    typeof polyline !== "string" ||
    polyline.length === 0 ||
    typeof distanceM !== "number" ||
    !Number.isFinite(distanceM) ||
    distanceM < 0 ||
    durationS === null
  ) {
    return { ok: false, kind: "unusable" };
  }

  const warnings = Array.isArray(route.warnings)
    ? route.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const out: EmbarkResponse = {
    mode,
    distanceM,
    durationS,
    polyline,
    warnings,
  };

  if (mode === "transit") {
    const steps: EmbarkStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        const mapped = mapStep(step);
        if (mapped) steps.push(mapped);
      }
    }
    out.steps = steps;
  }

  return { ok: true, response: out };
}

function mapStep(step: GoogleStep): EmbarkStep | null {
  const polyline = step.polyline?.encodedPolyline;
  if (typeof polyline !== "string" || polyline.length === 0) return null;

  const distanceM =
    typeof step.distanceMeters === "number" && Number.isFinite(step.distanceMeters)
      ? Math.max(0, step.distanceMeters)
      : 0;
  const durationS = parseDurationS(step.staticDuration) ?? 0;
  const travel = step.travelMode;

  if (travel === "WALK") {
    return { kind: "walk", distanceM, durationS, polyline };
  }

  if (travel === "TRANSIT") {
    const td = step.transitDetails;
    const line = td?.transitLine;
    const stops = td?.stopDetails;
    const transit: EmbarkStep = {
      kind: "transit",
      distanceM,
      durationS,
      polyline,
      line: {
        ...(line?.name ? { name: line.name } : {}),
        ...(line?.nameShort ? { nameShort: line.nameShort } : {}),
        ...(line?.color ? { color: line.color } : {}),
        ...(line?.textColor ? { textColor: line.textColor } : {}),
        ...(line?.vehicle?.type ? { vehicleType: line.vehicle.type } : {}),
      },
    };
    const dep = stops?.departureStop?.name;
    const arr = stops?.arrivalStop?.name;
    if (typeof dep === "string" && dep.length > 0) transit.departureStop = dep;
    if (typeof arr === "string" && arr.length > 0) transit.arrivalStop = arr;
    if (typeof stops?.departureTime === "string") {
      transit.departureTime = stops.departureTime;
    }
    if (typeof stops?.arrivalTime === "string") {
      transit.arrivalTime = stops.arrivalTime;
    }
    if (typeof td?.stopCount === "number" && td.stopCount >= 0) {
      transit.stopCount = Math.floor(td.stopCount);
    }
    return transit;
  }

  return null;
}
