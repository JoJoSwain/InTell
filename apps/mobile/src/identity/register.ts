import type { SqlDriver } from "../db/driver";
import { getKv, setKv } from "../db/repos";

export type RegisterInput = {
  deviceId: string;
  platform: string;
  appVersion: string;
  language: string;
};

export type DeviceRegistrar = {
  register(input: RegisterInput): Promise<{ registered: boolean }>;
};

/** Used until A1's register-device function is on master. */
export const noopRegistrar: DeviceRegistrar = {
  async register() {
    return { registered: false };
  },
};

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
