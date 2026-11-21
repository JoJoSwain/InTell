/**
 * Supabase API keys (new publishable/secret + legacy anon/service_role fallbacks).
 * Never log key material.
 */

export type EnvGet = (name: string) => string | undefined;

function readEnv(name: string, getEnv: EnvGet): string | undefined {
  const v = getEnv(name);
  if (v === undefined || v === null) return undefined;
  const trimmed = String(v).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Parse a JSON object of name → key; ignore non-objects and non-string values. */
export function parseKeyMapJson(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim().length > 0) {
        out[name] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

const defaultGetEnv: EnvGet = (name) => Deno.env.get(name) ?? undefined;

/**
 * Every secret key value from SUPABASE_SECRET_KEYS (JSON name→key),
 * plus SUPABASE_SERVICE_ROLE_KEY when set (legacy / local / CI).
 */
export function secretKeys(getEnv: EnvGet = defaultGetEnv): string[] {
  const map = parseKeyMapJson(readEnv("SUPABASE_SECRET_KEYS", getEnv));
  const values = Object.values(map);
  const legacy = readEnv("SUPABASE_SERVICE_ROLE_KEY", getEnv);
  if (legacy && !values.includes(legacy)) values.push(legacy);
  return values;
}

/** Preferred outbound service key: SUPABASE_SECRET_KEYS.default, else legacy. */
export function serviceKey(getEnv: EnvGet = defaultGetEnv): string {
  const map = parseKeyMapJson(readEnv("SUPABASE_SECRET_KEYS", getEnv));
  const fromDefault = map.default?.trim();
  if (fromDefault) return fromDefault;
  return readEnv("SUPABASE_SERVICE_ROLE_KEY", getEnv) ?? "";
}

/** Publishable (or legacy anon) key for user-scoped clients. */
export function publishableKey(getEnv: EnvGet = defaultGetEnv): string {
  const map = parseKeyMapJson(readEnv("SUPABASE_PUBLISHABLE_KEYS", getEnv));
  const fromDefault = map.default?.trim();
  if (fromDefault) return fromDefault;
  return readEnv("SUPABASE_ANON_KEY", getEnv) ?? "";
}

/** Replace any known key substrings so logs never carry secrets. */
export function redactSecrets(
  message: string,
  getEnv: EnvGet = defaultGetEnv,
): string {
  let out = message;
  const material = [...secretKeys(getEnv), publishableKey(getEnv)].filter(
    (k) => k.length > 0,
  );
  for (const key of material) {
    if (out.includes(key)) {
      out = out.split(key).join("[redacted]");
    }
  }
  return out;
}

/** Log a message after redacting known key material. Never logs raw keys. */
export function safeLog(
  message: string,
  log: (line: string) => void = console.log,
  getEnv: EnvGet = defaultGetEnv,
): void {
  log(redactSecrets(message, getEnv));
}
