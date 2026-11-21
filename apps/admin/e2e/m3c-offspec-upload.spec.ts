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
    await page.getByLabel("Title").fill(`Offspec ${stamp}`);
    await page.getByLabel("Kind").selectOption("narration");
    const fixture = join(__dirname, "fixtures", "offspec-tone.wav");
    await page.getByLabel("Audio file").setInputFiles(fixture);
    await page.getByRole("button", { name: "Upload" }).click();

    // Warnings appear during/after analyze (AUDIO_FORMAT for wav; LOUDNESS likely)
    await expect(
      page
        .getByLabel("Checklist issues")
        .or(page.getByText("AUDIO_FORMAT"))
        .or(page.getByText("LOUDNESS")),
    ).toBeVisible({ timeout: 30_000 });
  });
});
