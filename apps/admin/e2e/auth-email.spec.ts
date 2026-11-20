import { expect, test, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { extractConfirmLink, waitForMail } from "./mailpit";

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
    throw new Error("Missing e2e/.auth-users.json — run e2e:prepare first");
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
  if (!res.ok) throw new Error(`password grant ${role}: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error(`no access_token for ${role}`);
  return json.access_token;
}

async function inviteViaEdge(
  request: import("@playwright/test").APIRequestContext,
  auth: AuthUsers,
  adminToken: string,
  email: string,
  displayName: string,
) {
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
        email,
        displayName,
        role: "writer",
      },
    },
  );
  expect(inviteRes.ok()).toBeTruthy();
}

async function acceptInviteAndSetPassword(
  page: Page,
  email: string,
  password: string,
) {
  const mail = await waitForMail(email, "invited");
  const link = extractConfirmLink(mail.HTML || mail.Text);
  await page.goto(link);
  await expect(page.getByLabel("New password")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
    timeout: 15_000,
  });
  return link;
}

test.describe("M3b invite and recovery (Mailpit)", () => {
  test("invite email → set password → Home; reused link expires", async ({
    page,
    request,
  }) => {
    const auth = loadUsers();
    const adminToken = await passwordGrant(auth, "admin");
    const inviteEmail = `e2e-mail-invite-${Date.now()}@test.local`;
    await inviteViaEdge(
      request,
      auth,
      adminToken,
      inviteEmail,
      "E2E Mail Invite",
    );

    const link = await acceptInviteAndSetPassword(
      page,
      inviteEmail,
      `InvitePass-${Date.now()}-Ok`,
    );

    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByText(
        "That link has expired or was already used. Ask an admin to resend your invite, or use Forgot password.",
      ),
    ).toBeVisible();
  });

  test("recovery email → set password → sign in with new password", async ({
    page,
    request,
  }) => {
    const auth = loadUsers();
    const adminToken = await passwordGrant(auth, "admin");
    const email = `e2e-mail-recover-${Date.now()}@test.local`;
    const firstPassword = `FirstPass-${Date.now()}-Ok`;
    await inviteViaEdge(request, auth, adminToken, email, "E2E Recover");
    await acceptInviteAndSetPassword(page, email, firstPassword);

    await Promise.all([
      page.waitForURL("**/sign-in"),
      page.locator('form[action="/auth/sign-out"]').evaluate((f) =>
        (f as HTMLFormElement).requestSubmit(),
      ),
    ]);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Forgot password" }).click();
    await expect(
      page.getByText(
        "If that address has an account, a reset email is on the way.",
      ),
    ).toBeVisible();

    const mail = await waitForMail(email, "Reset");
    const link = extractConfirmLink(mail.HTML || mail.Text);
    await page.goto(link);
    await expect(page.getByLabel("New password")).toBeVisible({
      timeout: 15_000,
    });

    const newPassword = `Recover-${Date.now()}-Ok`;
    await page.getByLabel("New password").fill(newPassword);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 15_000,
    });

    await Promise.all([
      page.waitForURL("**/sign-in"),
      page.locator('form[action="/auth/sign-out"]').evaluate((f) =>
        (f as HTMLFormElement).requestSubmit(),
      ),
    ]);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("re-invite unconfirmed succeeds; confirmed address is refused", async ({
    request,
  }) => {
    const auth = loadUsers();
    const adminToken = await passwordGrant(auth, "admin");
    const email = `e2e-reinvite-${Date.now()}@test.local`;

    await inviteViaEdge(request, auth, adminToken, email, "E2E Reinvite");

    const second = await request.post(
      `${auth.supabaseUrl}/functions/v1/invite-staff`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          apikey: auth.anonKey,
          "Content-Type": "application/json",
        },
        data: {
          action: "invite",
          email,
          displayName: "E2E Reinvite",
          role: "writer",
        },
      },
    );
    expect(second.ok()).toBeTruthy();
    const secondBody = (await second.json()) as { resent?: boolean };
    expect(secondBody.resent).toBe(true);

    const confirmed = auth.users.admin;
    if (!confirmed) throw new Error("admin missing");
    const refuse = await request.post(
      `${auth.supabaseUrl}/functions/v1/invite-staff`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          apikey: auth.anonKey,
          "Content-Type": "application/json",
        },
        data: {
          action: "invite",
          email: confirmed.email,
          displayName: "Should Fail",
          role: "writer",
        },
      },
    );
    expect(refuse.status()).toBe(409);
    const refuseBody = (await refuse.json()) as { detail?: string };
    expect(refuseBody.detail ?? "").toMatch(/already has an account/i);
  });

  test("open redirect next values are ignored by confirm", async ({
    page,
    request,
  }) => {
    const auth = loadUsers();
    const adminToken = await passwordGrant(auth, "admin");
    const inviteEmail = `e2e-redirect-${Date.now()}@test.local`;
    await inviteViaEdge(
      request,
      auth,
      adminToken,
      inviteEmail,
      "E2E Redirect",
    );

    const mail = await waitForMail(inviteEmail, "invited");
    const goodLink = extractConfirmLink(mail.HTML || mail.Text);
    const url = new URL(goodLink);
    url.searchParams.set("next", "https://evil.example");
    await page.goto(url.toString());
    await expect(page.getByLabel("New password")).toBeVisible({
      timeout: 15_000,
    });
    expect(page.url()).toContain("/auth/set-password");
    expect(page.url()).not.toContain("evil.example");

    const url2 = new URL(goodLink);
    url2.searchParams.set("next", "//evil.example");
    await page.goto(url2.toString());
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(page.url()).toContain("/sign-in");
    expect(page.url()).not.toContain("evil.example");
  });
});
