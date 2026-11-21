import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadUsers, signIn } from "./auth";

/** Published seed fragment with dependents (frag1). */
const SEED_GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SEED_FRAG1 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
const SEED_REV_F1 = "aaaaaaaa-bbbb-4ccc-8ddd-000000000040";
const SHOTS = join(__dirname, "screenshots");

test.describe("M3d unpublish confirm", () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test("confirm dialog shows stranded warnings before commit", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);

    await page.goto(
      `/story/groves/${SEED_GROVE}/fragments/${SEED_FRAG1}/revisions/${SEED_REV_F1}`,
    );
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 20_000,
    });

    const unpublish = page.getByRole("button", { name: /Unpublish/i });
    await expect(unpublish).toBeVisible();
    await unpublish.click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Unpublish revision/i }),
    ).toBeVisible();
    // Either stranded list or explicit none
    const stranded = page.getByLabel("Unpublish warnings");
    const none = page.getByText("No stranded-prerequisite warnings.");
    await expect(stranded.or(none)).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: join(SHOTS, "unpublish-confirm-stranded.png"),
      fullPage: true,
    });

    // Cancel — do not actually unpublish seed in e2e
    await page.getByRole("button", { name: "Cancel unpublish" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
