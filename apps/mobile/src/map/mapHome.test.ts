import { getTimes } from "suncalc";
import { resolveMapTheme } from "../theme/appearance";
import { piecesFromBoundary, pointInGrove, closeRing } from "./groves";
import { buildDemo } from "./fixtures";
import { modelsFromPacks, storyTimeWindow } from "./homeModel";
import {
  MARKER_CANVAS_PT,
  MAX_PULSING_ON_SCREEN,
  OUTLINE_FADE_MIN,
  canvasPx,
  markerImageName,
  outlineOpacity,
  pulseFrame,
  RING,
} from "./markerArt";
import { accessibilityLabel, markerLocked, markerPulse } from "./markers";
import { linkCoordinates, metersPerPoint, webStrength, webWeight } from "./web";
import dayStyle from "./styles/day.json";
import nightStyle from "./styles/night.json";
import { strings } from "../ui/strings";
import { tokens } from "../ui/tokens";

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

describe("story time window", () => {
  it("keeps day-window marker states when the phone theme is night", () => {
    expect(storyTimeWindow(noon, sun, "America/Denver")).toBe("day");
    expect(resolveMapTheme({
      preference: "phone",
      phoneScheme: "dark",
      hasRegion: true,
      at: noon,
      sunReference: sun,
      timeZone: "America/Denver",
    })).toBe("night");

    const demo = buildDemo();
    const dayModel = modelsFromPacks(
      [
        {
          scope: "grove",
          id: demo.grove.groveId,
          version: 1,
          manifest_json: JSON.stringify(demo.grove),
          installed_at: "2026-11-23T00:00:00Z",
        },
        {
          scope: "region",
          id: demo.region.regionId,
          version: 1,
          manifest_json: JSON.stringify(demo.region),
          installed_at: "2026-11-23T00:00:00Z",
        },
      ],
      demo.completions,
      [],
      storyTimeWindow(noon, sun, "America/Denver"),
    );
    const nightThemeWindow = modelsFromPacks(
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
      "night",
    );
    const dayR1 = dayModel.markers.find((marker) => marker.card === "R1 teaser");
    const wrongR1 = nightThemeWindow.markers.find((marker) => marker.card === "R1 teaser");
    expect(dayR1?.pulse).toBe("tier");
    expect(dayR1?.locked).toBe(false);
    // Night window still has versions, so playable markers stay playable; the
    // regression this guards is load(theme) when Follow-my-phone is dark by day.
    expect(wrongR1?.pulse).toBe("tier");
    expect(dayModel.markers.map((marker) => marker.id).sort()).toEqual(
      nightThemeWindow.markers.map((marker) => marker.id).sort(),
    );
  });
});

describe("marker pulse", () => {
  it("reads the A2 pulse kinds", () => {
    expect(markerPulse({ opacity: 1, playableNow: true, pulse: "tier", hidden: false })).toBe("tier");
    expect(markerPulse({ opacity: 1, playableNow: true, pulse: "changed", hidden: false })).toBe("changed");
    expect(markerPulse({ opacity: 1, playableNow: false, pulse: "none", hidden: false })).toBe("none");
    expect(markerLocked({ opacity: 0.35, playableNow: false, pulse: "none", hidden: false })).toBe(true);
  });

  it("uses a still brick or green ring for Reduce Motion and the pulse cap", () => {
    expect(markerImageName("root", "day", "tier", 3, { reduceMotion: true })).toBe("root-day-pulse-0");
    expect(markerImageName("leaf", "night", "changed", 4, { reduceMotion: true })).toBe(
      "leaf-night-changed-0",
    );
    expect(markerImageName("branch", "day", "tier", 5, { pulsesCapped: true })).toBe(
      "branch-day-pulse-0",
    );
    expect(markerImageName("leaf", "night", "changed", 4, {})).toBe("leaf-night-changed-4");
  });

  it("uses opaque locked images instead of marker opacity", () => {
    expect(markerImageName("root", "day", "none", 0, { locked: true })).toBe("root-day-locked");
    expect(markerImageName("leaf", "night", "tier", 2, { locked: true })).toBe("leaf-night-locked");
    expect(tokens.marker.day.lockedRing).toBe("#B0B4B8");
    expect(tokens.marker.night.lockedRing).toBe("#687B87");
    expect(tokens.marker.day.center).toBe("#FFFFFF");
    expect(tokens.marker.night.center).toBe("#163447");
  });

  it("pulses every unexplored tier in Root brick", () => {
    expect(tokens.marker.day.pulse).toBe("#763329");
    expect(tokens.marker.night.pulse).toBe("#B9574A");
    expect(tokens.marker.day.pulse).toBe(tokens.marker.day.root);
    expect(tokens.marker.night.pulse).toBe(tokens.marker.night.root);
  });

  it("builds a tier-and-state accessibility label", () => {
    expect(accessibilityLabel("root", "tier", false, "Begin near the refuge entrance.")).toBe(
      `${strings.tierRoot}, ${strings.stateUnexplored}. Begin near the refuge entrance.`,
    );
  });
});

