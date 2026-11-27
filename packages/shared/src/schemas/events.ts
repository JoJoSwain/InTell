import { z } from "zod";

/** Wire + DB schema version for telemetry events (A7 / G1). */
export const EVENT_SCHEMA_VERSION = 1 as const;

/** RFC 4122 UUID version 4 — device_id bearer secret shape. */
const UuidV4 = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "uuid v4",
  );

const Uuid = z.string().uuid();

const TimeWindow = z.enum(["day", "night"]);
const ChangeKind = z.enum(["contingency", "correction"]);
const TriggerVia = z.enum(["proximity", "scan", "accessible"]);
const AudioRoute = z.enum(["headphones", "bluetooth", "speaker", "unknown"]);
const MixerBus = z.enum(["story", "music", "surroundings"]);
const PackScope = z.enum(["grove", "region"]);
const EntryKind = z.enum(["next", "character", "noticed", "answer", "memory"]);

const emptyProps = z.object({}).strict();

/**
 * Per-name props (TECH_SPEC §8 + A7 plan review).
 * Ids belong in envelope refs, never in props — except character_opened (G14).
 */
export const eventPropsSchemas = {
  app_opened: emptyProps,
  pack_downloaded: z
    .object({
      scope: PackScope,
      bytes: z.number().int().nonnegative(),
    })
    .strict(),
  grove_entered: emptyProps,
  session_started: emptyProps,
  session_ended: z
    .object({
      fragments_completed: z.number().int().nonnegative(),
      minutes: z.number().int().nonnegative(),
    })
    .strict(),
  fragment_triggered: z
    .object({
      trigger: TriggerVia,
      time_window: TimeWindow,
    })
    .strict(),
  fragment_completed: z
    .object({
      time_window: TimeWindow,
      change_kind: ChangeKind.nullable(),
    })
    .strict(),
  fragment_unlocked: emptyProps,
  teaser_opened: emptyProps,
  growth_moment_played: emptyProps,
  hush_started: emptyProps,
  hush_skipped: emptyProps,
  mixer_changed: z.object({ bus: MixerBus }).strict(),
  route_changed: z.object({ route: AudioRoute }).strict(),
  chronicle_opened: emptyProps,
  character_opened: z.object({ character_id: Uuid }).strict(),
  replay_played: z
    .object({
      scope: z.literal("fragment"),
      time_window: TimeWindow,
    })
    .strict(),
  show_on_map_tapped: emptyProps,
  journal_opened: emptyProps,
  entry_submitted: z
    .object({
      kind: EntryKind,
      on_site: z.boolean(),
      voice: z.boolean(),
    })
    .strict(),
  question_viewed: emptyProps,
  checkin_submitted: emptyProps,
  checkin_skipped: emptyProps,
} as const;

export const EVENT_NAMES = Object.keys(eventPropsSchemas) as [
  keyof typeof eventPropsSchemas,
  ...(keyof typeof eventPropsSchemas)[],
];

export type EventName = keyof typeof eventPropsSchemas;

export type EventPropsFor<N extends EventName> = z.infer<
  (typeof eventPropsSchemas)[N]
>;

export const EventNameSchema = z.enum(
  EVENT_NAMES as unknown as [EventName, ...EventName[]],
);

/** Envelope refs — content / session ids only (G3). */
export const AnalyticsRefs = z
  .object({
    groveId: Uuid.optional(),
    fragmentId: Uuid.optional(),
    revisionId: Uuid.optional(),
    sessionId: Uuid.optional(),
  })
  .strict();

export type AnalyticsRefs = z.infer<typeof AnalyticsRefs>;

