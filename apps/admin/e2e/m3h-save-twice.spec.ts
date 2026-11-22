import { expect, test, type Page } from "@playwright/test";
import { loadUsers, signIn } from "./auth";

const REGION = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const FRAG1 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const FRAG10 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000039";
const REV_F10_R2 = "aaaaaaaa-bbbb-4ccc-8ddd-00000000004a";
const CHAR_RIVER = "aaaaaaaa-bbbb-4ccc-8ddd-000000000020";
const THREAD = "aaaaaaaa-bbbb-4ccc-8ddd-000000000016";
const DRAFT_RELEASE = "aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1";

function stamp(label: string): string {
  return `M3h ${label} ${Date.now()}`;
}

function serviceHeaders(): {
  auth: ReturnType<typeof loadUsers>;
  key: string;
} {
  const auth = loadUsers();
  const key = auth.serviceRoleKey;
  if (!key) throw new Error("serviceRoleKey missing from e2e auth users");
  return { auth, key };
}

async function restSelect<T>(
  pathAndQuery: string,
): Promise<T[]> {
  const { auth, key } = serviceHeaders();
  const res = await fetch(`${auth.supabaseUrl}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`REST GET ${pathAndQuery}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

async function restPatch(
  table: string,
  filter: string,
  body: Record<string, unknown>,
): Promise<void> {
  const { auth, key } = serviceHeaders();
  const res = await fetch(`${auth.supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`REST PATCH ${table}: ${res.status} ${await res.text()}`);
  }
}

async function restDelete(table: string, filter: string): Promise<void> {
  const { auth, key } = serviceHeaders();
  const res = await fetch(`${auth.supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
  });
  if (!res.ok) {
    throw new Error(`REST DELETE ${table}: ${res.status} ${await res.text()}`);
  }
}

function field(page: Page, label: string) {
  return page.getByRole("textbox", { name: label, exact: true });
}

async function fillExact(page: Page, label: string, value: string) {
  const el = field(page, label);
  await el.click();
  await el.fill("");
  await el.fill(value);
  await expect(el).toHaveValue(value);
}

async function expectExact(page: Page, label: string, value: string) {
  await expect(field(page, label)).toHaveValue(value, { timeout: 20_000 });
}

/** After a full page load, wait until React has hydrated form handlers. */
async function waitForHydratedForm(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    if (!form) return false;
    return Object.keys(form).some(
      (k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"),
    );
  });
}

/** Wait until editable field values are unchanged for ~500ms (post soft-nav). */
async function waitForStableFields(page: Page) {
  let last = "";
  let stableSince = Date.now();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const snap = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="file"])',
        ),
      )
        .map((el) => (el as HTMLInputElement | HTMLTextAreaElement).value)
        .join("\0"),
    );
    const now = Date.now();
    if (snap !== last) {
      last = snap;
      stableSince = now;
    } else if (now - stableSince >= 500) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("fields did not stabilize within 60s");
}

function isNextActionPost(res: {
  request: () => { method: () => string; headers: () => Record<string, string> };
}): boolean {
  const req = res.request();
  if (req.method() !== "POST") return false;
  const headers = req.headers();
  return Object.keys(headers).some((h) => h.toLowerCase() === "next-action");
}

async function clickSave(page: Page, buttonName: string | RegExp) {
  const btn = () => page.getByRole("button", { name: buttonName });
  await waitForHydratedForm(page);
  await expect(btn()).toBeEnabled({ timeout: 15_000 });
  const urlBefore = page.url();

  // Arm before click: server actions carry the next-action header.
  const actionDone = page.waitForResponse(isNextActionPost, { timeout: 60_000 });

  await btn().click();

  // Client pending path (JourneyForm / ServerActionForm)
  const pending = await expect(btn())
    .toBeDisabled({ timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (pending) {
    await actionDone.catch(() => undefined);
    // Hard-nav forms change the document; soft-nav forms re-enable the same button.
    await Promise.race([
      page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 60_000 }),
      expect(btn()).toBeEnabled({ timeout: 60_000 }),
    ]);
    await page.waitForLoadState("domcontentloaded");
    await waitForHydratedForm(page);
    await waitForStableFields(page);
    return;
  }

  await actionDone;
  await expect(btn()).toBeVisible({ timeout: 60_000 });
  await waitForHydratedForm(page);
  await waitForStableFields(page);
}

async function saveTwice(page: Page, buttonName: string | RegExp) {
  await clickSave(page, buttonName);
  await clickSave(page, buttonName);
}

