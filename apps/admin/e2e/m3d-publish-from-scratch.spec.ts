import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { GrovePack } from "@intell/shared";
import { loadUsers, signIn, waitForClientReady } from "./auth";

const SEED_REGION = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
/** Published seed Beginning — cross-grove prerequisite target. */
const SEED_FRAG_BEGINNING = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const SHOTS = join(__dirname, "screenshots");

/** Small polygon around Farmington sun reference (~41.1, -111.9). No Maps API. */
const BOUNDARY = JSON.stringify({
  type: "Polygon",
  coordinates: [
    [
      [-111.905, 41.095],
      [-111.895, 41.095],
      [-111.895, 41.105],
      [-111.905, 41.105],
      [-111.905, 41.095],
    ],
  ],
});

async function fillFirstRevisionDayOnly(
  page: import("@playwright/test").Page,
  transcript: string,
) {
  await expect(page.getByLabel("Story Contingency")).toBeVisible();
  await page.getByLabel("Include Day version").check();
  const dayAsset = page.getByLabel("Day narration asset");
  await dayAsset.selectOption({ index: 1 });
  await page.getByLabel("Day transcript").fill(transcript);
  const night = page.getByLabel("Include Night version");
  if (await night.isChecked()) await night.uncheck();
  await page.getByRole("button", { name: "Create revision" }).click();
  await expect(page.getByText(/Rev 1/)).toBeVisible({ timeout: 20_000 });
}

/** Call run-jobs until this release is published (or failed). Ignores leftover jobs from prior suite cases. */
async function waitUntilReleasePublished(
  supabaseUrl: string,
  serviceRoleKey: string,
  releaseId: string,
  maxRounds = 60,
) {
  for (let i = 0; i < maxRounds; i++) {
    const statusRes = await fetch(
      `${supabaseUrl}/rest/v1/releases?id=eq.${releaseId}&select=status`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!statusRes.ok) {
      throw new Error(`release status ${statusRes.status}: ${await statusRes.text()}`);
    }
    const rows = (await statusRes.json()) as { status?: string }[];
    const status = rows[0]?.status;
    if (status === "published") return;
    if (status === "failed") {
      throw new Error(`release ${releaseId} failed during pack go-live`);
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/run-jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) {
      throw new Error(`run-jobs ${res.status}: ${await res.text()}`);
    }
  }
  throw new Error(`release ${releaseId} did not reach published`);
}

