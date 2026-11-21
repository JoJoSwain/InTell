import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID, createHash } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { GrovePack, PreviewManifest, RegionPack, canonicalJson } from "@intell/shared";
import { DEMO, supabaseEnv } from "./env";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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

async function queuedJobCount(): Promise<number> {
  const { count, error } = await svc
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .in("status", ["queued", "running"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function drainJobs(maxRounds = 25): Promise<void> {
  for (let i = 0; i < maxRounds; i++) {
    const pending = await queuedJobCount();
    if (pending === 0) break;
    const res = await invoke("run-jobs", {});
    expect(res.status).toBe(200);
  }
}

async function fetchLiveGrovePack(groveId: string = DEMO.groveId): Promise<{
  pack: unknown;
  version: number;
  path: string;
  contentSha: string | null;
  releaseId: string | null;
}> {
  const { data: build, error } = await svc
    .from("pack_builds")
    .select("*")
    .eq("scope", "grove")
    .eq("scope_id", groveId)
    .eq("live", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !build) throw new Error(`no live grove pack: ${error?.message}`);
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
    releaseId: build.release_id,
  };
}

async function fetchLiveRegionPack(): Promise<{
  pack: unknown;
  version: number;
}> {
  const { data: build, error } = await svc
    .from("pack_builds")
    .select("*")
    .eq("scope", "region")
    .eq("scope_id", DEMO.regionId)
    .eq("live", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !build) throw new Error(`no live region pack: ${error?.message}`);
  const { data: blob, error: dl } = await svc.storage
    .from("public-media")
    .download(build.manifest_path);
  if (dl || !blob) throw new Error(dl?.message ?? "download failed");
  return { pack: JSON.parse(await blob!.text()), version: build.version };
}

async function indexGroveVersion(groveId: string): Promise<number | null> {
  const { data, error } = await anon.rpc("get_pack_index");
  if (error) throw new Error(error.message);
  const rows = data as { scope: string; id: string; version: number }[];
  const row = rows.find((r) => r.scope === "grove" && r.id === groveId);
  return row?.version ?? null;
}

async function copyReleaseItems(fromReleaseId: string, toReleaseId: string): Promise<void> {
  const { data, error } = await svc
    .from("release_items")
    .select("entity, entity_id")
    .eq("release_id", fromReleaseId);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("no release_items to copy");
  const { error: ins } = await svc.from("release_items").insert(
    data.map((row) => ({
      release_id: toReleaseId,
      entity: row.entity,
      entity_id: row.entity_id,
    })),
  );
  if (ins) throw new Error(ins.message);
}

async function ensureEditor(): Promise<{ client: SupabaseClient; jwt: string }> {
  const email = `m3a-editor-${Date.now()}@test.local`;
  const password = "test-password-editor-1";
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(error?.message ?? "createUser");
  const { error: staffErr } = await svc.from("staff").insert({
    user_id: created.user.id,
    display_name: "M3a Editor",
    role: "editor",
    active: true,
  });
  if (staffErr) throw new Error(`staff insert: ${staffErr.message}`);

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

async function livePackReadable(groveId: string): Promise<boolean> {
  const { data: build } = await svc
    .from("pack_builds")
    .select("manifest_path")
    .eq("scope", "grove")
    .eq("scope_id", groveId)
    .eq("live", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!build?.manifest_path) return false;
  const { data, error } = await svc.storage
    .from("public-media")
    .download(build.manifest_path as string);
  return !error && !!data;
}

async function waitForPublishedSeed(timeoutMs = 180_000): Promise<void> {
  const started = Date.now();
  let bootstrapped = false;
  while (Date.now() - started < timeoutMs) {
    await drainJobs();
    const { data: rel } = await svc
      .from("releases")
      .select("status")
      .eq("id", DEMO.publishedReleaseId)
      .single();
    const readable =
      (await livePackReadable(DEMO.groveId)) &&
      (await livePackReadable(DEMO.secondGroveId));
    if (rel?.status === "published" && readable) return;

    // After backup restore, pack_builds rows may exist while storage objects do not.
    if (!bootstrapped || rel?.status === "publishing" || !readable) {
      bootstrapped = true;
      await invoke("build-pack", {
        grove_id: DEMO.groveId,
        release_id: DEMO.publishedReleaseId,
        reason: "integration-bootstrap",
      });
      await invoke("build-pack", {
        grove_id: DEMO.secondGroveId,
        release_id: DEMO.publishedReleaseId,
        reason: "integration-bootstrap",
      });
      await invoke("build-pack", {
        region_id: DEMO.regionId,
        release_id: DEMO.publishedReleaseId,
        reason: "integration-bootstrap",
      });
      await invoke("run-jobs", {});
    }
  }
  const { data: rel } = await svc
    .from("releases")
    .select("status")
    .eq("id", DEMO.publishedReleaseId)
    .single();
  throw new Error(
    `seed release ${DEMO.publishedReleaseId} not ready (status=${rel?.status}); run db reset and supabase functions serve`,
  );
}

describe.sequential("M3a pack integration", () => {
  beforeAll(async () => {
    // Re-upload seed tones/portraits: purge/reconcile or a fresh DB wipe can
    // empty staging while pack_builds still point at those shas.
    execSync("node tools/seed-media-upload.mjs", {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    await waitForPublishedSeed();
  }, 240_000);

  it("demo grove pack validates (schema 3) with opening/journeys/homeGroveId", async () => {
    const { pack } = await fetchLiveGrovePack();
    const parsed = GrovePack.parse(pack);
    expect(parsed.schema).toBe(3);
    expect(parsed.grove.openingFragmentId).toBe(DEMO.frag1Id);
    expect(parsed.grove.journeys.walk?.en).toMatch(/TEST walk/i);
    expect(parsed.grove.journeys.bike?.en).toMatch(/TEST bike/i);
    expect(parsed.grove.journeys.transit?.en).toMatch(/TEST transit/i);
    expect((parsed.grove as { accessNotes?: unknown }).accessNotes).toBeUndefined();
    expect(parsed.characters.length).toBeGreaterThan(0);
    for (const c of parsed.characters) {
      expect(c.homeGroveId).toBeTruthy();
      expect(c.portraitSha).toMatch(/^[a-f0-9]{64}$/);
      expect(c.portraitAlt.en).toBeTruthy();
    }
    const frag9 = parsed.fragments.find((f) => f.id === DEMO.frag9Id);
    expect(frag9?.visibility).toBe("physical");
    expect(frag9?.lat).toBeDefined();
    expect(frag9?.lng).toBeDefined();
    expect(frag9?.radiusM).toBeUndefined();
    expect(frag9?.markerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(pack)).not.toMatch(/DEM00001|markerCode|marker_code/i);
    expect(JSON.stringify(pack)).not.toMatch(/storyNotes|writer_notes|accessNotes/i);
    expect(JSON.stringify(pack)).not.toMatch(/"drive"/);
  });

  it("asset URLs resolve for pack assets", async () => {
    const { pack } = await fetchLiveGrovePack();
    const parsed = GrovePack.parse(pack);
    for (const a of parsed.assets.slice(0, 8)) {
      const prefix = a.kind === "image" ? "i" : "a";
      const path = `${prefix}/${a.sha}.${a.ext}`;
      const { data, error } = await anon.storage.from("public-media").download(path);
      expect(error, path).toBeNull();
      expect(data).toBeTruthy();
    }
  });

  it("region pack validates (schema 2, landcover nullable)", async () => {
    const { pack } = await fetchLiveRegionPack();
    const parsed = RegionPack.parse(pack);
    expect(parsed.schema).toBe(2);
    expect(parsed.landcover).toBeNull();
  });

  it("get_pack_index lists only live groves with opening points", async () => {
    const { data, error } = await anon.rpc("get_pack_index");
    expect(error).toBeNull();
    const rows = data as {
      scope: string;
      id: string;
      version: number;
      opening?: { lat: number; lng: number };
    }[];
    expect(rows.some((r) => r.scope === "grove" && r.id === DEMO.groveId)).toBe(true);
    expect(rows.some((r) => r.scope === "grove" && r.id === DEMO.secondGroveId)).toBe(
      true,
    );
    for (const groveId of [DEMO.groveId, DEMO.secondGroveId]) {
      const row = rows.find((r) => r.scope === "grove" && r.id === groveId);
      const live = await fetchLiveGrovePack(groveId);
      expect(row?.version).toBe(live.version);
      expect(row?.opening?.lat).toBeTypeOf("number");
      expect(row?.opening?.lng).toBeTypeOf("number");
      const parsed = GrovePack.parse(live.pack);
      const frag = parsed.fragments.find(
        (f) => f.id === parsed.grove.openingFragmentId,
      );
      expect(row?.opening?.lat).toBe(frag?.lat);
      expect(row?.opening?.lng).toBe(frag?.lng);
    }
  });

  it("contingency bumps contingencyRevisionNo; changeTeaser and otherTimeHint present", async () => {
    const { pack } = await fetchLiveGrovePack();
    const parsed = GrovePack.parse(pack);
    const frag4Rev = parsed.revisions.find((r) => r.id === DEMO.frag4Rev2Id);
    const frag10Rev = parsed.revisions.find((r) => r.id === DEMO.frag10R2Id);
    expect(frag4Rev?.changeKind).toBe("correction");
    expect(frag4Rev?.contingencyRevisionNo).toBe(1);
    expect(frag4Rev?.changeTeaser).toBeUndefined();
    expect(frag10Rev?.changeKind).toBe("contingency");
    expect(frag10Rev?.contingencyRevisionNo).toBe(2);
    expect(frag10Rev?.changeTeaser?.en).toMatch(/TEST change teaser/i);
    const frag1 = parsed.revisions.find((r) => r.fragmentId === DEMO.frag1Id);
    expect(frag1?.versions.some((v) => !!v.otherTimeHint?.en)).toBe(true);
  });

  it("second grove lists cross-grove externalPrerequisites for Farmington frag1", async () => {
    const { pack } = await fetchLiveGrovePack(DEMO.secondGroveId);
    const parsed = GrovePack.parse(pack);
    const ext = parsed.externalPrerequisites.find((e) => e.fragmentId === DEMO.frag1Id);
    expect(ext).toBeDefined();
    expect(ext?.groveId).toBe(DEMO.groveId);
    // Seed starts at 1; later contingency releases may raise it — still a number ≥ 1.
    expect(ext?.contingencyRevisionNo).toBeGreaterThanOrEqual(1);
  });

  it("portrait images are public in storage after publish reconcile", async () => {
    for (const sha of [DEMO.portraitASha, DEMO.portraitBSha]) {
      const { data: row } = await svc
        .from("image_assets")
        .select("is_public")
        .eq("sha256", sha)
        .single();
      expect(row?.is_public).toBe(true);
      const path = `i/${sha}.png`;
      const { data, error } = await anon.storage.from("public-media").download(path);
      expect(error, path).toBeNull();
      expect(data).toBeTruthy();
    }
    const { pack } = await fetchLiveGrovePack();
    const parsed = GrovePack.parse(pack);
    expect(parsed.characters.some((c) => c.portraitSha === DEMO.portraitASha)).toBe(true);
  });

  it("no-op rebuild: content_sha256 equal, version unchanged", async () => {
    // Align live pack with current projection first (seed/go-live may lag).
    const sync = await invoke("build-pack", {
      grove_id: DEMO.groveId,
      reason: "sync-before-noop",
    });
    expect(sync.ok).toBe(true);
    await drainJobs();

    const before = await fetchLiveGrovePack();
    const res = await invoke("build-pack", {
      grove_id: DEMO.groveId,
      reason: "noop",
    });
    const body = await res.json();
    expect(res.ok).toBe(true);
    const after = await fetchLiveGrovePack();
    expect(after.contentSha).toBe(before.contentSha);
    expect(after.version).toBe(before.version);
    expect(JSON.stringify(body)).toMatch(/noop|true/);
    const digest = (s: string) =>
      createHash("sha256").update(s, "utf8").digest("hex");
    const bodyA = { ...(after.pack as object) } as Record<string, unknown>;
    delete bodyA.packVersion;
    delete bodyA.builtAt;
    expect(digest(canonicalJson(bodyA))).toBe(before.contentSha);
  }, 120_000);

  it("forged service_role JWT is rejected by internal functions", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        role: "service_role",
        iss: "supabase",
        ref: "forged",
      }),
    ).toString("base64url");
    const forged = `${header}.${payload}.fakesig`;

    for (const name of ["build-pack", "purge-assets", "run-jobs"] as const) {
      const body =
        name === "build-pack"
          ? { grove_id: DEMO.groveId, reason: "forged" }
          : {};
      const res = await invoke(name, body, forged);
      expect([401, 403].includes(res.status), `${name} → ${res.status}`).toBe(true);
    }
    expect((await invoke("run-jobs", {})).status).toBe(200);
  }, 60_000);

  it("writer cannot publish release; editor auth is not 403", async () => {
    const writerEmail = `m3a-writer-${Date.now()}@test.local`;
    const password = "test-password-writer-1";
    const { data: w, error: wErr } = await svc.auth.admin.createUser({
      email: writerEmail,
      password,
      email_confirm: true,
    });
    if (wErr || !w.user) throw new Error(wErr?.message ?? "writer create");
    const { error: staffErr } = await svc.from("staff").insert({
      user_id: w.user.id,
      display_name: "M3a Writer",
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
      { releaseId: DEMO.draftReleaseId },
      writerJwt,
    );
    expect(denied.status).toBe(403);

    const { jwt: editorJwt } = await ensureEditor();
    const allowed = await invoke("publish", { release_id: DEMO.draftReleaseId }, editorJwt);
    expect(allowed.status).not.toBe(403);
  }, 60_000);

  it("staged edit does not leak into live pack until release includes it", async () => {
    const staged = `STAGED-${Date.now()}`;
    const { data: snapBefore } = await svc
      .from("published_snapshots")
      .select("data")
      .eq("entity", "fragment")
      .eq("entity_id", DEMO.frag1Id)
      .single();

    await svc
      .from("fragments")
      .update({ teaser: { en: staged } })
      .eq("id", DEMO.frag1Id);

    const { pack } = await fetchLiveGrovePack();
    const parsed = GrovePack.parse(pack);
    const frag = parsed.fragments.find((f) => f.id === DEMO.frag1Id);
    expect(frag?.teaser.en).not.toBe(staged);
    expect(frag?.teaser.en).toBe(
      (snapBefore?.data as { teaser?: { en?: string } })?.teaser?.en,
    );

    const { data: snapAfter } = await svc
      .from("published_snapshots")
      .select("data")
      .eq("entity", "fragment")
      .eq("entity_id", DEMO.frag1Id)
      .single();
    expect(snapAfter?.data).toEqual(snapBefore?.data);
  }, 60_000);

  it("staged journey edit does not change live pack until grove is released", async () => {
    const staged = `STAGED-JOURNEY-${Date.now()}`;
    const before = await fetchLiveGrovePack();
    const beforeParsed = GrovePack.parse(before.pack);
    const beforeWalk = beforeParsed.grove.journeys.walk?.en;

    await svc.from("grove_journeys").upsert({
      grove_id: DEMO.groveId,
      mode: "walk",
      passage: { en: staged },
    });

    const after = await fetchLiveGrovePack();
    const afterParsed = GrovePack.parse(after.pack);
    expect(afterParsed.grove.journeys.walk?.en).toBe(beforeWalk);
    expect(afterParsed.grove.journeys.walk?.en).not.toBe(staged);
    expect(after.contentSha).toBe(before.contentSha);

    // Restore so later releases that re-snapshot the grove keep seed copy.
    await svc.from("grove_journeys").upsert({
      grove_id: DEMO.groveId,
      mode: "walk",
      passage: {
        en: "TEST walk journey — on foot to the opening root.",
      },
    });
  }, 60_000);

  it("atomic go-live: index keeps prior live versions until publishing release completes", async () => {
    const releaseId = randomUUID();
    const vBefore1 = (await fetchLiveGrovePack(DEMO.groveId)).version;
    const vBefore2 = (await fetchLiveGrovePack(DEMO.secondGroveId)).version;

    await svc.from("releases").insert({
      id: releaseId,
      name: "integration atomic golive",
      status: "draft",
    });
    await copyReleaseItems(DEMO.publishedReleaseId, releaseId);

    await svc
      .from("groves")
      .update({ name: { en: `Golive-${Date.now()}` } })
      .eq("id", DEMO.groveId);
    await svc
      .from("groves")
      .update({ name: { en: `Nearby-${Date.now()}` } })
      .eq("id", DEMO.secondGroveId);

    const { jwt } = await ensureEditor();
    const pub = await invoke("publish", { releaseId }, jwt);
    expect(pub.ok, await pub.text()).toBe(true);

    const { data: rel } = await svc
      .from("releases")
      .select("status")
      .eq("id", releaseId)
      .single();
    expect(rel?.status).toBe("publishing");

    // Builds are created by rebuild_pack jobs; until drainJobs runs they may
    // not exist yet. Atomicity is: index stays on prior live versions while
    // the release is still publishing, then both groves advance together.
    const { count: queuedRebuilds } = await svc
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("kind", "rebuild_pack")
      .eq("status", "queued");
    expect((queuedRebuilds ?? 0) >= 2).toBe(true);
    expect(await indexGroveVersion(DEMO.groveId)).toBe(vBefore1);
    expect(await indexGroveVersion(DEMO.secondGroveId)).toBe(vBefore2);

    await drainJobs();

    const { data: releaseBuilds } = await svc
      .from("pack_builds")
      .select("live")
      .eq("release_id", releaseId);
    expect((releaseBuilds ?? []).length).toBeGreaterThan(0);
    expect((releaseBuilds ?? []).every((b) => b.live === true)).toBe(true);

    const { data: relAfter } = await svc
      .from("releases")
      .select("status")
      .eq("id", releaseId)
      .single();
    expect(relAfter?.status).toBe("published");

    const vAfter1 = (await fetchLiveGrovePack(DEMO.groveId)).version;
    const vAfter2 = (await fetchLiveGrovePack(DEMO.secondGroveId)).version;
    expect(vAfter1).toBeGreaterThanOrEqual(vBefore1);
    expect(vAfter2).toBeGreaterThanOrEqual(vBefore2);
    expect(await indexGroveVersion(DEMO.groveId)).toBe(vAfter1);
    expect(await indexGroveVersion(DEMO.secondGroveId)).toBe(vAfter2);
  }, 240_000);

  it("Farmington frag1 contingency bumps externalPrerequisites on second grove", async () => {
    const releaseId = randomUUID();
    const newRevId = randomUUID();
    const extBefore = GrovePack.parse(
      (await fetchLiveGrovePack(DEMO.secondGroveId)).pack,
    ).externalPrerequisites.find((e) => e.fragmentId === DEMO.frag1Id);
    expect(extBefore?.contingencyRevisionNo).toBeGreaterThanOrEqual(1);

    const { data: versions } = await svc
      .from("revision_versions")
      .select("language, time_window, narration_asset_id, transcript")
      .eq("revision_id", DEMO.frag1RevId)
      .limit(1);
    const v0 = versions?.[0];
    if (!v0) throw new Error("frag1 rev1 version missing");

    const { data: maxRev } = await svc
      .from("fragment_revisions")
      .select("revision_no")
      .eq("fragment_id", DEMO.frag1Id)
      .order("revision_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNo = (maxRev?.revision_no ?? 1) + 1;

    const { error: revInsErr } = await svc.from("fragment_revisions").insert({
      id: newRevId,
      fragment_id: DEMO.frag1Id,
      revision_no: nextNo,
      status: "draft",
      change_kind: "contingency",
      change_note: "integration contingency r2",
      change_teaser: {
        en: "TEST change teaser — frag1 contingency after revision 1.",
      },
    });
    if (revInsErr) throw new Error(`frag1 contingency rev insert: ${revInsErr.message}`);

    const { error: verInsErr } = await svc.from("revision_versions").insert({
      revision_id: newRevId,
      language: v0.language,
      time_window: v0.time_window,
      narration_asset_id: v0.narration_asset_id,
      transcript: "TEST transcript — frag1 contingency narration tone.",
      other_time_hint: {},
    });
    if (verInsErr) throw new Error(`frag1 contingency version insert: ${verInsErr.message}`);

    await svc.from("releases").insert({
      id: releaseId,
      name: "integration frag1 c2",
      status: "draft",
    });
    await copyReleaseItems(DEMO.publishedReleaseId, releaseId);
    const { error: itemErr } = await svc.from("release_items").insert({
      release_id: releaseId,
      entity: "revision",
      entity_id: newRevId,
    });
    if (itemErr) throw new Error(`release_items insert: ${itemErr.message}`);

    const { jwt } = await ensureEditor();
    const pub = await invoke("publish", { releaseId }, jwt);
    expect(pub.ok, await pub.text()).toBe(true);
    await drainJobs();

    const extAfter = GrovePack.parse(
      (await fetchLiveGrovePack(DEMO.secondGroveId)).pack,
    ).externalPrerequisites.find((e) => e.fragmentId === DEMO.frag1Id);
    expect(extAfter?.contingencyRevisionNo).toBeGreaterThan(
      extBefore!.contingencyRevisionNo,
    );
  }, 240_000);

  it("scheduled release succeeds via fn_enqueue_due_releases and publish_release job", async () => {
    const releaseId = randomUUID();
    const stamp = `SchedOK-${Date.now()}`;
    await svc.from("releases").insert({
      id: releaseId,
      name: "integration scheduled ok",
      status: "scheduled",
      publish_at: new Date(Date.now() - 60_000).toISOString(),
    });
    await copyReleaseItems(DEMO.publishedReleaseId, releaseId);
    await svc.from("groves").update({ name: { en: stamp } }).eq("id", DEMO.groveId);

    const { error: enqErr } = await svc.rpc("fn_enqueue_due_releases");
    if (enqErr) throw new Error(enqErr.message);

    const { data: jobs } = await svc
      .from("jobs")
      .select("kind, payload")
      .eq("kind", "publish_release");
    expect(
      jobs?.some((j) => (j.payload as { release_id?: string })?.release_id === releaseId),
    ).toBe(true);

    const { data: relPub } = await svc
      .from("releases")
      .select("status")
      .eq("id", releaseId)
      .single();
    expect(relPub?.status).toBe("publishing");

    await drainJobs();

    const { data: relAfter } = await svc
      .from("releases")
      .select("status")
      .eq("id", releaseId)
      .single();
    expect(relAfter?.status).toBe("published");

    const parsed = GrovePack.parse((await fetchLiveGrovePack()).pack);
    expect(parsed.grove.name.en).toBe(stamp);
  }, 240_000);

  it("scheduled release check failure marks release failed", async () => {
    const releaseId = randomUUID();
    const portraitId = "aaaaaaaa-bbbb-4ccc-8ddd-000000000140";
    const seedAlt = { en: "Placeholder portrait for demo character River." };
    const prevAlt =
      (
        await svc.from("image_assets").select("alt_text").eq("id", portraitId).single()
      ).data?.alt_text ?? seedAlt;

    try {
      await svc.from("releases").insert({
        id: releaseId,
        name: "integration scheduled fail",
        status: "scheduled",
        publish_at: new Date(Date.now() - 60_000).toISOString(),
      });
      await svc.from("release_items").insert({
        release_id: releaseId,
        entity: "image",
        entity_id: portraitId,
      });
      await svc
        .from("image_assets")
        .update({ alt_text: { en: "" } })
        .eq("id", portraitId);

      const { error: enqErr } = await svc.rpc("fn_enqueue_due_releases");
      if (enqErr) throw new Error(enqErr.message);
      await drainJobs();

      const { data: rel } = await svc
        .from("releases")
        .select("status, last_check")
        .eq("id", releaseId)
        .single();
      expect(rel?.status).toBe("failed");
      const failures = (rel?.last_check as { failures?: { code?: string }[] })?.failures ?? [];
      expect(failures.some((f) => f.code === "NO_ALT_TEXT")).toBe(true);
    } finally {
      const { error: restoreErr } = await svc
        .from("image_assets")
        .update({ alt_text: seedAlt })
        .eq("id", portraitId);
      if (restoreErr) throw new Error(`restore alt_text: ${restoreErr.message}`);
    }
  }, 120_000);

  it("forced build failure leaves release failed and prior live packs", async () => {
    const releaseId = randomUUID();
    const liveBefore = await fetchLiveGrovePack(DEMO.groveId);
    const idxBefore = await indexGroveVersion(DEMO.groveId);

    // Prior tests may have cleared portrait alt; restore before check/commit.
    const { error: altErr } = await svc
      .from("image_assets")
      .update({
        alt_text: { en: "Placeholder portrait for demo character River." },
      })
      .eq("id", "aaaaaaaa-bbbb-4ccc-8ddd-000000000140");
    if (altErr) throw new Error(`restore portrait alt: ${altErr.message}`);

    await svc.from("releases").insert({
      id: releaseId,
      name: "integration forced pack failure",
      status: "draft",
    });
    await copyReleaseItems(DEMO.publishedReleaseId, releaseId);
    await svc
      .from("groves")
      .update({ name: { en: `FailBuild-${Date.now()}` } })
      .eq("id", DEMO.groveId);

    const { jwt } = await ensureEditor();
    const pub = await invoke("publish", { releaseId }, jwt);
    expect(pub.ok, await pub.text()).toBe(true);

    const bogusGrove = "00000000-0000-0000-0000-000000000099";
    const { data: rebuildJobs, error: jobErr } = await svc
      .from("jobs")
      .select("id, payload, attempts")
      .eq("kind", "rebuild_pack")
      .eq("status", "queued");
    if (jobErr) throw new Error(jobErr.message);
    let corrupted = 0;
    for (const job of rebuildJobs ?? []) {
      const payload = job.payload as Record<string, unknown>;
      if (payload.release_id === releaseId || payload.releaseId === releaseId) {
        // Point every rebuild at a missing grove and leave one attempt so the
        // next run-jobs marks the job (and release) failed.
        await svc
          .from("jobs")
          .update({
            payload: { grove_id: bogusGrove, release_id: releaseId },
            attempts: 4,
          })
          .eq("id", job.id);
        corrupted += 1;
      }
    }
    expect(corrupted).toBeGreaterThan(0);

    for (let i = 0; i < 6; i++) {
      const res = await invoke("run-jobs", {});
      expect(res.status).toBe(200);
    }

    const { data: rel } = await svc
      .from("releases")
      .select("status, last_check")
      .eq("id", releaseId)
      .single();
    expect(rel?.status).toBe("failed");

    const liveAfter = await fetchLiveGrovePack(DEMO.groveId);
    expect(liveAfter.version).toBe(liveBefore.version);
    expect(liveAfter.contentSha).toBe(liveBefore.contentSha);
    expect(await indexGroveVersion(DEMO.groveId)).toBe(idxBefore);
  }, 300_000);

  it("D1: editing a published revision is refused; live pack unchanged", async () => {
    const liveBefore = await fetchLiveGrovePack(DEMO.groveId);
    const { client } = await ensureEditor();

    const { error: revErr } = await client
      .from("fragment_revisions")
      .update({ change_note: `should-fail-${Date.now()}` })
      .eq("id", DEMO.frag1RevId);
    expect(revErr).toBeTruthy();

    const { data: versions } = await svc
      .from("revision_versions")
      .select("id, transcript")
      .eq("revision_id", DEMO.frag1RevId)
      .limit(1);
    const versionId = versions?.[0]?.id as string | undefined;
    expect(versionId).toBeTruthy();

    const { error: verErr } = await client
      .from("revision_versions")
      .update({ transcript: `tamper-${Date.now()}` })
      .eq("id", versionId!);
    expect(verErr).toBeTruthy();

    const liveAfter = await fetchLiveGrovePack(DEMO.groveId);
    expect(liveAfter.contentSha).toBe(liveBefore.contentSha);
    expect(liveAfter.version).toBe(liveBefore.version);
  }, 120_000);

  it("preview: anon refused; staff gets PreviewManifest with staging URLs", async () => {
    // Prior suite cases may leave the seed draft release mid-publish; restore draft.
    await svc
      .from("releases")
      .update({ status: "draft", publish_at: null })
      .eq("id", DEMO.draftReleaseId);

    const anonRes = await invoke("preview", { releaseId: DEMO.draftReleaseId }, anonKey!);
    expect([401, 403]).toContain(anonRes.status);

    const { jwt } = await ensureEditor();
    const okRes = await invoke("preview", { releaseId: DEMO.draftReleaseId }, jwt);
    expect(okRes.status, await okRes.clone().text()).toBe(200);
    const body = await okRes.json();
    const parsed = PreviewManifest.parse(body);
    expect(parsed.schema).toBe("preview/1");
    expect(parsed.releaseId).toBe(DEMO.draftReleaseId);
    expect(new Date(parsed.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(parsed)).not.toMatch(/marker_code|markerCode/i);
    expect(JSON.stringify(parsed)).not.toMatch(/storyNotes|indigeny_earth/i);

    // Published release is not previewable
    const pubRes = await invoke("preview", { releaseId: DEMO.publishedReleaseId }, jwt);
    expect(pubRes.status).toBe(409);

    // Staged assets should use staging signed URLs (or public URL for already-public)
    for (const a of parsed.assets) {
      expect(a.url.length).toBeGreaterThan(0);
      expect(a.url).not.toMatch(/marker/i);
    }
    const staging = parsed.assets.filter((a) => a.url.includes("staging-"));
    // Draft release overlay should include at least one staged asset when seed has drafts
    expect(staging.length + parsed.assets.filter((a) => a.url.includes("public-media")).length).toBe(
      parsed.assets.length,
    );
  }, 120_000);

  it("preview: viewer/moderator forbidden", async () => {
    const email = `m3d-viewer-${Date.now()}@test.local`;
    const password = "test-password-viewer-1";
    const { data: created, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser");
    await svc.from("staff").insert({
      user_id: created.user.id,
      display_name: "M3d Viewer",
      role: "viewer",
      active: true,
    });
    const authClient = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !session.session) throw new Error(signErr?.message ?? "signIn");
    const res = await invoke(
      "preview",
      { releaseId: DEMO.draftReleaseId },
      session.session.access_token,
    );
    expect(res.status).toBe(403);
  }, 60_000);

  it("preview: admin can preview (staff lookup filtered by user_id)", async () => {
    await svc
      .from("releases")
      .update({ status: "draft", publish_at: null })
      .eq("id", DEMO.draftReleaseId);

    const email = `m3d-admin-${Date.now()}@test.local`;
    const password = "test-password-admin-1";
    const { data: created, error } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "createUser");
    await svc.from("staff").insert({
      user_id: created.user.id,
      display_name: "M3d Admin",
      role: "admin",
      active: true,
    });
    const authClient = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !session.session) throw new Error(signErr?.message ?? "signIn");

    const res = await invoke(
      "preview",
      { releaseId: DEMO.draftReleaseId },
      session.session.access_token,
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const parsed = PreviewManifest.parse(await res.json());
    expect(parsed.schema).toBe("preview/1");
    expect(parsed.releaseId).toBe(DEMO.draftReleaseId);
  }, 60_000);

  it("preview: incomplete character returns 422 with clear message (N1)", async () => {
    await svc
      .from("releases")
      .update({ status: "draft", publish_at: null })
      .eq("id", DEMO.draftReleaseId);

    const { data: before } = await svc
      .from("characters")
      .select("home_grove_id, portrait_image_id")
      .eq("id", DEMO.charRiverId)
      .single();
    expect(before?.home_grove_id).toBeTruthy();

    await svc
      .from("characters")
      .update({ home_grove_id: null })
      .eq("id", DEMO.charRiverId);

    await svc.from("release_items").delete().eq("release_id", DEMO.draftReleaseId);
    const { error: itemErr } = await svc.from("release_items").insert([
      { release_id: DEMO.draftReleaseId, entity: "grove", entity_id: DEMO.groveId },
      {
        release_id: DEMO.draftReleaseId,
        entity: "character",
        entity_id: DEMO.charRiverId,
      },
    ]);
    if (itemErr) throw new Error(itemErr.message);

    try {
      const { jwt } = await ensureEditor();
      const res = await invoke(
        "preview",
        { releaseId: DEMO.draftReleaseId },
        jwt,
      );
      expect(res.status, await res.clone().text()).toBe(422);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toMatch(/River needs a home grove before preview/i);
    } finally {
      await svc
        .from("characters")
        .update({
          home_grove_id: before?.home_grove_id ?? DEMO.groveId,
          portrait_image_id: before?.portrait_image_id ?? null,
        })
        .eq("id", DEMO.charRiverId);
      await svc.from("release_items").delete().eq("release_id", DEMO.draftReleaseId);
    }
  }, 120_000);
});