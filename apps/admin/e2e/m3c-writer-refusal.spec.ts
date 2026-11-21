import { expect, test } from "@playwright/test";
import { loadUsers, passwordGrant, signIn } from "./auth";

const SEED_GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SEED_FRAG = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";

test.describe("M3c writer refusal", () => {
  test("Story Notes OK; grove create / lat / marker rotate refused", async ({
    page,
    request,
  }) => {
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing");

    await signIn(page, writer.email, writer.password);

    // Story Notes OK
    await page.getByRole("link", { name: "Story Notes" }).click();
    await expect(
      page.getByRole("heading", { name: "Story Notes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create thread" }),
    ).toBeVisible();

    // Grove create UI hidden
    await page.getByRole("link", { name: "Groves" }).click();
    await expect(page.getByRole("heading", { name: "Groves" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New grove" })).toHaveCount(0);
    await page.goto("/story/groves/new");
    await expect(page.getByRole("heading", { name: "Groves" })).toBeVisible();

    const token = await passwordGrant(auth, "writer");
    const headers = {
      Authorization: `Bearer ${token}`,
      apikey: auth.anonKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    // Forced grove insert refused by RLS
    const groveRes = await request.post(
      `${auth.supabaseUrl}/rest/v1/groves`,
      {
        headers,
        data: {
          region_id: "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
          slug: `writer-refuse-${Date.now()}`,
          name: { en: "Nope" },
          premise: { en: "Nope" },
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-111.9, 41.1],
                [-111.89, 41.1],
                [-111.89, 41.11],
                [-111.9, 41.11],
                [-111.9, 41.1],
              ],
            ],
          },
        },
      },
    );
    expect(groveRes.status()).toBeGreaterThanOrEqual(400);

    // Forced fragment lat change refused
    const locRes = await request.post(
      `${auth.supabaseUrl}/rest/v1/rpc/fn_set_fragment_location`,
      {
        headers,
        data: {
          p_fragment_id: SEED_FRAG,
          p_lat: 41.2,
          p_lng: -111.8,
        },
      },
    );
    // RLS update finds 0 rows → P0002 or 400/403
    expect(locRes.ok()).toBeFalsy();

    // Forced marker rotate refused
    const markerRes = await request.patch(
      `${auth.supabaseUrl}/rest/v1/fragments?id=eq.${SEED_FRAG}`,
      {
        headers,
        data: { marker_code: "ABCD2345" },
      },
    );
    // Writer column guard / RLS: should not apply the change
    expect([401, 403, 400, 409].includes(markerRes.status()) || markerRes.status() === 204 || markerRes.status() === 200).toBeTruthy();
    // Verify row unchanged for marker when writer tried (F1 / RLS)
    const check = await request.get(
      `${auth.supabaseUrl}/rest/v1/fragments?id=eq.${SEED_FRAG}&select=marker_code`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: auth.anonKey,
        },
      },
    );
    const rows = (await check.json()) as { marker_code: string | null }[];
    // Seed frag1 is standard — marker stays null; writer must not set a code
    expect(rows[0]?.marker_code).toBeNull();
    void SEED_GROVE;
  });
});
