import { getTimes } from "suncalc";
import { resolveMapTheme } from "../theme/appearance";
import { piecesFromBoundary, pointInGrove, closeRing } from "./groves";
import { buildDemo } from "./fixtures";
import { modelsFromPacks } from "./homeModel";
import { MARKER_CANVAS_PT, canvasPx, markerImageName, pulseFrame, RING } from "./markerArt";
import { legacyPulse, markerLocked } from "./markers";
import { linkCoordinates, metersPerPoint, webStrength, webWeight } from "./web";
import dayStyle from "./styles/day.json";
import nightStyle from "./styles/night.json";

const sun = { lat: 40.76, lng: -111.89 };
const noon = new Date("2026-06-21T18:00:00Z");

describe("map theme", () => {
  const sunset = getTimes(noon, sun.lat, sun.lng).sunset;
  if (!sunset) throw new Error("sunset missing");

  it("follows the story across sunset when a region is installed", () => {
    const shared = {
      preference: "story" as const,
      hasRegion: true,
      sunReference: sun,
      timeZone: "America/Denver",
      phoneScheme: "light" as const,
    };
    expect(resolveMapTheme({ ...shared, at: new Date(sunset.getTime() - 60_000) })).toBe("day");
    expect(resolveMapTheme({ ...shared, at: new Date(sunset.getTime() + 60_000) })).toBe("night");
  });

  it("follows the phone even at noon", () => {
    expect(
      resolveMapTheme({
        preference: "phone",
        phoneScheme: "dark",
        hasRegion: true,
        at: noon,
        sunReference: sun,
        timeZone: "America/Denver",
      }),
    ).toBe("night");
  });

  it("follows the phone when no region is installed", () => {
    expect(
      resolveMapTheme({
        preference: "story",
        phoneScheme: "dark",
        hasRegion: false,
        at: noon,
        sunReference: null,
        timeZone: null,
      }),
    ).toBe("night");
  });
});

describe("marker adapter", () => {
  const shown = { opacity: 1 as const, hidden: false };

  it("maps the boolean pulse onto the stand-in kinds", () => {
    expect(legacyPulse({ ...shown, playableNow: true, pulse: false })).toBe("tier");
    expect(legacyPulse({ ...shown, playableNow: true, pulse: true })).toBe("changed");
    expect(legacyPulse({ ...shown, playableNow: false, pulse: false })).toBe("none");
    expect(legacyPulse({ opacity: 0.35, playableNow: false, pulse: false, hidden: false })).toBe("none");
    expect(markerLocked({ opacity: 0.35, playableNow: false, pulse: false, hidden: false })).toBe(true);
    expect(legacyPulse({ opacity: 0, playableNow: false, pulse: false, hidden: true })).toBe("none");
  });

  it("keeps a still ring when Reduce Motion is on", () => {
    expect(markerImageName("root", "day", "tier", 3, true)).toBe("root-day-ring");
    expect(markerImageName("leaf", "night", "changed", 4, false)).toBe("leaf-night-changed-4");
  });
});

describe("marker canvas", () => {
  it("uses one 48 pt canvas and a stable pulse size", () => {
    expect(MARKER_CANVAS_PT).toBeGreaterThanOrEqual(48);
    expect(canvasPx()).toBe(144);
    expect(RING.root.diameterPt).toBe(22);
    const start = pulseFrame("root", 0);
    const end = pulseFrame("root", 7);
    expect(start.radiusPt).toBeCloseTo((22 + 6) / 2);
    expect(end.radiusPt).toBeCloseTo((22 * 1.8) / 2);
    expect(end.opacity).toBe(0);
  });
});

describe("story web", () => {
  it("weights, strength, and trims change with zoom", () => {
    expect(webWeight("root", "branch")).toBe(1.5);
    expect(webWeight("branch", "leaf")).toBe(1);
    expect(webStrength(false)).toBe(0.85);
    expect(webStrength(true)).toBe(0.45);
    const at16 = metersPerPoint(40.7, 16);
    expect(at16).toBeCloseTo(1.811, 2);
    const wide = linkCoordinates({ lat: 40.7, lng: -111.9 }, { lat: 40.701, lng: -111.9 }, "root", "leaf", at16);
    const close = linkCoordinates(
      { lat: 40.7, lng: -111.9 },
      { lat: 40.701, lng: -111.9 },
      "root",
      "leaf",
      metersPerPoint(40.7, 18),
    );
    expect(wide).not.toBeNull();
    expect(close).not.toBeNull();
    if (!wide || !close) return;
    expect(close[0].lat - wide[0].lat).not.toBe(0);
  });
});

