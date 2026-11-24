import { z } from "zod";

/** RFC 4122 UUID version 4. */
const UuidV4 = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "uuid v4",
  );

const LatLng = z
  .object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  })
  .strict();

/** BCP-47 language tag (e.g. en, es, en-US). */
const Bcp47 = z
  .string()
  .min(2)
  .max(35)
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "bcp-47");

export const EmbarkMode = z.enum(["walk", "bike", "transit"]);
export type EmbarkMode = z.infer<typeof EmbarkMode>;

export const EmbarkRequest = z
  .object({
    deviceId: UuidV4,
    groveId: UuidV4,
    mode: EmbarkMode,
    origin: LatLng,
    /** Listener UI language → Google languageCode (N1). */
    lang: Bcp47.default("en"),
  })
  .strict();

export type EmbarkRequest = z.infer<typeof EmbarkRequest>;

export const EmbarkTransitLine = z
  .object({
    name: z.string().optional(),
    nameShort: z.string().optional(),
    color: z.string().optional(),
    textColor: z.string().optional(),
    vehicleType: z.string().optional(),
  })
  .strict();

export type EmbarkTransitLine = z.infer<typeof EmbarkTransitLine>;

export const EmbarkStep = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("walk"),
      distanceM: z.number().nonnegative(),
      durationS: z.number().nonnegative(),
      polyline: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("transit"),
      distanceM: z.number().nonnegative(),
      durationS: z.number().nonnegative(),
      polyline: z.string().min(1),
      line: EmbarkTransitLine,
      // R1: agency data varies; missing fields keep the step.
      departureStop: z.string().optional(),
      arrivalStop: z.string().optional(),
      departureTime: z.string().optional(),
      arrivalTime: z.string().optional(),
      stopCount: z.number().int().nonnegative().optional(),
    })
    .strict(),
]);

export type EmbarkStep = z.infer<typeof EmbarkStep>;

export const EmbarkResponse = z
  .object({
    mode: EmbarkMode,
    distanceM: z.number().nonnegative(),
    durationS: z.number().nonnegative(),
    polyline: z.string().min(1),
    steps: z.array(EmbarkStep).optional(),
    warnings: z.array(z.string()),
  })
  .strict();

export type EmbarkResponse = z.infer<typeof EmbarkResponse>;
