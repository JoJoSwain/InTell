import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadUsers, signIn } from "./auth";

/** Published seed Beginning — Bridge Start in the other seed grove requires it. */
const SEED_GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SEED_FRAG1 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const BRIDGE_START = "aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1";
const SHOTS = join(__dirname, "screenshots");

test.describe("M3d unpublish confirm", () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test("confirm dialog names cross-grove stranded fragment before commit", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);

    // Unpublish the *fragment* (stranded helper is fragment-scoped), not a revision.
    await page.goto(`/story/groves/${SEED_GROVE}?fragment=${SEED_FRAG1}`);
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 20_000,
    });

    const unpublish = page.getByRole("button", {
      name: "Unpublish fragment",
    });
    await expect(unpublish).toBeVisible();
    await unpublish.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Unpublish fragment/i }),
    ).toBeVisible();

    const warnings = page.getByLabel("Unpublish warnings");
    await expect(warnings).toBeVisible({ timeout: 15_000 });
    // Cross-grove dependent Bridge Start must be named before Confirm.
    await expect(warnings).toContainText("Bridge Start");
    await expect(warnings).toContainText(BRIDGE_START);

    await page.screenshot({
      path: join(SHOTS, "unpublish-confirm-stranded.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Cancel unpublish" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
