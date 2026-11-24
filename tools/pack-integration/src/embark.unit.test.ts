import { describe, expect, it, vi } from "vitest";
import {
  EmbarkRequest,
  EmbarkResponse,
} from "@intell/shared";
import {
  buildComputeRoutesRequest,
  fieldMaskFor,
  mapComputeRoutesResponse,
  TRAVEL_MODE,
} from "../../../supabase/functions/embark/google.ts";
import {
  formatEmbarkLog,
  handleEmbark,
  type EmbarkDeps,
} from "../../../supabase/functions/embark/handler.ts";
import {
  bikeRoutesBody,
  FAR_ORIGIN,
  GROVE_ID,
  OPENING,
  ORIGIN,
  POLYLINE_BIKE,
  POLYLINE_TRANSIT_RIDE,
  POLYLINE_TRANSIT_WALK,
  POLYLINE_WALK,
  transitRoutesBody,
  walkRoutesBody,
} from "./embarkFixtures.ts";

function logsSafe(logs: string[], body: {
  origin: { lat: number; lng: number };
  groveId: string;
  polyline?: string;
}) {
  const lat = String(body.origin.lat);
  const lng = String(body.origin.lng);
  for (const line of logs) {
    expect(line).not.toContain(lat);
    expect(line).not.toContain(lng);
    expect(line).not.toContain(body.groveId);
    if (body.polyline) expect(line).not.toContain(body.polyline);
  }
}

function baseDeps(overrides: Partial<EmbarkDeps> = {}): {
  deps: EmbarkDeps;
  logs: string[];
  fetches: { url: string; init: RequestInit }[];
} {
  const logs: string[] = [];
  const fetches: { url: string; init: RequestInit }[] = [];
  const deps: EmbarkDeps = {
    fetch: async (input, init) => {
      fetches.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify(walkRoutesBody()), { status: 200 });
    },
    deviceExists: async () => true,
    rateAllow: async () => true,
    lookupOpening: async () => OPENING,
    routesBaseUrl: "http://routes.test",
    routesApiKey: "test-key",
    log: (deviceId, outcome, mode) => {
      logs.push(formatEmbarkLog(deviceId, outcome, mode));
    },
    ...overrides,
  };
  return { deps, logs, fetches };
}

describe("embark schemas", () => {
  it("refuses drive and unknown modes", () => {
    expect(
      EmbarkRequest.safeParse({
        deviceId: "11111111-1111-4111-8111-111111111111",
        groveId: GROVE_ID,
        mode: "drive",
        origin: ORIGIN,
      }).success,
    ).toBe(false);
    expect(
      EmbarkRequest.safeParse({
        deviceId: "11111111-1111-4111-8111-111111111111",
        groveId: GROVE_ID,
        mode: "TWO_WHEELER",
        origin: ORIGIN,
      }).success,
    ).toBe(false);
  });

  it("defaults lang to en", () => {
    const parsed = EmbarkRequest.parse({
      deviceId: "11111111-1111-4111-8111-111111111111",
      groveId: GROVE_ID,
      mode: "walk",
      origin: ORIGIN,
    });
    expect(parsed.lang).toBe("en");
  });
});

