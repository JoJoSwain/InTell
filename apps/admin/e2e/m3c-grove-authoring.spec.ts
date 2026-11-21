import { expect, test } from "@playwright/test";
import { loadUsers, signIn } from "./auth";

/** Seed Farmington nearby / second grove + bridge fragment (see seed.sql). */
const SEED_OTHER_GROVE = "aaaaaaaa-bbbb-4ccc-8ddd-0000000000c0";
const SEED_BRIDGE_FRAG = "aaaaaaaa-bbbb-4ccc-8ddd-0000000000c1";
const SEED_REGION = "aaaaaaaa-bbbb-4ccc-8ddd-000000000001";

/** Small polygon around Farmington sun reference (~41.1, -111.9). */
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

test.describe("M3c grove authoring", () => {
  test("editor builds grove with fragments, OR prereq, physical + print", async ({
    page,
  }) => {
    const auth = loadUsers();
    const editor = auth.users.editor;
    if (!editor) throw new Error("editor missing");

    await signIn(page, editor.email, editor.password);

    await page.getByRole("link", { name: "Groves" }).click();
    await expect(page.getByRole("heading", { name: "Groves" })).toBeVisible();
    await page.getByRole("link", { name: "New grove" }).click();

    const stamp = Date.now();
    const name = `E2E Grove ${stamp}`;
    await page.getByLabel("Grove name").fill(name);
    await page.getByLabel("Premise").fill("E2E premise");
    await page.getByLabel("Boundary GeoJSON").fill(BOUNDARY);
    // Region select already defaults to first (seed region)
    await page.getByLabel("Region").selectOption(SEED_REGION);
    await page.getByRole("button", { name: "Create grove" }).click();

    await expect(page.getByRole("heading", { name })).toBeVisible({
      timeout: 20_000,
    });

    // Fragment A (root, no prereq)
    await page.getByRole("link", { name: "New fragment" }).click();
    await page.getByLabel("Fragment title").fill(`Frag A ${stamp}`);
    await page.getByLabel("Teaser").fill("Teaser A");
    await page.getByLabel("Tier").selectOption("root");
    await page.getByLabel("Latitude").fill("41.1");
    await page.getByLabel("Longitude").fill("-111.9");
    await page.getByRole("button", { name: "Add fragment" }).click();
    await expect(page.getByText(`Frag A ${stamp}`).first()).toBeVisible({
      timeout: 15_000,
    });

    // Fragment B
    await page.getByRole("link", { name: "New fragment" }).click();
    await page.getByLabel("Fragment title").fill(`Frag B ${stamp}`);
    await page.getByLabel("Teaser").fill("Teaser B");
    await page.getByLabel("Latitude").fill("41.101");
    await page.getByLabel("Longitude").fill("-111.901");
    await page.getByRole("button", { name: "Add fragment" }).click();
    await expect(page.getByText(`Frag B ${stamp}`).first()).toBeVisible({
      timeout: 15_000,
    });

    // Fragment C — physical
    await page.getByRole("link", { name: "New fragment" }).click();
    await page.getByLabel("Fragment title").fill(`Frag C ${stamp}`);
    await page.getByLabel("Teaser").fill("Teaser C");
    await page.getByLabel("Visibility").selectOption("physical");
    await page.getByLabel("Latitude").fill("41.102");
    await page.getByLabel("Longitude").fill("-111.902");
    await page.getByRole("button", { name: "Add fragment" }).click();
    await expect(page.getByText(`Frag C ${stamp}`).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Print marker" })).toBeVisible();

    // OR prereq on C: A OR bridge from other seed grove
    await page.getByRole("button", { name: "Add OR group" }).click();
    const multi = page.getByLabel("Prerequisite group 1 members");
    await multi.selectOption([
      // pick Frag A by visible option text
    ]);
    // Select by evaluating options that match Frag A and seed bridge
    await multi.evaluate(
      (el, bridgeId) => {
        const select = el as HTMLSelectElement;
        const values: string[] = [];
        for (const opt of Array.from(select.options)) {
          if (opt.textContent?.includes("Frag A") || opt.value === bridgeId) {
            values.push(opt.value);
          }
        }
        for (const opt of Array.from(select.options)) {
          opt.selected = values.includes(opt.value);
        }
        select.dispatchEvent(new Event("change", { bubbles: true }));
      },
      SEED_BRIDGE_FRAG,
    );
    await page.getByRole("button", { name: "Save prerequisites" }).click();
    await expect(page.getByText(`Frag C ${stamp}`).first()).toBeVisible({
      timeout: 15_000,
    });

    // Re-open Frag C (prereq save redirects to the grove list) then print
    await page
      .getByRole("link", { name: `Frag C ${stamp} · physical` })
      .click();
    await expect(page.getByRole("link", { name: "Print marker" })).toBeVisible({
      timeout: 15_000,
    });

    // Print page — no code in query string
    await page.getByRole("link", { name: "Print marker" }).click();
    await page.waitForURL(/\/print\/marker\//, { timeout: 15_000 });
    await expect(page.getByLabel("Marker code")).toBeVisible({
      timeout: 15_000,
    });
    const url = page.url();
    expect(url).toMatch(/\/print\/marker\//);
    expect(url).not.toMatch(/[?&]code=/i);
    expect(new URL(url).search).toBe("");
    // Ensure seed other grove id is documented in suite
    expect(SEED_OTHER_GROVE).toBeTruthy();
  });
});
