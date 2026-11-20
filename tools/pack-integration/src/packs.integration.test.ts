import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { GrovePack, RegionPack, canonicalJson } from "@intell/shared";
import { DEMO, supabaseEnv } from "./env";

const env = supabaseEnv();
const url = env.API_URL || env.SUPABASE_URL;
const serviceKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.ANON_KEY || env.SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  throw new Error("supabase status missing keys — run supabase start");
}

const svc = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function invoke(
  name: string,
  body: unknown,
  key: string = serviceKey!,
): Promise<Response> {
  return fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function runJobs(): Promise<void> {
  const res = await invoke("run-jobs", {});
  expect(res.status).toBe(200);
  // drain a few times for rebuild then purge
  for (let i = 0; i < 5; i++) {
    await invoke("run-jobs", {});
  }
}

async function fetchLatestGrovePack(): Promise<{
  pack: unknown;
  version: number;
  path: string;
  contentSha: string | null;
}> {
  const { data: build, error } = await svc
    .from("pack_builds")
    .select("*")
    .eq("scope", "grove")
    .eq("scope_id", DEMO.groveId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !build) throw new Error(`no grove pack: ${error?.message}`);
  const { data: blob, error: dl } = await svc.storage
    .from("public-media")
    .download(build.manifest_path);
  if (dl || !blob) throw new Error(`download ${build.manifest_path}: ${dl?.message}`);
  const text = await blob.text();
  return {
    pack: JSON.parse(text),
    version: build.version,
    path: build.manifest_path,
    contentSha: build.content_sha256,
  };
}

async function ensureEditor(): Promise<{ client: SupabaseClient; jwt: string }> {
  const email = `m2b-editor-${Date.now()}@test.local`;
  const password = "test-password-editor-1";
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(error?.message ?? "createUser");
  const { error: staffErr } = await svc.from("staff").insert({
    user_id: created.user.id,
    display_name: "M2b Editor",
    role: "editor",
    active: true,
  });
  if (staffErr) throw new Error(`staff insert: ${staffErr.message}`);

  // Sign in with a fresh anon client so we don't mutate the service client's session
  const authClient = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signErr } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !session.session) throw new Error(signErr?.message ?? "signIn");
  const jwt = session.session.access_token;

  const { data: ok, error: roleErr } = await authClient.rpc("fn_is_editor_or_admin");
  if (roleErr || !ok) {
    throw new Error(`editor gate failed: ${roleErr?.message ?? ok}`);
  }

  const client = createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  return { client, jwt };
}

