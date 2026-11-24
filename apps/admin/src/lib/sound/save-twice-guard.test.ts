import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Save-twice guard for A5 sound forms (M3h): every sound authoring form must
 * use ServerActionForm + ServerActionSubmit so pending disables double submit.
 * Full Playwright coverage lives in e2e/m3h-save-twice; CI still runs that
 * suite, but sound pages are covered here until dedicated e2e rows land.
 */
const SOUND_ROOT = join(__dirname, "../../app/(shell)/sound");

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsx(full, out);
    else if (name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("sound forms save-twice (ServerActionForm)", () => {
  it("uses ServerActionForm whenever ServerActionSubmit appears", () => {
    const offenders: string[] = [];
    for (const file of walkTsx(SOUND_ROOT)) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("ServerActionSubmit")) continue;
      if (!src.includes("ServerActionForm")) {
        offenders.push(relative(SOUND_ROOT, file).replace(/\\/g, "/"));
      }
      // Raw <form action={…}> with text fields is forbidden (see M3h guard).
      if (/<form\b[^>]*\baction=\{/.test(src) && /<textarea\b|<input\b[^>]*\btype=["']text["']/.test(src)) {
        offenders.push(
          `${relative(SOUND_ROOT, file).replace(/\\/g, "/")}: raw form action`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ServerActionSubmit disables while pending (double-submit guard)", () => {
    const src = readFileSync(
      join(__dirname, "../../components/server-action-form.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const disabled = !mounted \|\| pending/);
    expect(src).toMatch(/disabled=\{disabled\}/);
  });
});
