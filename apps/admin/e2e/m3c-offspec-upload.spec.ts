import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { loadUsers, signIn } from "./auth";

test.describe("M3c off-spec upload", () => {
  test("off-spec WAV shows LOUDNESS and/or AUDIO_FORMAT warnings", async ({
    page,
  }) => {
    const auth = loadUsers();
    const editor = auth.users.editor ?? auth.users.writer;
    if (!editor) throw new Error("editor/writer missing");

    await signIn(page, editor.email, editor.password);
    await page.getByRole("link", { name: "Audio" }).click();
    await expect(page.getByRole("heading", { name: "Audio" })).toBeVisible();

    const stamp = Date.now();
    const title = `Offspec ${stamp}`;
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await page.getByLabel("Kind", { exact: true }).selectOption("narration");
    const fixture = join(__dirname, "fixtures", "offspec-tone.wav");
    await page.getByLabel("Audio file").setInputFiles(fixture);
    await page.getByRole("button", { name: "Upload" }).click();

    // New upload redirects to detail; duplicate-sha stays on the form with a link.
    const detailHeading = page.getByRole("heading", { name: title });
    const dupLink = page.getByRole("link", {
      name: /This file is already in the library|already in the library/i,
    });
    // The duplicate message wraps a link to the existing title
    const existingLink = page.locator('p[role="status"] a').first();

    await Promise.race([
      detailHeading.waitFor({ state: "visible", timeout: 30_000 }),
      existingLink.waitFor({ state: "visible", timeout: 30_000 }),
    ]).catch(() => undefined);

    if (await existingLink.isVisible().catch(() => false)) {
      await existingLink.click();
    }

    await expect(
      page.getByLabel("AUDIO_FORMAT: format differs from AUDIO_SPEC").first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/LOUDNESS:/).first()).toBeVisible({
      timeout: 10_000,
    });
    void dupLink;
  });
});
