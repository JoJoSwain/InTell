import { expect, test, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type AuthUsers = {
  supabaseUrl: string;
  anonKey: string;
  users: Record<
    string,
    { email: string; password: string; userId: string }
  >;
};

function loadUsers(): AuthUsers {
  const path = join(__dirname, ".auth-users.json");
  if (!existsSync(path)) {
    throw new Error(
      "Missing e2e/.auth-users.json — run pnpm --filter @intell/admin e2e:prepare first",
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as AuthUsers;
}

async function passwordGrant(auth: AuthUsers, role: string): Promise<string> {
  const u = auth.users[role];
  if (!u) throw new Error(`missing ${role}`);
  const res = await fetch(
    `${auth.supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: auth.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: u.email, password: u.password }),
    },
  );
  if (!res.ok) {
    throw new Error(`password grant ${role}: ${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error(`no access_token for ${role}`);
  return json.access_token;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("M3b staff gate", () => {
  test("writer cannot open Staff; publish is refused", async ({ page }) => {
    const auth = loadUsers();
    const writer = auth.users.writer;
    if (!writer) throw new Error("writer missing from auth users");

    await signIn(page, writer.email, writer.password);

    await expect(page.getByRole("navigation", { name: "Ops" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Staff" })).toHaveCount(0);

    await page.goto("/staff");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

    const publishRes = await page.request.post(
      `${auth.supabaseUrl}/functions/v1/publish`,
      {
        headers: {
          Authorization: `Bearer ${await passwordGrant(auth, "writer")}`,
          apikey: auth.anonKey,
          "Content-Type": "application/json",
        },
        data: { releaseId: "00000000-0000-4000-8000-000000000001" },
      },
    );
    expect(publishRes.status()).toBe(403);
  });

  test("admin can open Staff and invite creates a staff row", async ({
    page,
    request,
  }) => {
    const auth = loadUsers();
    const admin = auth.users.admin;
    if (!admin) throw new Error("admin missing from auth users");

    await signIn(page, admin.email, admin.password);
    await page.getByRole("link", { name: "Staff" }).click();
    await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();

    const stamp = Date.now();
    const inviteEmail = `e2e-invited-${stamp}@test.local`;
    const displayName = `E2E Invited Writer ${stamp}`;
    const adminToken = await passwordGrant(auth, "admin");

    const inviteRes = await request.post(
      `${auth.supabaseUrl}/functions/v1/invite-staff`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          apikey: auth.anonKey,
          "Content-Type": "application/json",
        },
        data: {
          action: "invite",
          email: inviteEmail,
          displayName,
          role: "writer",
        },
      },
    );
    expect(inviteRes.ok()).toBeTruthy();
    const body = (await inviteRes.json()) as { userId?: string };
    expect(body.userId).toBeTruthy();

    await page.reload();
    await expect(page.getByText(displayName)).toBeVisible();
  });
});

