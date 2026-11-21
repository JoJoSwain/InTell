import { expect, test } from "@playwright/test";
import { loadUsers, passwordGrant, signIn } from "./auth";

/** Seed empty draft release (see seed.sql). */
const DRAFT_RELEASE = "aaaaaaaa-bbbb-4ccc-8ddd-0000000000e1";

test.describe("M3d writer refusal", () => {
  test("Publish control absent; forced publish → 403", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    await signIn(page, writer.email, writer.password);

    await page.getByRole("link", { name: "Releases" }).click();
    await expect(page.getByRole("heading", { name: "Releases" })).toBeVisible();
    // Writers may read Releases but cannot create
    await expect(page.getByRole("link", { name: "New release" })).toHaveCount(0);

    await page.goto(`/story/releases/${DRAFT_RELEASE}`);
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 15_000,
    });
    // Publish now must be ABSENT for writers (editor+ only)
    await expect(
      page.getByRole("button", { name: "Publish now" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Publish release now" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Schedule release" }),
    ).toHaveCount(0);

    const token = await passwordGrant(auth, "writer");
    const res = await request.post(
      `${auth.supabaseUrl}/functions/v1/publish`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: auth.anonKey,
          "Content-Type": "application/json",
        },
        data: { releaseId: DRAFT_RELEASE },
      },
    );
    expect(res.status()).toBe(403);
  });
});
