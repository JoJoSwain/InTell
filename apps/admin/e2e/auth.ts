import { expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type AuthUsers = {
  supabaseUrl: string;
  anonKey: string;
  users: Record<
    string,
    { email: string; password: string; userId: string }
  >;
};

export function loadUsers(): AuthUsers {
  const path = join(__dirname, ".auth-users.json");
  if (!existsSync(path)) {
    throw new Error(
      "Missing e2e/.auth-users.json — run pnpm --filter @intell/admin e2e:prepare first",
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as AuthUsers;
}

export async function passwordGrant(
  auth: AuthUsers,
  role: string,
): Promise<string> {
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

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible({
    timeout: 15_000,
  });
}
