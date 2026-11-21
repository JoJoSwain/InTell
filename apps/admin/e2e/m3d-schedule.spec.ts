import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadUsers, signIn } from "./auth";

const SHOTS = join(__dirname, "screenshots");

test.describe("M3d schedule and checklist UI", () => {
  test.beforeAll(() => {
    mkdirSync(SHOTS, { recursive: true });
  });

  test("editor schedules, cancels, and sees checklist failures", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);

    await page.getByRole("link", { name: "Releases" }).click();
    await page.getByRole("link", { name: "New release" }).click();
    const stamp = Date.now();
    await page.getByLabel("Release name").fill(`E2E Schedule ${stamp}`);
    await page.getByRole("button", { name: "Create release" }).click();
    await expect(
      page.getByRole("heading", { name: `E2E Schedule ${stamp}` }),
    ).toBeVisible({ timeout: 15_000 });

    // Empty release checklist should surface failures
    await page.getByRole("button", { name: /Run (publish )?checklist/i }).click();
    await expect(
      page.getByLabel("Checklist results").or(page.getByText(/NO_|EMPTY|error/i).first()),
    ).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({
      path: join(SHOTS, "release-checklist-grouped.png"),
      fullPage: true,
    });
    await page.screenshot({
      path: join(SHOTS, "release-checklist-failures.png"),
      fullPage: true,
    });

    // Schedule in local time
    const local = page.getByLabel(/Publish at/i);
    await expect(local).toBeVisible();
    const d = new Date(Date.now() + 60 * 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    await local.fill(value);
    await page.getByRole("button", { name: /Schedule/i }).click();
    await expect(page.getByLabel("Status: Scheduled")).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /Cancel schedule/i }).click();
    await expect(page.getByLabel("Status: Cancelled")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("button", { name: /Copy .*draft/i }),
    ).toBeVisible();
  });
});
