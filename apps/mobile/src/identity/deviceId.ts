export type SecretStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

const DEVICE_KEY = "device_id";

export async function getOrCreateDeviceId(store: SecretStore, uuid: () => string): Promise<string> {
  const existing = await store.get(DEVICE_KEY);
  if (existing) return existing;
  const created = uuid();
  await store.set(DEVICE_KEY, created);
  return created;
}

export function redactDeviceId(deviceId: string): string {
  return deviceId.slice(0, 8);
}

/** Writes at most 8 characters of a device id. Throws if the line still contains the full id. */
export function logDevice(deviceId: string, write: (line: string) => void): void {
  const line = `device ${redactDeviceId(deviceId)}`;
  if (deviceId.length > 8 && line.includes(deviceId)) {
    throw new Error("refusing to log a full device id");
  }
  write(line);
}