describe("google mapping", () => {
  it("maps travelMode and field masks per mode", () => {
    for (const mode of ["walk", "bike", "transit"] as const) {
      const built = buildComputeRoutesRequest({
        mode,
        origin: ORIGIN,
        destination: OPENING,
        languageCode: "es",
      });
      expect(built.travelMode).toBe(TRAVEL_MODE[mode]);
      expect(built.fieldMask).toBe(fieldMaskFor(mode));
      expect(built.body.languageCode).toBe("es");
      expect(built.body.units).toBe("METRIC");
      if (mode === "transit") {
        expect(built.fieldMask).toContain("transitDetails");
      } else {
        expect(built.fieldMask).not.toContain("transitDetails");
      }
    }
  });

  it("maps transit steps and keeps a step with a missing stop name (R1)", () => {
    const full = mapComputeRoutesResponse(transitRoutesBody(), "transit");
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const parsed = EmbarkResponse.parse(full.response);
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps?.[0]).toMatchObject({
      kind: "walk",
      polyline: POLYLINE_TRANSIT_WALK,
    });
    expect(parsed.steps?.[1]).toMatchObject({
      kind: "transit",
      polyline: POLYLINE_TRANSIT_RIDE,
      departureStop: "Farmington Station",
      stopCount: 4,
    });

    const partial = mapComputeRoutesResponse(
      transitRoutesBody({ omitStopName: true }),
      "transit",
    );
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    const step = EmbarkResponse.parse(partial.response).steps?.[1];
    expect(step?.kind).toBe("transit");
    if (step?.kind === "transit") {
      expect(step.departureStop).toBeUndefined();
      expect(step.arrivalStop).toBe("Refuge Gate");
    }
  });
});