describe("M2b pack integration", () => {
  beforeAll(async () => {
    // Build demo grove + region packs from seeded published content
    const g = await invoke("build-pack", { grove_id: DEMO.groveId, reason: "integration" });
    const body = await g.json();
    if (!g.ok) throw new Error(`build grove: ${JSON.stringify(body)}`);
    const r = await invoke("build-pack", {
      region_id: DEMO.regionId,
      reason: "integration",
    });
    if (!r.ok) throw new Error(`build region: ${await r.text()}`);
    await runJobs();
  }, 120_000);

  it("demo grove pack validates and has no forbidden fields", async () => {
    const { pack } = await fetchLatestGrovePack();
    const parsed = GrovePack.parse(pack);
    const frag9 = parsed.fragments.find(
      (f) => f.id === "aaaaaaaa-bbbb-4ccc-8ddd-000000000038",
    );
    expect(frag9?.visibility).toBe("protected");
    expect(frag9?.lat).toBeUndefined();
    expect(frag9?.lng).toBeUndefined();
    expect(JSON.stringify(pack)).not.toMatch(/DEMO-001|markerCode|marker_code/);
  });

  it("asset URLs resolve for pack assets", async () => {
    const { pack } = await fetchLatestGrovePack();
    const parsed = GrovePack.parse(pack);
    for (const a of parsed.assets.slice(0, 5)) {
      const path = `a/${a.sha}.${a.ext}`;
      const { data, error } = await anon.storage.from("public-media").download(path);
      expect(error, path).toBeNull();
      expect(data).toBeTruthy();
    }
  });

  it("region pack validates (landcover nullable)", async () => {
    const { data: build } = await svc
      .from("pack_builds")
      .select("*")
      .eq("scope", "region")
      .eq("scope_id", DEMO.regionId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(build).toBeTruthy();
    const { data: blob } = await svc.storage
      .from("public-media")
      .download(build!.manifest_path);
    const pack = JSON.parse(await blob!.text());
    const parsed = RegionPack.parse(pack);
    expect(parsed.landcover).toBeNull();
  });

  it("get_pack_index lists published grove for anon", async () => {
    const { data, error } = await anon.rpc("get_pack_index");
    expect(error).toBeNull();
    const rows = data as { scope: string; id: string }[];
    expect(rows.some((r) => r.scope === "grove" && r.id === DEMO.groveId)).toBe(
      true,
    );
  });

  it("revoking storyteller consent drops frag4 revision; asset 404; no transcript in any manifest", async () => {
    await svc
      .from("consents")
      .update({
        status: "revoked",
        revoked_on: new Date().toISOString().slice(0, 10),
        revoked_reason: "integration",
      })
      .eq("id", DEMO.storytellerConsentId);

    await runJobs();
    // force rebuild + purge
    await invoke("build-pack", { grove_id: DEMO.groveId, reason: "after-revoke" });
    await invoke("purge-assets", {});

    const { pack } = await fetchLatestGrovePack();
    const parsed = GrovePack.parse(pack);
    expect(parsed.revisions.some((r) => r.id === DEMO.frag4RevId)).toBe(false);
    expect(parsed.assets.some((a) => a.sha === DEMO.frag4AssetSha)).toBe(false);

    const pub = await fetch(
      `${url}/storage/v1/object/public/public-media/a/${DEMO.frag4AssetSha}.wav`,
    );
    // Storage may return 404 or 400 for a missing public object
    expect([400, 404]).toContain(pub.status);

    // R2: every stored grove manifest free of revoked revision id / transcript
    const { data: files } = await svc.storage
      .from("public-media")
      .list(`packs/grove/${DEMO.groveId}`, { limit: 100 });
    for (const f of files ?? []) {
      const { data: blob } = await svc.storage
        .from("public-media")
        .download(`packs/grove/${DEMO.groveId}/${f.name}`);
      const text = await blob!.text();
      expect(text).not.toContain(DEMO.frag4RevId);
      expect(text).not.toMatch(/Parking Lot 1 narration/i);
    }
  }, 180_000);

  it("deciding crossroads includes frag10 rev2", async () => {
    await svc
      .from("crossroads")
      .update({
        status: "decided",
        outcome_option_id: DEMO.optionAId,
      })
      .eq("id", DEMO.crossroadsId);
    await invoke("build-pack", { grove_id: DEMO.groveId, reason: "after-decide" });
    await runJobs();
    const { pack } = await fetchLatestGrovePack();
    const parsed = GrovePack.parse(pack);
    expect(parsed.revisions.some((r) => r.id === DEMO.frag10R2Id)).toBe(true);
  }, 120_000);

  it("publish_at gate: future excluded, past included after jobs", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    await svc
      .from("fragment_revisions")
      .update({ publish_at: future })
      .eq("id", DEMO.frag8RevId);
    await invoke("build-pack", { grove_id: DEMO.groveId, reason: "future-pub" });
    let { pack } = await fetchLatestGrovePack();
    expect(GrovePack.parse(pack).revisions.some((r) => r.id === DEMO.frag8RevId)).toBe(
      false,
    );

    const past = new Date(Date.now() - 3600_000).toISOString();
    await svc
      .from("fragment_revisions")
      .update({ publish_at: past })
      .eq("id", DEMO.frag8RevId);
    // enqueue via SQL helper path: direct rebuild
    await invoke("build-pack", { grove_id: DEMO.groveId, reason: "past-pub" });
    ({ pack } = await fetchLatestGrovePack());
    expect(GrovePack.parse(pack).revisions.some((r) => r.id === DEMO.frag8RevId)).toBe(
      true,
    );
  }, 120_000);

  it("no-op rebuild: content_sha256 equal, version unchanged", async () => {
    const before = await fetchLatestGrovePack();
    const res = await invoke("build-pack", {
      grove_id: DEMO.groveId,
      reason: "noop",
    });
    const body = await res.json();
    expect(res.ok).toBe(true);
    const after = await fetchLatestGrovePack();
    expect(after.contentSha).toBe(before.contentSha);
    expect(after.version).toBe(before.version);
    expect(JSON.stringify(body)).toMatch(/noop|true/);
    // two consecutive content hashes equal
    const digest = (s: string) =>
      createHash("sha256").update(s, "utf8").digest("hex");
    const bodyA = { ...(after.pack as object) } as Record<string, unknown>;
    delete bodyA.packVersion;
    delete bodyA.builtAt;
    const h1 = digest(canonicalJson(bodyA));
    expect(h1).toBe(before.contentSha);
  }, 60_000);

  it("writer cannot publish; editor can call publish endpoint auth", async () => {
    const writerEmail = `m2b-writer-${Date.now()}@test.local`;
    const password = "test-password-writer-1";
    const { data: w, error: wErr } = await svc.auth.admin.createUser({
      email: writerEmail,
      password,
      email_confirm: true,
    });
    if (wErr || !w.user) throw new Error(wErr?.message ?? "writer create");
    const { error: staffErr } = await svc.from("staff").insert({
      user_id: w.user.id,
      display_name: "M2b Writer",
      role: "writer",
      active: true,
    });
    if (staffErr) throw new Error(staffErr.message);

    const writerAuth = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: wSession, error: wSign } = await writerAuth.auth.signInWithPassword({
      email: writerEmail,
      password,
    });
    if (wSign || !wSession.session) throw new Error(wSign?.message ?? "writer signIn");
    const writerJwt = wSession.session.access_token;
    const denied = await invoke(
      "publish",
      { entity: "revision", ids: [DEMO.frag8RevId] },
      writerJwt,
    );
    expect(denied.status).toBe(403);

    const { jwt: editorJwt } = await ensureEditor();
    const allowed = await invoke(
      "publish",
      { entity: "revision", ids: [DEMO.frag8RevId] },
      editorJwt,
    );
    const allowedBody = await allowed.text();
    expect(allowed.status, allowedBody).not.toBe(403);
  }, 60_000);
});