describe("grove chip", () => {
  const pieces = piecesFromBoundary({
    type: "MultiPolygon",
    coordinates: [
      [[[-111.9, 40.7], [-111.89, 40.7], [-111.89, 40.71], [-111.9, 40.71], [-111.9, 40.7]]],
      [[[-111.88, 40.7], [-111.87, 40.7], [-111.87, 40.71], [-111.88, 40.71], [-111.88, 40.7]]],
    ],
  });

  it("includes each island and excludes the gap", () => {
    expect(pointInGrove({ lat: 40.705, lng: -111.895 }, pieces)).toBe(true);
    expect(pointInGrove({ lat: 40.705, lng: -111.885 }, pieces)).toBe(false);
    expect(pointInGrove({ lat: 40.705, lng: -111.875 }, pieces)).toBe(true);
    const ring = closeRing([{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }]);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });
});

describe("map styles", () => {
  type StyleRule = {
    featureType?: string;
    elementType?: string;
    stylers: { visibility?: string; color?: string }[];
  };

  function hidden(style: StyleRule[], feature: string): boolean {
    return style.some(
      (rule) =>
        rule.featureType === feature &&
        rule.elementType === "labels" &&
        rule.stylers.some((item) => item.visibility === "off"),
    );
  }

  it("hides labels and keeps park geometry", () => {
    const styles: StyleRule[][] = [dayStyle as StyleRule[], nightStyle as StyleRule[]];
    for (const style of styles) {
      expect(hidden(style, "poi")).toBe(true);
      expect(hidden(style, "poi.business")).toBe(true);
      expect(hidden(style, "transit.station")).toBe(true);
      expect(
        style.some(
          (rule) =>
            rule.featureType === "transit" &&
            rule.elementType === "geometry" &&
            rule.stylers.some((item) => item.visibility === "off"),
        ),
      ).toBe(true);
      expect(
        style.some(
          (rule) =>
            rule.featureType === "poi" &&
            rule.elementType === undefined &&
            rule.stylers.some((item) => item.visibility === "off"),
        ),
      ).toBe(false);
      const park = style.find((rule) => rule.featureType === "poi.park" && rule.elementType === "geometry");
      expect(park?.stylers.some((item) => item.visibility === "off")).toBe(false);
      expect(park?.stylers.some((item) => item.visibility === "on")).toBe(true);
    }
    expect(dayStyle.find((rule) => rule.featureType === "poi.park")?.stylers).toEqual(
      expect.arrayContaining([{ color: "#E6EBDD" }]),
    );
    expect(nightStyle.find((rule) => rule.featureType === "poi.park")?.stylers).toEqual(
      expect.arrayContaining([{ color: "#224D69" }]),
    );
  });
});

describe("demo grove", () => {
  it("matches the marker states used on the dev screen", () => {
    const demo = buildDemo();
    const model = modelsFromPacks(
      [
        {
          scope: "grove",
          id: demo.grove.groveId,
          version: 1,
          manifest_json: JSON.stringify(demo.grove),
          installed_at: "2026-11-23T00:00:00Z",
        },
      ],
      demo.completions,
      [],
      "day",
    );
    const byCard = new Map(model.markers.map((marker) => [marker.card, marker]));
    expect(byCard.get("R1 teaser")).toMatchObject({ pulse: "tier", locked: false });
    expect(byCard.get("A later telling of the same place.")).toMatchObject({ pulse: "changed", locked: false });
    expect(byCard.get("B2 teaser")).toMatchObject({ pulse: "tier", locked: false });
    expect(byCard.get("L1 teaser")).toMatchObject({ pulse: "tier", locked: false });
    expect(byCard.get("B3 teaser")).toMatchObject({ pulse: "none", locked: false });
    expect(byCard.get("L2 teaser")).toMatchObject({ pulse: "none", locked: false });
    expect(byCard.get("R2 teaser")).toMatchObject({ pulse: "none", locked: true });
    expect(byCard.get("B4 teaser")).toMatchObject({ pulse: "none", locked: true });
    expect(byCard.get("L3 teaser")).toMatchObject({ pulse: "none", locked: true });
    expect(model.links.some((link) => link.weight === 1.5)).toBe(true);
  });
});