describe("handleEmbark", () => {
  const deviceId = "11111111-1111-4111-8111-111111111111";

  it("sends the right travelMode and field mask for each mode", async () => {
    for (const mode of ["walk", "bike", "transit"] as const) {
      const body =
        mode === "walk"
          ? walkRoutesBody()
          : mode === "bike"
            ? bikeRoutesBody()
            : transitRoutesBody();
      const localFetches: { url: string; init: RequestInit }[] = [];
      const localLogs: string[] = [];
      const { deps } = baseDeps();
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode, origin: ORIGIN, lang: "en" },
        {
          ...deps,
          fetch: async (input, init) => {
            localFetches.push({ url: String(input), init: init ?? {} });
            return new Response(JSON.stringify(body), { status: 200 });
          },
          log: (id, outcome, m) => {
            localLogs.push(formatEmbarkLog(id, outcome, m));
          },
        },
      );
      expect(res.status).toBe(200);
      const init = localFetches[0]?.init;
      expect(init?.headers).toMatchObject({
        "X-Goog-FieldMask": fieldMaskFor(mode),
        "X-Goog-Api-Key": "test-key",
      });
      const sent = JSON.parse(String(init?.body)) as { travelMode: string };
      expect(sent.travelMode).toBe(TRAVEL_MODE[mode]);
      logsSafe(localLogs, {
        origin: ORIGIN,
        groveId: GROVE_ID,
        polyline: POLYLINE_WALK,
      });
      expect(localLogs.some((l) => l.includes("ok"))).toBe(true);
    }
  });

  it("refuses drive before any fetch", async () => {
    const fetchFn = vi.fn();
    const { deps, logs } = baseDeps({ fetch: fetchFn });
    const res = await handleEmbark(
      { deviceId, groveId: GROVE_ID, mode: "drive", origin: ORIGIN },
      deps,
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: "invalid body" }));
    expect(text).not.toContain("issue");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(logs.join("\n")).toContain("invalid-body");
  });

  it("returns 400 invalid body without zod details (R2)", async () => {
    const { deps, logs } = baseDeps();
    const res = await handleEmbark(
      {
        deviceId,
        groveId: GROVE_ID,
        mode: "walk",
        origin: { lat: ORIGIN.lat, lng: "bad" },
      },
      deps,
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: "invalid body" }));
    expect(text).not.toContain(String(ORIGIN.lat));
    expect(text).not.toContain("Expected");
    expect(logs).toEqual(["embark invalid-body"]);
  });

  it("returns 500 internal without error details when a dep throws (R2)", async () => {
    const { deps, logs } = baseDeps({
      deviceExists: async () => {
        throw new Error(`failed for grove ${GROVE_ID} at ${ORIGIN.lat}`);
      },
    });
    const res = await handleEmbark(
      { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
      deps,
    );
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: "internal" }));
    expect(text).not.toContain(GROVE_ID);
    expect(text).not.toContain(String(ORIGIN.lat));
    expect(logs.join("\n")).not.toContain(GROVE_ID);
    expect(logs.join("\n")).not.toContain(String(ORIGIN.lat));
    expect(logs.some((l) => l.includes("internal-error"))).toBe(true);
  });

  it("unregistered → 403, rate limit → 429, no opening → 404, too far → 400", async () => {
    {
      const { deps, logs } = baseDeps({ deviceExists: async () => false });
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
        deps,
      );
      expect(res.status).toBe(403);
      expect(logs.some((l) => l.includes("unregistered"))).toBe(true);
      logsSafe(logs, { origin: ORIGIN, groveId: GROVE_ID });
    }
    {
      const { deps, logs } = baseDeps({ rateAllow: async () => false });
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode: "bike", origin: ORIGIN },
        deps,
      );
      expect(res.status).toBe(429);
      expect(logs.some((l) => l.includes("rate-limited"))).toBe(true);
    }
    {
      const { deps, logs } = baseDeps({ lookupOpening: async () => null });
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
        deps,
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "no opening" });
      expect(logs.some((l) => l.includes("no-opening"))).toBe(true);
    }
    {
      const { deps, logs } = baseDeps();
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode: "walk", origin: FAR_ORIGIN },
        deps,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "origin too far" });
      expect(logs.some((l) => l.includes("too-far"))).toBe(true);
      logsSafe(logs, { origin: FAR_ORIGIN, groveId: GROVE_ID });
    }
  });

  it("Google 500 and timeout → 502 without Google body (R2)", async () => {
    {
      const { deps, logs } = baseDeps({
        fetch: async () =>
          new Response(JSON.stringify({ error: { message: "boom-secret" } }), {
            status: 500,
          }),
      });
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
        deps,
      );
      expect(res.status).toBe(502);
      const text = await res.text();
      expect(text).toBe(JSON.stringify({ error: "route unavailable" }));
      expect(text).not.toContain("boom-secret");
      expect(logs.join("\n")).not.toContain("boom-secret");
      expect(logs.some((l) => l.includes("upstream-error"))).toBe(true);
    }
    {
      const { deps, logs } = baseDeps({
        fetch: async () => {
          throw new DOMException("The operation was aborted.", "AbortError");
        },
      });
      const res = await handleEmbark(
        { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
        deps,
      );
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "route unavailable" });
      expect(logs.some((l) => l.includes("upstream-error"))).toBe(true);
    }
  });

  it("empty routes → 404 no route", async () => {
    const { deps, logs } = baseDeps({
      fetch: async () => new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    });
    const res = await handleEmbark(
      { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
      deps,
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no route" });
    expect(logs.some((l) => l.includes("no-route"))).toBe(true);
  });

  it("walk happy path response shape", async () => {
    const { deps } = baseDeps({
      fetch: async () =>
        new Response(JSON.stringify(walkRoutesBody()), { status: 200 }),
    });
    const res = await handleEmbark(
      { deviceId, groveId: GROVE_ID, mode: "walk", origin: ORIGIN },
      deps,
    );
    expect(res.status).toBe(200);
    const body = EmbarkResponse.parse(await res.json());
    expect(body).toMatchObject({
      mode: "walk",
      distanceM: 2400,
      durationS: 1200,
      polyline: POLYLINE_WALK,
    });
    expect(body.steps).toBeUndefined();
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it("bike happy path", async () => {
    const { deps } = baseDeps({
      fetch: async () =>
        new Response(JSON.stringify(bikeRoutesBody()), { status: 200 }),
    });
    const res = await handleEmbark(
      { deviceId, groveId: GROVE_ID, mode: "bike", origin: ORIGIN },
      deps,
    );
    const body = EmbarkResponse.parse(await res.json());
    expect(body.polyline).toBe(POLYLINE_BIKE);
    expect(body.mode).toBe("bike");
  });
});
