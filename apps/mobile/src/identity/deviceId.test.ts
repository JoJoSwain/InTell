import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { getKv } from "../db/repos";
import { getOrCreateDeviceId, logDevice } from "./deviceId";
import { noopRegistrar, registerIfNeeded } from "./register";

test("device id is created once and logs only a prefix", async () => {
  const saved = new Map<string, string>();
  const store = {
    get: async (key: string) => saved.get(key) ?? null,
    set: async (key: string, value: string) => {
      saved.set(key, value);
    },
  };
  const id = "12345678-1234-4123-8123-123456789abc";
  const lines: string[] = [];
  const first = await getOrCreateDeviceId(store, () => id);
  const second = await getOrCreateDeviceId(store, () => "other-id-should-not-be-used");
  logDevice(first, (line) => lines.push(line));
  expect(second).toBe(id);
  expect(lines).toEqual(["device 12345678"]);
  expect(lines.join(" ")).not.toContain(id);
});

test("the noop registrar does not record a version", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  await registerIfNeeded({
    db,
    registrar: noopRegistrar,
    input: { deviceId: "12345678-1234-4123-8123-123456789abc", platform: "android", appVersion: "0.0.0", language: "en" },
  });
  expect(await getKv(db, "last_registered_app_version")).toBeNull();
  await db.close();
});