test.describe("M3h save twice (no doubled text)", () => {
  test("journey passages", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    // Prefill walk; leave bike/transit empty (brief: one prefilled, one empty).
    const priorWalk = `PRIOR walk ${Date.now()}`;
    await restPatch(
      "grove_journeys",
      `grove_id=eq.${GROVE}&mode=eq.walk`,
      { passage: { en: priorWalk } },
    );
    await restDelete(
      "grove_journeys",
      `grove_id=eq.${GROVE}&mode=eq.bike`,
    );
    await restDelete(
      "grove_journeys",
      `grove_id=eq.${GROVE}&mode=eq.transit`,
    );

    await signIn(page, writer.email, writer.password);
    await page.goto(`/story/groves/${GROVE}`);
    await expect(
      page.getByRole("heading", { name: "Journey passages" }),
    ).toBeVisible({ timeout: 15_000 });

    const walk = stamp("walk");
    const bike = stamp("bike");
    const transit = stamp("transit");

    await expect(page.getByLabel("On foot journey passage")).toHaveValue(priorWalk);
    await expect(page.getByLabel("By bike journey passage")).toHaveValue("");
    await expect(page.getByLabel("By transit journey passage")).toHaveValue("");

    await fillExact(page, "On foot journey passage", walk);
    await fillExact(page, "By bike journey passage", bike);
    await fillExact(page, "By transit journey passage", transit);

    // Generic saveTwice (same clickSave as other forms) — no ?journeys= URL wait.
    await saveTwice(page, "Save journey passages");

    await expectExact(page, "On foot journey passage", walk);
    await expectExact(page, "By bike journey passage", bike);
    await expectExact(page, "By transit journey passage", transit);

    await page.reload();
    await expectExact(page, "On foot journey passage", walk);
    await expectExact(page, "By bike journey passage", bike);
    await expectExact(page, "By transit journey passage", transit);

    const rows = await restSelect<{ mode: string; passage: { en?: string } }>(
      `grove_journeys?grove_id=eq.${GROVE}&select=mode,passage`,
    );
    const byMode = Object.fromEntries(
      rows.map((r) => [r.mode, r.passage?.en ?? ""]),
    );
    expect(byMode.walk).toBe(walk);
    expect(byMode.bike).toBe(bike);
    expect(byMode.transit).toBe(transit);
  });

  test("region", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    // Bounds starts with seed polygon; clear via patch isn't trivial (geography).
    // Use Name (prefilled text) + Timezone (prefilled text) + Bounds textarea.
    await signIn(page, editor.email, editor.password);
    await page.goto(`/regions/${REGION}`);
    await expect(page.getByRole("button", { name: "Save region" })).toBeVisible({
      timeout: 15_000,
    });

    // Clear bounds so one textarea starts empty; name/timezone stay prefilled.
    // Leave bounds empty on save (optional) — pretty-printed PostGIS GeoJSON
    // round-trips poorly through the text field.
    await fillExact(page, "Bounds GeoJSON", "");
    await expect(field(page, "Region name")).not.toHaveValue("");

    const name = stamp("region-name");
    const timezone = "Pacific/Honolulu";

    await fillExact(page, "Region name", name);
    await fillExact(page, "Timezone", timezone);

    await saveTwice(page, "Save region");
    await expectExact(page, "Region name", name);
    await expectExact(page, "Timezone", timezone);
    await expectExact(page, "Bounds GeoJSON", "");

    await page.reload();
    await waitForHydratedForm(page);
    await expectExact(page, "Region name", name);
    await expectExact(page, "Timezone", timezone);

    const rows = await restSelect<{ name: string; timezone: string }>(
      `regions?id=eq.${REGION}&select=name,timezone`,
    );
    expect(rows[0]?.name).toBe(name);
    expect(rows[0]?.timezone).toBe(timezone);
  });

  test("character", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    // Clear notes so one textarea starts empty; public_intro stays prefilled.
    await restPatch("characters", `id=eq.${CHAR_RIVER}`, { notes: null });

    await signIn(page, writer.email, writer.password);
    await page.goto(`/story/characters/${CHAR_RIVER}`);
    await expect(page.getByLabel("Back story")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Character notes")).toHaveValue("");
    await expect(page.getByLabel("Back story")).not.toHaveValue("");

    const internal = stamp("char-internal");
    const intro = stamp("char-intro");
    const notes = stamp("char-notes");

    await fillExact(page, "Internal name", internal);
    await fillExact(page, "Back story", intro);
    await fillExact(page, "Character notes", notes);

    await saveTwice(page, "Save character");
    await expectExact(page, "Internal name", internal);
    await expectExact(page, "Back story", intro);
    await expectExact(page, "Character notes", notes);

    await page.reload();
    await expectExact(page, "Internal name", internal);
    await expectExact(page, "Back story", intro);
    await expectExact(page, "Character notes", notes);

    const rows = await restSelect<{
      name: string;
      public_intro: { en?: string };
      notes: string | null;
    }>(`characters?id=eq.${CHAR_RIVER}&select=name,public_intro,notes`);
    expect(rows[0]?.name).toBe(internal);
    expect(rows[0]?.public_intro?.en).toBe(intro);
    expect(rows[0]?.notes).toBe(notes);
  });

  test("grove", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    // Clear premise so one textarea starts empty; keep website empty.
    await restPatch("groves", `id=eq.${GROVE}`, {
      premise: { en: "" },
      website_url: null,
    });

    await signIn(page, editor.email, editor.password);
    await page.goto(`/story/groves/${GROVE}`);
    await expect(page.getByLabel("Grove name")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Premise")).toHaveValue("");
    await expect(page.getByLabel("Website URL")).toHaveValue("");

    const name = stamp("grove-name");
    const premise = stamp("grove-premise");
    const website = `https://example.com/m3h-${Date.now()}`;

    await fillExact(page, "Grove name", name);
    await fillExact(page, "Premise", premise);
    await fillExact(page, "Website URL", website);

    await saveTwice(page, "Save grove");
    await expectExact(page, "Grove name", name);
    await expectExact(page, "Premise", premise);
    await expectExact(page, "Website URL", website);

    await page.reload();
    await expectExact(page, "Grove name", name);
    await expectExact(page, "Premise", premise);
    await expectExact(page, "Website URL", website);

    const rows = await restSelect<{
      name: { en?: string };
      premise: { en?: string };
      website_url: string | null;
    }>(`groves?id=eq.${GROVE}&select=name,premise,website_url`);
    expect(rows[0]?.name?.en).toBe(name);
    expect(rows[0]?.premise?.en).toBe(premise);
    expect(rows[0]?.website_url).toBe(website);
  });

  test("fragment", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await restPatch("fragments", `id=eq.${FRAG1}`, {
      teaser: { en: "" },
      indigeny_earth: "",
    });

    await signIn(page, editor.email, editor.password);
    await page.goto(`/story/groves/${GROVE}?fragment=${FRAG1}`);
    await expect(field(page, "Fragment title")).toBeVisible({
      timeout: 15_000,
    });
    await expect(field(page, "Teaser")).toHaveValue("");
    await expect(field(page, "Indigeny Earth")).toHaveValue("");

    const title = stamp("frag-title");
    const teaser = stamp("frag-teaser");
    const earth = stamp("frag-earth");

    await fillExact(page, "Fragment title", title);
    await fillExact(page, "Teaser", teaser);
    await fillExact(page, "Indigeny Earth", earth);

    await saveTwice(page, "Save fragment");
    await page.goto(`/story/groves/${GROVE}?fragment=${FRAG1}`);
    await expectExact(page, "Fragment title", title);
    await expectExact(page, "Teaser", teaser);
    await expectExact(page, "Indigeny Earth", earth);

    await page.reload();
    await expectExact(page, "Fragment title", title);
    await expectExact(page, "Teaser", teaser);
    await expectExact(page, "Indigeny Earth", earth);

    const rows = await restSelect<{
      title: { en?: string };
      teaser: { en?: string };
      indigeny_earth: string | null;
    }>(
      `fragments?id=eq.${FRAG1}&select=title,teaser,indigeny_earth`,
    );
    expect(rows[0]?.title?.en).toBe(title);
    expect(rows[0]?.teaser?.en).toBe(teaser);
    expect(rows[0]?.indigeny_earth).toBe(earth);
  });

  test("fragment Indigeny (writer)", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    await restPatch("fragments", `id=eq.${FRAG1}`, {
      indigeny_earth: "Seeded earth for M3h.",
      indigeny_world: "",
      indigeny_body: "",
    });

    await signIn(page, writer.email, writer.password);
    await page.goto(`/story/groves/${GROVE}?fragment=${FRAG1}`);
    await expect(page.getByLabel("Indigeny Earth")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Indigeny Earth")).not.toHaveValue("");
    await expect(page.getByLabel("Indigeny World")).toHaveValue("");
    await expect(page.getByLabel("Indigeny Body")).toHaveValue("");

    const earth = stamp("indy-earth");
    const world = stamp("indy-world");
    const body = stamp("indy-body");

    await fillExact(page, "Indigeny Earth", earth);
    await fillExact(page, "Indigeny World", world);
    await fillExact(page, "Indigeny Body", body);

    await saveTwice(page, "Save Story Notes");
    await page.goto(`/story/groves/${GROVE}?fragment=${FRAG1}`);
    await expectExact(page, "Indigeny Earth", earth);
    await expectExact(page, "Indigeny World", world);
    await expectExact(page, "Indigeny Body", body);

    await page.reload();
    await expectExact(page, "Indigeny Earth", earth);
    await expectExact(page, "Indigeny World", world);
    await expectExact(page, "Indigeny Body", body);

    const rows = await restSelect<{
      indigeny_earth: string | null;
      indigeny_world: string | null;
      indigeny_body: string | null;
    }>(
      `fragments?id=eq.${FRAG1}&select=indigeny_earth,indigeny_world,indigeny_body`,
    );
    expect(rows[0]?.indigeny_earth).toBe(earth);
    expect(rows[0]?.indigeny_world).toBe(world);
    expect(rows[0]?.indigeny_body).toBe(body);
  });

  test("story notes edit", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    await restPatch("threads", `id=eq.${THREAD}`, {
      notes: null,
      title: "Demo wetland thread",
    });

    await signIn(page, writer.email, writer.password);
    await page.goto(`/story/notes?thread=${THREAD}`);
    await expect(field(page, "Thread title")).toBeVisible({
      timeout: 15_000,
    });
    await expect(field(page, "Thread notes")).toHaveValue("");

    const title = stamp("thread-title");
    const notes = stamp("thread-notes");

    await fillExact(page, "Thread title", title);
    await fillExact(page, "Thread notes", notes);

    // saveThread redirects to /story/notes without ?thread= — re-open after each save
    await clickSave(page, "Save thread");
    {
      const rows = await restSelect<{ title: string; notes: string | null }>(
        `threads?id=eq.${THREAD}&select=title,notes`,
      );
      expect(rows[0]?.title).toBe(title);
      expect(rows[0]?.notes).toBe(notes);
    }
    await page.goto(`/story/notes?thread=${THREAD}`);
    await waitForHydratedForm(page);
    await expectExact(page, "Thread title", title);
    await expectExact(page, "Thread notes", notes);

    await clickSave(page, "Save thread");
    {
      const rows = await restSelect<{ title: string; notes: string | null }>(
        `threads?id=eq.${THREAD}&select=title,notes`,
      );
      expect(rows[0]?.title).toBe(title);
      expect(rows[0]?.notes).toBe(notes);
    }
    await page.goto(`/story/notes?thread=${THREAD}`);
    await waitForHydratedForm(page);
    await expectExact(page, "Thread title", title);
    await expectExact(page, "Thread notes", notes);

    await page.reload();
    await waitForHydratedForm(page);
    await expectExact(page, "Thread title", title);
    await expectExact(page, "Thread notes", notes);

    const rows = await restSelect<{ title: string; notes: string | null }>(
      `threads?id=eq.${THREAD}&select=title,notes`,
    );
    expect(rows[0]?.title).toBe(title);
    expect(rows[0]?.notes).toBe(notes);
  });

  test("story notes create", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    await signIn(page, writer.email, writer.password);
    await page.goto("/story/notes");
    await expect(page.getByLabel("New thread title")).toBeVisible({
      timeout: 15_000,
    });

    const title = stamp("new-thread");
    const notes = stamp("new-thread-notes");
    await fillExact(page, "New thread title", title);
    await fillExact(page, "New thread notes", notes);
    await page.getByRole("button", { name: "Create thread" }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible({
      timeout: 20_000,
    });

    const rows = await restSelect<{ title: string; notes: string | null }>(
      `threads?title=eq.${encodeURIComponent(title)}&select=title,notes`,
    );
    expect(rows[0]?.title).toBe(title);
    expect(rows[0]?.notes).toBe(notes);
  });

  test("release details", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await restPatch("releases", `id=eq.${DRAFT_RELEASE}`, {
      notes: null,
      name: "M3a preview draft",
    });

    await signIn(page, editor.email, editor.password);
    await page.goto(`/story/releases/${DRAFT_RELEASE}`);
    await expect(page.getByLabel("Release name")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel("Release notes")).toHaveValue("");

    const name = stamp("release-name");
    const notes = stamp("release-notes");
    await fillExact(page, "Release name", name);
    await fillExact(page, "Release notes", notes);

    await saveTwice(page, "Save release metadata");
    await expectExact(page, "Release name", name);
    await expectExact(page, "Release notes", notes);

    await page.reload();
    await expectExact(page, "Release name", name);
    await expectExact(page, "Release notes", notes);

    const rows = await restSelect<{ name: string; notes: string | null }>(
      `releases?id=eq.${DRAFT_RELEASE}&select=name,notes`,
    );
    expect(rows[0]?.name).toBe(name);
    expect(rows[0]?.notes).toBe(notes);
  });

  test("release create", async ({ page }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);
    await page.goto("/story/releases/new");
    await expect(page.getByLabel("Release name")).toBeVisible({
      timeout: 15_000,
    });

    const name = stamp("create-release");
    const notes = stamp("create-release-notes");
    await fillExact(page, "Release name", name);
    await fillExact(page, "Release notes", notes);
    await page.getByRole("button", { name: "Create release" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible({
      timeout: 20_000,
    });
    await expectExact(page, "Release name", name);
    await expectExact(page, "Release notes", notes);

    const rows = await restSelect<{ name: string; notes: string | null }>(
      `releases?name=eq.${encodeURIComponent(name)}&select=name,notes`,
    );
    expect(rows[0]?.name).toBe(name);
    expect(rows[0]?.notes).toBe(notes);
  });

  test("revision edit (draft) — teaser, hints, transcripts", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    // Prior publish e2e may have flipped this to published — force draft for edit.
    await restPatch("fragment_revisions", `id=eq.${REV_F10_R2}`, {
      status: "draft",
      change_teaser: { en: "" },
      change_note: null,
    });
    const versions = await restSelect<{
      id: string;
      time_window: string;
    }>(
      `revision_versions?revision_id=eq.${REV_F10_R2}&select=id,time_window`,
    );
    const dayVer = versions.find((v) => v.time_window === "day");
    if (!dayVer) throw new Error("day version missing");
    await restPatch("revision_versions", `id=eq.${dayVer.id}`, {
      other_time_hint: { en: "" },
      transcript: "Seeded day transcript for M3h.",
    });

    await signIn(page, writer.email, writer.password);
    await page.goto(
      `/story/groves/${GROVE}/fragments/${FRAG10}/revisions/${REV_F10_R2}`,
    );
    await expect(page.getByLabel("Change teaser")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Change teaser")).toHaveValue("");
    await expect(page.getByLabel("Day other-time hint")).toHaveValue("");
    await expect(page.getByLabel("Day transcript")).not.toHaveValue("");

    const teaser = stamp("rev-teaser");
    const hint = stamp("rev-day-hint");
    const transcript = stamp("rev-day-transcript");
    const note = stamp("rev-note");

    await fillExact(page, "Change note", note);
    await fillExact(page, "Change teaser", teaser);
    await fillExact(page, "Day other-time hint", hint);
    await fillExact(page, "Day transcript", transcript);

    await saveTwice(page, "Save revision");
    await expectExact(page, "Change teaser", teaser);
    await expectExact(page, "Day other-time hint", hint);
    await expectExact(page, "Day transcript", transcript);
    await expectExact(page, "Change note", note);

    await page.reload();
    await expectExact(page, "Change teaser", teaser);
    await expectExact(page, "Day other-time hint", hint);
    await expectExact(page, "Day transcript", transcript);
    await expectExact(page, "Change note", note);

    const revRows = await restSelect<{
      change_teaser: { en?: string };
      change_note: string | null;
    }>(
      `fragment_revisions?id=eq.${REV_F10_R2}&select=change_teaser,change_note`,
    );
    expect(revRows[0]?.change_teaser?.en).toBe(teaser);
    expect(revRows[0]?.change_note).toBe(note);

    const verRows = await restSelect<{
      transcript: string;
      other_time_hint: { en?: string };
    }>(
      `revision_versions?id=eq.${dayVer.id}&select=transcript,other_time_hint`,
    );
    expect(verRows[0]?.transcript).toBe(transcript);
    expect(verRows[0]?.other_time_hint?.en).toBe(hint);
  });
});
