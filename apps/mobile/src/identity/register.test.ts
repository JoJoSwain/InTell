import { migrate } from "../db/migrate";
import { openNodeSqlite } from "../db/nodeSqlite";
import { getKv } from "../db/repos";
import { httpRegistrar, registerIfNeeded, startRegistration } from "./register";

const DEVICE = "12345678-1234-4123-8123-123456789abc";
const input = {
  deviceId: DEVICE,
  platform: "android" as const,
  appVersion: "1.0.0",
  uiLanguage: "en" as const,
};

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, firstSeenAt: "2026-11-22T20:00:00.000Z" }),
  } as Response;
}

test("registers once per version", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    return okResponse();
  }) as typeof fetch;
  const registrar = httpRegistrar({
    supabaseUrl: "http://127.0.0.1:54321",
    publishableKey: "publishable",
    fetchImpl,
  });
  await registerIfNeeded({ db, registrar, input });
  await registerIfNeeded({ db, registrar, input });
  expect(calls).toHaveLength(1);
  expect(await getKv(db, "last_registered_app_version")).toBe("1.0.0");
  await registerIfNeeded({ db, registrar, input: { ...input, appVersion: "1.1.0" } });
  expect(calls).toHaveLength(2);
  expect(await getKv(db, "last_registered_app_version")).toBe("1.1.0");
  await db.close();
});

test("does not record the version on failure", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts += 1;
    throw new Error("offline");
  }) as typeof fetch;
  const registrar = httpRegistrar({
    supabaseUrl: "http://127.0.0.1:54321",
    publishableKey: "publishable",
    fetchImpl,
  });
  await registerIfNeeded({ db, registrar, input });
  expect(await getKv(db, "last_registered_app_version")).toBeNull();
  await registerIfNeeded({ db, registrar, input });
  expect(attempts).toBe(2);
  await db.close();
});

test("handles 429 without logging the full device id", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  const lines: string[] = [];
  const fetchImpl = (async () => ({ ok: false, status: 429, json: async () => ({ error: DEVICE }) }) as Response) as typeof fetch;
  const registrar = httpRegistrar({
    supabaseUrl: "http://127.0.0.1:54321",
    publishableKey: "publishable",
    fetchImpl,
    log: (line) => lines.push(line),
  });
  await registerIfNeeded({ db, registrar, input });
  expect(await getKv(db, "last_registered_app_version")).toBeNull();
  expect(lines).toEqual(["device 12345678"]);
  expect(lines.join(" ")).not.toContain(DEVICE);
  await db.close();
});

test("a hung fetch resolves registered false after the timeout", async () => {
  jest.useFakeTimers();
  const db = openNodeSqlite();
  await migrate(db);
  try {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      })) as typeof fetch;
    const registrar = httpRegistrar({
      supabaseUrl: "http://127.0.0.1:54321",
      publishableKey: "publishable",
      fetchImpl,
    });
    const pending = registrar.register(input);
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toEqual({ registered: false });
    const again = registerIfNeeded({ db, registrar, input });
    await jest.advanceTimersByTimeAsync(10_000);
    await again;
    expect(await getKv(db, "last_registered_app_version")).toBeNull();
  } finally {
    jest.useRealTimers();
    await db.close();
  }
});

test("boot finishes without waiting for registration", async () => {
  const db = openNodeSqlite();
  await migrate(db);
  let resolveRegister: (value: { registered: boolean }) => void = () => undefined;
  const gate = new Promise<{ registered: boolean }>((resolve) => {
    resolveRegister = resolve;
  });
  startRegistration({
    db,
    registrar: {
      register: () => gate,
    },
    input,
  });
  expect(await getKv(db, "last_registered_app_version")).toBeNull();
  resolveRegister({ registered: true });
  await gate;
  await new Promise((resolve) => setImmediate(resolve));
  expect(await getKv(db, "last_registered_app_version")).toBe("1.0.0");
  await db.close();
});
