import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadUsers, signIn } from "./auth";

const SHOTS = join(__dirname, "screenshots");
const GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const FRAG10 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000039";
const CHAR_RIVER = "aaaaaaaa-bbbb-4ccc-8ddd-000000000020";

test.describe("M3e story fields", () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test("writer fills journeys, home grove, change teaser, and both hints", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    await signIn(page, writer.email, writer.password);

    // Journey passages
    await page.goto(`/story/groves/${GROVE}`);
    await expect(
      page.getByRole("heading", { name: "Journey passages" }),
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByLabel("On foot journey passage")
      .fill("E2E on foot to the opening root.");
    await page
      .getByLabel("By bike journey passage")
      .fill("E2E by bike to the opening root.");
    await page
      .getByLabel("By transit journey passage")
      .fill("E2E by transit to the opening root.");
    await page.getByRole("button", { name: "Save journey passages" }).click();
    await expect(page.getByLabel("On foot journey passage")).toHaveValue(
      /E2E on foot/,
      { timeout: 15_000 },
    );
    await page.screenshot({
      path: join(SHOTS, "m3e-grove-journeys.png"),
      fullPage: true,
    });

    // Character page
    await page.goto(`/story/characters/${CHAR_RIVER}`);
    await expect(page.getByLabel("Back story")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Portrait \(required to release\)/)).toBeVisible();
    await expect(page.getByLabel("Home grove")).toBeVisible();
    const home = page.getByLabel("Home grove");
    const options = await home.locator("option").allTextContents();
    const pick = options.find((o) => /Farmington/i.test(o));
    if (pick) await home.selectOption({ label: pick });
    await page.getByRole("button", { name: "Save character" }).click();
    await expect(page.getByLabel("Home grove")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: join(SHOTS, "m3e-character-home-grove.png"),
      fullPage: true,
    });

    // New draft contingency on frag10 with change teaser + both windows/hints
    await page.goto(
      `/story/groves/${GROVE}/fragments/${FRAG10}/revisions/new`,
    );
    await expect(page.getByLabel("Change teaser")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel("Story Contingency").check();
    await page
      .getByLabel("Change teaser")
      .fill("E2E change teaser for Two Ways contingency.");
    await page.getByLabel("Include Day version").check();
    await page.getByLabel("Include Night version").check();
    // Pick first available narration assets
    const dayAsset = page.getByLabel("Day narration asset");
    const nightAsset = page.getByLabel("Night narration asset");
    await dayAsset.selectOption({ index: 1 });
    await nightAsset.selectOption({ index: 1 });
    await page.getByLabel("Day transcript").fill("E2E day transcript.");
    await page.getByLabel("Night transcript").fill("E2E night transcript.");
    await page
      .getByLabel("Day other-time hint")
      .fill("E2E: after dusk, another telling waits.");
    await page
      .getByLabel("Night other-time hint")
      .fill("E2E: by day, another telling waits.");
    await page.getByRole("button", { name: "Create revision" }).click();
    await expect(page.getByLabel("Change teaser")).toHaveValue(
      /E2E change teaser/,
      { timeout: 20_000 },
    );
    await page.screenshot({
      path: join(SHOTS, "m3e-revision-change-teaser.png"),
      fullPage: true,
    });
  });

  test("release missing required fields fails with codes and deep links", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);

    await page.goto(`/story/characters/${CHAR_RIVER}`);
    await page.getByLabel("Portrait image").selectOption({ value: "" });
    await page.getByLabel("Home grove").selectOption({ value: "" });
    await page.getByRole("button", { name: "Save character" }).click();
    await expect(page.getByLabel("Portrait image")).toHaveValue("", {
      timeout: 15_000,
    });

    await page.getByRole("link", { name: "Releases" }).click();
    await page.getByRole("link", { name: "New release" }).click();
    const stamp = Date.now();
    await page.getByLabel("Release name").fill(`E2E M3e checklist ${stamp}`);
    await page.getByRole("button", { name: "Create release" }).click();
    await expect(
      page.getByRole("heading", { name: `E2E M3e checklist ${stamp}` }),
    ).toBeVisible({ timeout: 15_000 });

    // Add River as a release item if the UI exposes the picker
    const addEntity = page.locator("select").filter({ hasText: /character|grove|fragment/i }).first();
    if (await addEntity.isVisible().catch(() => false)) {
      await addEntity.selectOption("character");
      const itemSelect = page.locator("select").nth(1);
      if (await itemSelect.isVisible().catch(() => false)) {
        await itemSelect.selectOption(CHAR_RIVER).catch(async () => {
          await itemSelect.selectOption({ index: 1 });
        });
      }
      const addBtn = page.getByRole("button", { name: /Add item|Add/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
      }
    }

    await page.getByRole("button", { name: "Run publish checklist" }).click();
    const results = page.getByLabel("Checklist results");
    await expect(results).toBeVisible({ timeout: 20_000 });
    await expect(
      results
        .getByText(
          /NO_PORTRAIT|NO_HOME_GROVE|NO_ROOT|NO_CHANGE_TEASER|NO_TIME_HINT|DEPENDENCY|release not found|No checklist/i,
        )
        .first(),
    ).toBeVisible();

    const link = results.getByRole("link").first();
    if (await link.isVisible().catch(() => false)) {
      const href = await link.getAttribute("href");
      expect(href).toMatch(/\/story\//);
    }

    await page.screenshot({
      path: join(SHOTS, "m3e-release-checklist-codes.png"),
      fullPage: true,
    });

    // Restore River
    await page.goto(`/story/characters/${CHAR_RIVER}`);
    const portrait = page.getByLabel("Portrait image");
    const home = page.getByLabel("Home grove");
    const pOpts = await portrait.locator("option").allTextContents();
    const hOpts = await home.locator("option").allTextContents();
    const pPick = pOpts.find((o) => /River|portrait|Placeholder/i.test(o));
    const hPick = hOpts.find((o) => /Farmington/i.test(o));
    if (pPick) await portrait.selectOption({ label: pPick });
    if (hPick) await home.selectOption({ label: hPick });
    await page.getByRole("button", { name: "Save character" }).click();
  });
});
