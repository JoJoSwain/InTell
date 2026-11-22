import { RegisterDeviceRequest, RegisterDeviceResponse } from "@intell/shared";
import type { SqlDriver } from "../db/driver";
import { getKv, setKv } from "../db/repos";
import { logDevice } from "./deviceId";

export type RegisterInput = {
  deviceId: string;
  platform: "ios" | "android";
  appVersion: string;
  uiLanguage: "en" | "es";
};

export type DeviceRegistrar = {
  register(input: RegisterInput): Promise<{ registered: boolean }>;
};

/** Used when the publishable key is not configured. Records nothing. */
export const noopRegistrar: DeviceRegistrar = {
  async register() {
    return { registered: false };
  },
};

export function httpRegistrar(args: {
  supabaseUrl: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}): DeviceRegistrar {
  const fetchImpl = args.fetchImpl ?? fetch;
  return {
    async register(input) {
      const body = RegisterDeviceRequest.parse(input);
      const url = `${args.supabaseUrl.replace(/\/+$/, "")}/functions/v1/register-device`;
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            apikey: args.publishableKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (response.status === 429 || !response.ok) {
          if (args.log) logDevice(body.deviceId, args.log);
          return { registered: false };
        }
        const payload: unknown = await response.json();
        RegisterDeviceResponse.parse(payload);
        if (args.log) logDevice(body.deviceId, args.log);
        return { registered: true };
      } catch {
        if (args.log) logDevice(body.deviceId, args.log);
        return { registered: false };
      }
    },
  };
}

export async function registerIfNeeded(args: {
  db: SqlDriver;
  registrar: DeviceRegistrar;
  input: RegisterInput;
}): Promise<void> {
  const previous = await getKv(args.db, "last_registered_app_version");
  if (previous === args.input.appVersion) return;
  const result = await args.registrar.register(args.input);
  if (result.registered) await setKv(args.db, "last_registered_app_version", args.input.appVersion);
}
