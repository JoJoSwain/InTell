import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.ADMIN_E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: process.env.ADMIN_E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm exec next dev --hostname localhost --port 3000",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: (() => {
          // A17: inherit the process env, but never override .env.local with
          // empty NEXT_PUBLIC_SUPABASE_* values (Windows local runs).
          // Playwright wants Record<string, string>; ProcessEnv allows undefined.
          const env: Record<string, string> = {};
          for (const [key, value] of Object.entries(process.env)) {
            if (typeof value === "string") env[key] = value;
          }
          const url = (
            process.env.NEXT_PUBLIC_SUPABASE_URL ||
            process.env.SUPABASE_URL ||
            process.env.API_URL ||
            ""
          ).trim();
          const anon = (
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            process.env.SUPABASE_ANON_KEY ||
            process.env.ANON_KEY ||
            ""
          ).trim();
          if (url) env.NEXT_PUBLIC_SUPABASE_URL = url;
          else delete env.NEXT_PUBLIC_SUPABASE_URL;
          if (anon) env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
          else delete env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          return env;
        })(),
      },
});
