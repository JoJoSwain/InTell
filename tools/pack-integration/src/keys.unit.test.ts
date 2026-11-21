/**
 * Unit tests for supabase/functions/_shared/keys.ts (injectable env).
 * Deno global is stubbed so the module loads under Node/vitest.
 */
import { beforeAll, describe, expect, it } from "vitest";

type KeysMod = typeof import("../../../supabase/functions/_shared/keys.ts");

let keys: KeysMod;

beforeAll(async () => {
  (globalThis as { Deno?: { env: { get: (name: string) => string | undefined } } }).Deno = {
    env: { get: () => undefined },
  };
  keys = await import("../../../supabase/functions/_shared/keys.ts");
});

describe("keys.ts", () => {
  it("parseKeyMapJson reads name→key objects and ignores junk", () => {
    expect(keys.parseKeyMapJson(undefined)).toEqual({});
    expect(keys.parseKeyMapJson("not-json")).toEqual({});
    expect(keys.parseKeyMapJson('["a"]')).toEqual({});
    expect(
      keys.parseKeyMapJson(
        JSON.stringify({ default: " sb_secret_a ", other: "sb_secret_b", empty: "", n: 1 }),
      ),
    ).toEqual({ default: "sb_secret_a", other: "sb_secret_b" });
  });

  it("secretKeys merges SUPABASE_SECRET_KEYS with legacy SERVICE_ROLE_KEY", () => {
    const get = (name: string) => {
      if (name === "SUPABASE_SECRET_KEYS") {
        return JSON.stringify({ default: "secret-default", run_jobs: "secret-cron" });
      }
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return "legacy-service";
      return undefined;
    };
    expect(keys.secretKeys(get).sort()).toEqual(
      ["legacy-service", "secret-cron", "secret-default"].sort(),
    );
  });

  it("secretKeys does not duplicate when legacy equals a map value", () => {
    const get = (name: string) => {
      if (name === "SUPABASE_SECRET_KEYS") {
        return JSON.stringify({ default: "same-key" });
      }
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return "same-key";
      return undefined;
    };
    expect(keys.secretKeys(get)).toEqual(["same-key"]);
  });

  it("serviceKey prefers SECRET_KEYS.default then legacy", () => {
    expect(
      keys.serviceKey((n) =>
        n === "SUPABASE_SECRET_KEYS"
          ? JSON.stringify({ default: "from-default" })
          : n === "SUPABASE_SERVICE_ROLE_KEY"
            ? "legacy"
            : undefined,
      ),
    ).toBe("from-default");

    expect(
      keys.serviceKey((n) =>
        n === "SUPABASE_SERVICE_ROLE_KEY" ? "legacy-only" : undefined,
      ),
    ).toBe("legacy-only");
  });

  it("publishableKey prefers PUBLISHABLE_KEYS.default then ANON_KEY", () => {
    expect(
      keys.publishableKey((n) =>
        n === "SUPABASE_PUBLISHABLE_KEYS"
          ? JSON.stringify({ default: "pub-default" })
          : n === "SUPABASE_ANON_KEY"
            ? "anon"
            : undefined,
      ),
    ).toBe("pub-default");

    expect(
      keys.publishableKey((n) =>
        n === "SUPABASE_ANON_KEY" ? "anon-only" : undefined,
      ),
    ).toBe("anon-only");
  });

  it("safeLog redacts every known key from the logger path", () => {
    const secret = "sb_secret_super_secret_value";
    const pub = "sb_publishable_public_looking";
    const get = (name: string) => {
      if (name === "SUPABASE_SECRET_KEYS") {
        return JSON.stringify({ default: secret });
      }
      if (name === "SUPABASE_PUBLISHABLE_KEYS") {
        return JSON.stringify({ default: pub });
      }
      return undefined;
    };
    const lines: string[] = [];
    keys.safeLog(
      `call failed key=${secret} also=${pub} ok`,
      (line) => lines.push(line),
      get,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("call failed key=[redacted] also=[redacted] ok");
    expect(lines[0]).not.toContain(secret);
    expect(lines[0]).not.toContain(pub);
  });
});
