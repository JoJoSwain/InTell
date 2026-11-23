import { expect, test } from "@playwright/test";
import { loadUsers, passwordGrant, signIn } from "./auth";

const SEED_GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-000000000010";
const SEED_FRAG = "aaaaaaaa-bbbb-4ccc-8ddd-000000000030";
/** Physical seed fragment with marker DEM00001 (frag9). */
const SEED_PHYSICAL_FRAG = "aaaaaaaa-bbbb-4ccc-8ddd-000000000038";
const SEED_PHYSICAL_CODE = "DEM00001";

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

    // Forced marker rotate on physical seed refused (F1 → 42501 / 403)
    const markerRes = await request.patch(
      `${auth.supabaseUrl}/rest/v1/fragments?id=eq.${SEED_PHYSICAL_FRAG}`,
      {
        headers,
        data: { marker_code: "ABCD2345" },
      },
    );
    expect(markerRes.status()).toBe(403);
    const check = await request.get(
      `${auth.supabaseUrl}/rest/v1/fragments?id=eq.${SEED_PHYSICAL_FRAG}&select=marker_code`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: auth.anonKey,
        },
      },
    );
    const rows = (await check.json()) as { marker_code: string | null }[];
    expect(rows[0]?.marker_code).toBe(SEED_PHYSICAL_CODE);
    void SEED_GROVE;
    void SEED_FRAG;
  });
});