describe("marker canvas", () => {
  it("uses one 48 pt canvas, 2.5 pt rings, and a stable pulse size", () => {
    expect(MARKER_CANVAS_PT).toBeGreaterThanOrEqual(48);
    expect(canvasPx()).toBe(144);
    expect(RING.root.diameterPt).toBe(22);
    expect(RING.root.strokePt).toBe(2.5);
    expect(RING.branch.strokePt).toBe(2.5);
    expect(RING.leaf.strokePt).toBe(2.5);
    const start = pulseFrame("root", 0);
    const end = pulseFrame("root", 7);
    expect(start.radiusPt).toBeCloseTo((22 + 6) / 2);
    expect(end.radiusPt).toBeCloseTo((22 * 1.8) / 2);
    expect(end.opacity).toBe(0);
    expect(MAX_PULSING_ON_SCREEN).toBe(40);
  });
});

describe("grove outline fade", () => {
  it("breathes from 100% to OUTLINE_FADE_MIN and back; Reduce Motion stays at 100%", () => {
    expect(OUTLINE_FADE_MIN).toBe(0.6);
    expect(outlineOpacity(0, false)).toBeCloseTo(1);
    expect(outlineOpacity(4, false)).toBeCloseTo(OUTLINE_FADE_MIN, 2);
    expect(outlineOpacity(0, true)).toBe(1);
    expect(outlineOpacity(4, true)).toBe(1);
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
  const boundary = {
    type: "MultiPolygon" as const,
    coordinates: [
      [[[-111.9, 40.7], [-111.89, 40.7], [-111.89, 40.71], [-111.9, 40.71], [-111.9, 40.7]]],
      [[[-111.88, 40.7], [-111.87, 40.7], [-111.87, 40.71], [-111.88, 40.71], [-111.88, 40.7]]],
    ],
  };

  it("includes each island and excludes the gap", () => {
    expect(pieces).toHaveLength(2);
    expect(pointInGrove({ lat: 40.705, lng: -111.895 }, boundary)).toBe(true);
    expect(pointInGrove({ lat: 40.705, lng: -111.885 }, boundary)).toBe(false);
    expect(pointInGrove({ lat: 40.705, lng: -111.875 }, boundary)).toBe(true);
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
    expect(dayStyle.some((rule) => rule.elementType === "labels.text.stroke")).toBe(true);
    expect(nightStyle.some((rule) => rule.elementType === "labels.text.stroke")).toBe(true);
  });
});

describe("demo grove", () => {
  it("matches the marker states used on the dev screen", () => {
    const demo = buildDemo();
    expect(demo.grove.schema).toBe(4);
    expect(demo.grove.grove.boundary.type).toBe("MultiPolygon");
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
    expect(byCard.get("R1 teaser")?.label).toContain(strings.stateUnexplored);
  });
});