test.describe("M3d publish from scratch", () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test("grove → physical + Day-only + cross-grove prereq → publish → GrovePack", async ({
    page,
    request,
  }) => {
    test.setTimeout(360_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");
    const serviceRoleKey = auth.serviceRoleKey;
    if (!serviceRoleKey) {
      throw new Error(
        "serviceRoleKey missing — re-run pnpm --filter @intell/admin e2e:prepare",
      );
    }

    await signIn(page, editor.email, editor.password);

    // --- New grove (GeoJSON boundary; no Maps) ---
    await page.getByRole("link", { name: "Groves" }).click();
    await page.getByRole("link", { name: "New grove" }).click();
    const stamp = Date.now();
    const groveName = `M3d Grove ${stamp}`;
    await page.getByLabel("Grove name").fill(groveName);
    await page.getByLabel("Premise").fill("M3d from-scratch premise");
    await page.getByLabel("Boundary GeoJSON").fill(BOUNDARY);
    await page.getByLabel("Region").selectOption(SEED_REGION);
    await page.getByRole("button", { name: "Create grove" }).click();
    await page.waitForURL(/\/story\/groves\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await waitForClientReady(page);
    await expect(page.getByRole("heading", { name: groveName })).toBeVisible({
      timeout: 20_000,
    });
    const groveUrl = page.url();
    const groveId = new URL(groveUrl).pathname.split("/").pop()!;

    // --- Physical marker fragment ---
    await page.getByRole("link", { name: "New fragment" }).click();
    await page.getByLabel("Fragment title").fill(`Physical ${stamp}`);
    await page.getByLabel("Teaser").fill("Physical teaser");
    await page.getByLabel("Visibility").selectOption("physical");
    await page.getByLabel("Latitude").fill("41.1");
    await page.getByLabel("Longitude").fill("-111.9");
    await page.getByRole("button", { name: "Add fragment" }).click();
    await expect(page.getByText(`Physical ${stamp}`).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(groveUrl);
    await expect(page.getByRole("heading", { name: groveName })).toBeVisible({
      timeout: 15_000,
    });

    // --- Day-only fragment with cross-grove prereq on seed Beginning ---
    await page.getByRole("link", { name: "New fragment" }).click();
    await expect(page.getByRole("heading", { name: "Add fragment" })).toBeVisible();
    await page.getByLabel("Fragment title").fill(`DayOnly ${stamp}`);
    await page.getByLabel("Teaser").fill("Day-only teaser");
    await page.getByLabel("Tier").selectOption("root");
    await page.getByLabel("Latitude").fill("41.101");
    await page.getByLabel("Longitude").fill("-111.901");
    await page.getByRole("button", { name: "Add fragment" }).click();
    await expect(
      page.getByRole("link", { name: new RegExp(`DayOnly ${stamp}`) }).first(),
    ).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("link", { name: new RegExp(`DayOnly ${stamp}`) })
      .first()
      .click();
    await waitForClientReady(page);
    await page.getByRole("button", { name: "Add OR group" }).click();
    const multi = page.getByLabel("Prerequisite group 1 members");
    await multi.evaluate((el, beginningId) => {
      const select = el as HTMLSelectElement;
      for (const opt of Array.from(select.options)) {
        opt.selected = opt.value === beginningId;
      }
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, SEED_FRAG_BEGINNING);
    await page.getByRole("button", { name: "Save prerequisites" }).click();
    await expect(
      page.getByRole("link", { name: new RegExp(`DayOnly ${stamp}`) }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // First revision on DayOnly — Story Contingency locked, Day only
    await page
      .getByRole("link", { name: new RegExp(`DayOnly ${stamp}`) })
      .first()
      .click();
    await page.getByRole("link", { name: "Open fragment revisions" }).click();
    await page.getByRole("link", { name: "Add first revision" }).click();
    await expect(
      page.getByText(
        "The first revision of a fragment is always a Story Contingency.",
      ),
    ).toBeVisible();
    await page.screenshot({
      path: join(SHOTS, "revision-first-contingency.png"),
      fullPage: true,
    });
    await fillFirstRevisionDayOnly(
      page,
      "Staff-typed day transcript for M3d DayOnly.",
    );
    // .../fragments/{fragmentId}/revisions/{revisionId}(?_=…)
    const dayPath = new URL(page.url()).pathname.split("/");
    const dayRevisionId = dayPath[dayPath.length - 1]!;
    const dayFragmentId = dayPath[dayPath.length - 3]!;

    // First revision on Physical
    await page.goto(groveUrl);
    await page
      .getByRole("link", { name: new RegExp(`Physical ${stamp}`) })
      .first()
      .click();
    await page.getByRole("link", { name: "Open fragment revisions" }).click();
    await page.getByRole("link", { name: "Add first revision" }).click();
    await fillFirstRevisionDayOnly(
      page,
      "Staff-typed day transcript for M3d Physical.",
    );
    const physPath = new URL(page.url()).pathname.split("/");
    const physicalRevisionId = physPath[physPath.length - 1]!;
    const physicalFragmentId = physPath[physPath.length - 3]!;

    // --- Release ---
    await page.getByRole("link", { name: "Releases" }).click();
    await page.getByRole("link", { name: "New release" }).click();
    await page.getByLabel("Release name").fill(`M3d Release ${stamp}`);
    await page.getByRole("button", { name: "Create release" }).click();
    await expect(
      page.getByRole("heading", { name: `M3d Release ${stamp}` }),
    ).toBeVisible({ timeout: 15_000 });
    await waitForClientReady(page);
    const releaseId = page.url().split("/").pop()!.split("?")[0]!;

    async function addItem(entity: string, entityId: string) {
      await waitForClientReady(page);
      await page.getByLabel("Release item entity type").selectOption(entity);
      const label =
        entity === "grove"
          ? "Select Grove to add"
          : entity === "fragment"
            ? "Select Fragment to add"
            : "Select Revision to add";
      await page.getByLabel(label).selectOption(entityId);
      await page.getByRole("button", { name: "Add release item" }).click();
      await expect(
        page.getByRole("heading", { name: `M3d Release ${stamp}` }),
      ).toBeVisible({ timeout: 15_000 });
    }

    // Include grove + fragments + revisions so the checklist can green without
    // racing the "Add missing" button (that race was the earlier soft-assert gap).
    await addItem("grove", groveId);
    await addItem("fragment", dayFragmentId);
    await addItem("fragment", physicalFragmentId);
    await addItem("revision", dayRevisionId);
    await addItem("revision", physicalRevisionId);

    // Checklist → add any remaining DEPENDENCY_UNPUBLISHED items until stable
    for (let i = 0; i < 8; i++) {
      await page.getByRole("button", { name: "Run publish checklist" }).click();
      await expect(
        page.getByLabel("Checklist results").or(page.getByText(/no failures/i)),
      ).toBeVisible({ timeout: 20_000 });
      const addMissing = page.getByRole("button", {
        name: "Add missing dependency items from checklist",
      });
      if (await addMissing.isVisible().catch(() => false)) {
        await addMissing.click();
        await expect(
          page.getByRole("heading", { name: `M3d Release ${stamp}` }),
        ).toBeVisible({ timeout: 15_000 });
        continue;
      }
      break;
    }

    await page.screenshot({
      path: join(SHOTS, "release-checklist-grouped.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Publish release now" }).click();

    // Reach publishing or published; then drain jobs until published.
    await expect(
      page.getByLabel(/Status: (Publishing…|Published|Failed)/),
    ).toBeVisible({ timeout: 120_000 });

    if (await page.getByLabel("Status: Failed").isVisible().catch(() => false)) {
      await page.screenshot({
        path: join(SHOTS, "release-checklist-grouped.png"),
        fullPage: true,
      });
      throw new Error("release failed checklist/publish — see screenshot");
    }

    await waitUntilReleasePublished(
      auth.supabaseUrl,
      serviceRoleKey,
      releaseId,
    );

    await page.reload();
    await expect(page.getByLabel("Status: Published")).toBeVisible({
      timeout: 30_000,
    });

    // Pack index → download → GrovePack zod
    const idxRes = await request.post(
      `${auth.supabaseUrl}/rest/v1/rpc/get_pack_index`,
      {
        headers: {
          apikey: auth.anonKey,
          Authorization: `Bearer ${auth.anonKey}`,
          "Content-Type": "application/json",
        },
        data: {},
      },
    );
    expect(idxRes.ok()).toBeTruthy();
    const index = (await idxRes.json()) as {
      id?: string;
      scope?: string;
      manifestPath?: string;
    }[];
    const entry = index.find((e) => e.scope === "grove" && e.id === groveId);
    expect(entry?.manifestPath, JSON.stringify(index)).toBeTruthy();

    const packRes = await request.get(
      `${auth.supabaseUrl}/storage/v1/object/public/public-media/${entry!.manifestPath}`,
    );
    expect(packRes.ok(), await packRes.text()).toBeTruthy();
    const packJson = await packRes.json();
    const pack = GrovePack.parse(packJson);

    expect(pack.groveId).toBe(groveId);
    expect(JSON.stringify(pack)).not.toMatch(/marker_code/i);
    expect(JSON.stringify(pack)).not.toMatch(/"markerCode"/);

    const physical = pack.fragments.find((f) =>
      (f.title.en ?? "").includes(`Physical ${stamp}`),
    );
    expect(physical).toBeTruthy();
    expect(physical!.visibility).toBe("physical");
    expect(physical!.markerHash).toMatch(/^[a-f0-9]{64}$/);
    expect(physical!.radiusM).toBeUndefined();

    const dayOnly = pack.fragments.find((f) =>
      (f.title.en ?? "").includes(`DayOnly ${stamp}`),
    );
    expect(dayOnly).toBeTruthy();
    const dayRev = pack.revisions.find((r) => r.fragmentId === dayOnly!.id);
    expect(dayRev).toBeTruthy();
    expect(dayRev!.versions.map((v) => v.timeWindow).sort()).toEqual(["day"]);

    expect(
      pack.externalPrerequisites.some(
        (e) => e.fragmentId === SEED_FRAG_BEGINNING,
      ),
    ).toBeTruthy();
  });
});
