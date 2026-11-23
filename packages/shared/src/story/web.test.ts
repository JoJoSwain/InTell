import { describe, expect, it } from "vitest";
import { groveShape } from "../geo/groveShape";
import { distanceMeters, type GeoJsonPolygon } from "../geo/polygon";
import {
  CROSS_LINK_TIP_M,
  crossGroveLinks,
  crossLinkTip,
  storyWebLinks,
} from "./web";

const square: GeoJsonPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-111.9, 40.98],
      [-111.899, 40.98],
      [-111.899, 40.981],
      [-111.9, 40.981],
      [-111.9, 40.98],
    ],
  ],
};

describe("storyWebLinks", () => {
  it("draws from the prerequisite, drops retired ends, and skips a foreign member", () => {
    const links = storyWebLinks([
      { id: "b", retired: false, requires: [["a"], ["a"]] },
      { id: "a", retired: false, requires: [] },
      { id: "c", retired: true, requires: [["a"]] },
      { id: "d", retired: false, requires: [["missing"], ["b"]] },
    ]);
    expect(links).toEqual([
      { fromId: "a", toId: "b" },
      { fromId: "b", toId: "d" },
    ]);
  });
});

describe("crossLinkTip", () => {
  const from = { lat: 40.9805, lng: -111.8995 };
  const toward = { lat: 40.97, lng: -111.8995 };

  it("stops 100 ft past the last exit and never past toward", () => {
    const tip = crossLinkTip(square, from, toward);
    expect(tip).not.toBeNull();
    const exit = { lat: 40.98, lng: -111.8995 };
    const past = distanceMeters(exit, tip!);
    expect(past).toBeGreaterThan(CROSS_LINK_TIP_M - 2);
    expect(past).toBeLessThan(CROSS_LINK_TIP_M + 2);
    expect(distanceMeters(from, tip!)).toBeLessThan(distanceMeters(from, toward));
  });

  it("stops at the other grove when that edge is sooner", () => {
    const other: GeoJsonPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [-111.8996, 40.9799],
          [-111.8994, 40.9799],
          [-111.8994, 40.9797],
          [-111.8996, 40.9797],
          [-111.8996, 40.9799],
        ],
      ],
    };
    const tip = crossLinkTip(square, from, toward, other);
    expect(tip).not.toBeNull();
    expect(distanceMeters({ lat: 40.9799, lng: -111.8995 }, tip!)).toBeLessThan(3);
  });

  it("stops at toward when the other fragment is closer than 100 ft", () => {
    const close = { lat: 40.97995, lng: -111.8995 };
    const tip = crossLinkTip(square, from, close);
    expect(tip).toEqual({
      lat: Math.round(close.lat * 1e7) / 1e7,
      lng: Math.round(close.lng * 1e7) / 1e7,
    });
  });

  it("returns toward when the segment never leaves, and null when the points coincide", () => {
    const inside = { lat: 40.9802, lng: -111.8995 };
    expect(crossLinkTip(square, from, inside)).toEqual({
      lat: Math.round(inside.lat * 1e7) / 1e7,
      lng: Math.round(inside.lng * 1e7) / 1e7,
    });
    expect(crossLinkTip(square, from, from)).toBeNull();
  });
});

describe("crossGroveLinks", () => {
  it("emits one link each way and the same JSON twice", () => {
    const a = groveShape([{ id: "a1", tier: "root", lat: 40.98, lng: -111.9 }])!;
    const b = groveShape([{ id: "b1", tier: "root", lat: 40.985, lng: -111.9 }])!;
    const fragments = [
      { id: "b1", groveId: "B", retired: false, lat: 40.985, lng: -111.9, requires: [["a1"]] },
      { id: "a1", groveId: "A", retired: false, lat: 40.98, lng: -111.9, requires: [] },
      { id: "a2", groveId: "A", retired: false, lat: 40.9802, lng: -111.9002, requires: [["b1"]] },
    ];
    const boundaries = [
      { groveId: "A", boundary: a },
      { groveId: "B", boundary: b },
    ];
    const fromA = crossGroveLinks("A", fragments, boundaries);
    const fromB = crossGroveLinks("B", fragments, boundaries);
    expect(fromA.map((link) => link.direction).sort()).toEqual(["requires", "unlocks"]);
    expect(fromB.map((link) => link.direction).sort()).toEqual(["requires", "unlocks"]);
    expect(JSON.stringify(crossGroveLinks("A", fragments, boundaries))).toBe(
      JSON.stringify(fromA),
    );
    expect(fromA.every((link) => link.tip.lat !== 0)).toBe(true);
  });

  it("skips a retired end", () => {
    const a = groveShape([{ id: "a1", tier: "root", lat: 40.98, lng: -111.9 }])!;
    const links = crossGroveLinks(
      "A",
      [
        { id: "a1", groveId: "A", retired: true, lat: 40.98, lng: -111.9, requires: [] },
        { id: "b1", groveId: "B", retired: false, lat: 40.99, lng: -111.9, requires: [["a1"]] },
      ],
      [{ groveId: "A", boundary: a }],
    );
    expect(links).toEqual([]);
  });
});
