import { z } from "zod";

/** RFC 4122 UUID version 4. `device_id` is a bearer secret. */
const UuidV4 = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "uuid v4",
  );

export const DevicePlatform = z.enum(["ios", "android"]);
export const UiLanguage = z.enum(["en", "es"]);
export const AgeGate = z.enum([
  "under_13",
  "13_17",
  "18_plus",
  "adult_for_family",
]);

export const RegisterDeviceRequest = z
  .object({
    deviceId: UuidV4,
    platform: DevicePlatform,
    appVersion: z.string().max(32),
    uiLanguage: UiLanguage,
    ageGate: AgeGate.optional(),
  })
  .strict();

export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequest>;

export const RegisterDeviceResponse = z
  .object({
    ok: z.literal(true),
    firstSeenAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type RegisterDeviceResponse = z.infer<typeof RegisterDeviceResponse>;
