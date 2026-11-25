import { describe, expect, it } from "vitest";
import {
  EVENT_NAMES,
  EVENT_SCHEMA_VERSION,
  IngestEventsRequest,
  IngestEventsResponse,
  isFutureDated,
  makeEvent,
  parseTelemetryEvent,
} from "./events";

const id = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const occurredAt = "2026-06-15T18:00:00.000Z";

describe("EVENT_NAMES", () => {
  it("matches TECH_SPEC §8 (no pre-ADR-0004 leftovers)", () => {
    expect(EVENT_NAMES).toContain("fragment_completed");
    expect(EVENT_NAMES).toContain("fragment_unlocked");
    expect(EVENT_NAMES).toContain("teaser_opened");
    expect(EVENT_NAMES).toContain("chronicle_opened");
    expect(EVENT_NAMES).toContain("entry_submitted");
    expect(EVENT_NAMES).not.toContain("fragment_heard");
    expect(EVENT_NAMES).not.toContain("seed_planted");
    expect(EVENT_NAMES).not.toContain("vote_cast");
  });
});

describe("parseTelemetryEvent", () => {
  it("accepts a valid fragment_completed", () => {
    const result = parseTelemetryEvent({
      v: EVENT_SCHEMA_VERSION,
      clientEventId: id,
      name: "fragment_completed",
      occurredAt,
      fragmentId: id,
      sessionId: id,
      props: { time_window: "day", change_kind: "contingency" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.props).toEqual({
        time_window: "day",
        change_kind: "contingency",
      });
    }
  });

  it("allows null change_kind", () => {
    const result = parseTelemetryEvent({
      v: 1,
      clientEventId: id,
      name: "fragment_completed",
      occurredAt,
      props: { time_window: "night", change_kind: null },
    });
    expect(result.ok).toBe(true);
  });

  it("drops unknown names, bad versions, and invalid props", () => {
    expect(
      parseTelemetryEvent({
        v: 1,
        clientEventId: id,
        name: "seed_planted",
        occurredAt,
        props: {},
      }),
    ).toMatchObject({ ok: false, reason: "unknown_name" });
    expect(
      parseTelemetryEvent({
        v: 99,
        clientEventId: id,
        name: "app_opened",
        occurredAt,
        props: {},
      }),
    ).toMatchObject({ ok: false, reason: "bad_version" });
    expect(
      parseTelemetryEvent({
        v: 1,
        clientEventId: id,
        name: "fragment_completed",
        occurredAt,
        props: { fragment_id: id },
      }),
    ).toMatchObject({ ok: false, reason: "invalid_props" });
    expect(
      parseTelemetryEvent({
        v: 1,
        clientEventId: id,
        name: "grove_entered",
        occurredAt,
        props: { grove_id: id },
      }),
    ).toMatchObject({ ok: false, reason: "invalid_props" });
  });

  it("rejects coordinates-shaped free props on empty events", () => {
    expect(
      parseTelemetryEvent({
        v: 1,
        clientEventId: id,
        name: "app_opened",
        occurredAt,
        props: { lat: 40.9, lng: -111.9 },
      }),
    ).toMatchObject({ ok: false, reason: "invalid_props" });
  });
});

describe("makeEvent", () => {
  it("builds a typed pack_downloaded with refs", () => {
    const event = makeEvent(
      "pack_downloaded",
      { scope: "grove", bytes: 1200 },
      { groveId: id },
      { clientEventId: id, occurredAt },
    );
    expect(event).toMatchObject({
      v: 1,
      name: "pack_downloaded",
      groveId: id,
      props: { scope: "grove", bytes: 1200 },
    });
  });

  it("allows character_id in character_opened props (G14)", () => {
    const event = makeEvent(
      "character_opened",
      { character_id: id },
      {},
      { clientEventId: id, occurredAt },
    );
    expect(event.props).toEqual({ character_id: id });
  });
});

describe("isFutureDated", () => {
  it("flags events more than 24 h ahead", () => {
    const now = new Date("2026-06-15T18:00:00.000Z");
    expect(isFutureDated("2026-06-16T19:00:00.000Z", now)).toBe(true);
    expect(isFutureDated("2026-06-16T17:00:00.000Z", now)).toBe(false);
    expect(isFutureDated("2020-01-01T00:00:00.000Z", now)).toBe(false);
  });
});

describe("ingest envelope schemas", () => {
  it("caps the batch at 200 and requires a uuid v4 deviceId", () => {
    expect(
      IngestEventsRequest.safeParse({
        deviceId: id,
        events: [],
      }).success,
    ).toBe(true);
    expect(
      IngestEventsRequest.safeParse({
        deviceId: "not-a-uuid",
        events: [],
      }).success,
    ).toBe(false);
    expect(
      IngestEventsRequest.safeParse({
        deviceId: id,
        events: Array.from({ length: 201 }, () => ({})),
      }).success,
    ).toBe(false);
  });

  it("parses the G6 response shape", () => {
    const parsed = IngestEventsResponse.parse({
      accepted: 2,
      duplicates: 1,
      dropped: [{ clientEventId: id, reason: "future_dated" }],
    });
    expect(parsed.dropped[0]?.reason).toBe("future_dated");
  });
});
