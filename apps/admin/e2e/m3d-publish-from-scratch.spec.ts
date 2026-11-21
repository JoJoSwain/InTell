import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadUsers, signIn } from "./auth";

const SEED_REGION = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";
const SHOTS = join(__dirname, "screenshots");

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

test.describe("M3d publish from scratch", () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test("grove → physical + Day-only → revision → release → publish", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);

    // New grove
    await page.getByRole("link", { name: "Groves" }).click();
    await page.getByRole("link", { name: "New grove" }).click();
    const stamp = Date.now();
    const groveName = `M3d Grove ${stamp}`;
    await page.getByLabel("Grove name").fill(groveName);
    await page.getByLabel("Premise").fill("M3d from-scratch premise");
    await page.getByLabel("Boundary GeoJSON").fill(BOUNDARY);
    await page.getByLabel("Region").selectOption(SEED_REGION);
    await page.getByRole("button", { name: "Create grove" }).click();
    await expect(page.getByRole("heading", { name: groveName })).toBeVisible({
      timeout: 20_000,
    });
    const groveUrl = page.url();
    const groveId = groveUrl.split("/").pop()!;

    // Physical fragment
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

    // Day-only root fragment
    await page.getByRole("link", { name: "New fragment" }).click();
    await page.getByLabel("Fragment title").fill(`DayOnly ${stamp}`);
    await page.getByLabel("Teaser").fill("Day-only teaser");
    await page.getByLabel("Tier").selectOption("root");
    await page.getByLabel("Latitude").fill("41.101");
    await page.getByLabel("Longitude").fill("-111.901");
    await page.getByRole("button", { name: "Add fragment" }).click();
    await expect(page.getByText(`DayOnly ${stamp}`).first()).toBeVisible({
      timeout: 15_000,
    });

    // Open DayOnly → Revisions → first revision
    await page.getByRole("link", { name: new RegExp(`DayOnly ${stamp}`) }).click();
    await page.getByRole("link", { name: "Open fragment revisions" }).click();
    await page.getByRole("link", { name: "Add first revision" }).click();
    await expect(
      page.getByText("The first revision of a fragment is always a Story Contingency."),
    ).toBeVisible();
    await expect(page.getByLabel("Story Contingency")).toBeVisible();
    await page.screenshot({
      path: join(SHOTS, "revision-first-contingency.png"),
      fullPage: true,
    });

    // Include Day only; pick first narration asset
    await page.getByLabel("Include Day version").check();
    const dayAsset = page.getByLabel("Day narration asset");
    await dayAsset.selectOption({ index: 1 });
    await page.getByLabel("Day transcript").fill("Staff-typed day transcript for M3d.");
    // Ensure night not included
    const night = page.getByLabel("Include Night version");
    if (await night.isChecked()) await night.uncheck();

    await page.getByRole("button", { name: "Create revision" }).click();
    await expect(page.getByText(/Rev 1/)).toBeVisible({ timeout: 20_000 });
    const revisionUrl = page.url();
    const revisionId = revisionUrl.split("/").pop()!;

    // Release with grove + revision
    await page.getByRole("link", { name: "Releases" }).click();
    await page.getByRole("link", { name: "New release" }).click();
    await page.getByLabel("Release name").fill(`M3d Release ${stamp}`);
    await page.getByRole("button", { name: "Create release" }).click();
    await expect(
      page.getByRole("heading", { name: `M3d Release ${stamp}` }),
    ).toBeVisible({ timeout: 15_000 });

    // Add grove
    await page.getByLabel("Release item entity type").selectOption("grove");
    await page.getByLabel("Select Grove to add").selectOption(groveId);
    await page.getByRole("button", { name: "Add release item" }).click();
    await expect(page.getByText(/grove/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Add revision
    await page.getByLabel("Release item entity type").selectOption("revision");
    await page.getByLabel("Select Revision to add").selectOption(revisionId);
    await page.getByRole("button", { name: "Add release item" }).click();

    // May need fragment + more deps — run checklist and add missing
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /Run (publish )?checklist/i }).click();
      await page.waitForTimeout(1500);
      const addMissing = page.getByRole("button", {
        name: /Add missing/i,
      });
      if (await addMissing.isVisible().catch(() => false)) {
        await addMissing.click();
        await page.waitForTimeout(1000);
        continue;
      }
      break;
    }

    await page.getByRole("button", { name: /Publish (release )?now/i }).click();
    // After commit, status is publishing or published
    await expect(
      page.getByLabel(/Status: (Publishing…|Published)/),
    ).toBeVisible({ timeout: 120_000 });

    // Soft-poll until published or failed (packs async)
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      const published = await page
        .getByLabel("Status: Published")
        .isVisible()
        .catch(() => false);
      const failed = await page
        .getByLabel("Status: Failed")
        .isVisible()
        .catch(() => false);
      if (published) break;
      if (failed) {
        throw new Error("release failed — see checklist on page");
      }
      await page.waitForTimeout(4000);
      await page.reload();
    }
    await expect(page.getByLabel("Status: Published")).toBeVisible({
      timeout: 30_000,
    });
  });
});