const TelemetryEventBase = z
  .object({
    v: z.literal(EVENT_SCHEMA_VERSION),
    clientEventId: Uuid,
    name: EventNameSchema,
    occurredAt: z.string().datetime({ offset: true }),
    groveId: Uuid.optional(),
    fragmentId: Uuid.optional(),
    revisionId: Uuid.optional(),
    sessionId: Uuid.optional(),
    props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();

export type TelemetryEvent = z.infer<typeof TelemetryEventBase> & {
  name: EventName;
};

export type DropReason =
  | "unknown_name"
  | "invalid_props"
  | "bad_version"
  | "future_dated";

export type ParseTelemetryResult =
  | { ok: true; event: TelemetryEvent }
  | { ok: false; reason: DropReason; clientEventId?: string };

function readClientEventId(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const id = (raw as { clientEventId?: unknown }).clientEventId;
  if (typeof id !== "string") return undefined;
  // Failure results only echo clientEventId when it is a real UUID.
  return Uuid.safeParse(id).success ? id : undefined;
}

/**
 * Validate one telemetry event. Unknown names / bad props / bad version are
 * soft failures for ingest (dropped); envelope shape is checked here too.
 */
export function parseTelemetryEvent(raw: unknown): ParseTelemetryResult {
  const clientEventId = readClientEventId(raw);
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid_props", clientEventId };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.v !== EVENT_SCHEMA_VERSION) {
    return { ok: false, reason: "bad_version", clientEventId };
  }
  if (
    typeof obj.name !== "string" ||
    !Object.prototype.hasOwnProperty.call(eventPropsSchemas, obj.name)
  ) {
    return { ok: false, reason: "unknown_name", clientEventId };
  }
  const name = obj.name as EventName;
  const propsParsed = eventPropsSchemas[name].safeParse(obj.props ?? {});
  if (!propsParsed.success) {
    return { ok: false, reason: "invalid_props", clientEventId };
  }
  const envelope = TelemetryEventBase.safeParse({
    ...obj,
    name,
    props: propsParsed.data,
  });
  if (!envelope.success) {
    return { ok: false, reason: "invalid_props", clientEventId };
  }
  return { ok: true, event: envelope.data as TelemetryEvent };
}

/** True when occurredAt is more than 24 h ahead of `now`. */
export function isFutureDated(
  occurredAtIso: string,
  now: Date = new Date(),
  maxFutureMs = 24 * 60 * 60 * 1000,
): boolean {
  const occurred = Date.parse(occurredAtIso);
  if (Number.isNaN(occurred)) return true;
  return occurred - now.getTime() > maxFutureMs;
}

function defaultCreateId(): string {
  return globalThis.crypto.randomUUID();
}

function defaultNowIso(): string {
  return new Date().toISOString();
}

/**
 * Typed builder for phone-emitted events (G4). Session machine builds its own
 * analytics effects; Lane B uses this for UI / audio / journal events.
 */
export function makeEvent<N extends EventName>(
  name: N,
  props: EventPropsFor<N>,
  refs: AnalyticsRefs = {},
  options: {
    clientEventId?: string;
    occurredAt?: string;
    createId?: () => string;
    nowIso?: () => string;
  } = {},
): TelemetryEvent {
  const propsParsed = eventPropsSchemas[name].parse(props);
  const refsParsed = AnalyticsRefs.parse(refs);
  const event: TelemetryEvent = {
    v: EVENT_SCHEMA_VERSION,
    clientEventId: options.clientEventId ?? (options.createId ?? defaultCreateId)(),
    name,
    occurredAt: options.occurredAt ?? (options.nowIso ?? defaultNowIso)(),
    props: propsParsed as TelemetryEvent["props"],
    ...refsParsed,
  };
  const checked = parseTelemetryEvent(event);
  if (!checked.ok) {
    throw new Error(`makeEvent produced invalid ${name}: ${checked.reason}`);
  }
  return checked.event;
}

export const IngestEventsRequest = z
  .object({
    deviceId: UuidV4,
    events: z.array(z.unknown()).max(200),
  })
  .strict();

export type IngestEventsRequest = z.infer<typeof IngestEventsRequest>;

export const IngestDrop = z
  .object({
    clientEventId: Uuid,
    reason: z.enum([
      "unknown_name",
      "invalid_props",
      "bad_version",
      "future_dated",
    ]),
  })
  .strict();

export const IngestEventsResponse = z
  .object({
    accepted: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    dropped: z.array(IngestDrop),
  })
  .strict();

export type IngestEventsResponse = z.infer<typeof IngestEventsResponse>;

/** @deprecated Use TelemetryEvent / parseTelemetryEvent. Kept name for imports. */
export const TelemetryEvent = TelemetryEventBase;
