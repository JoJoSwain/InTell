import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cheap static guard (M3h R2): fail when a `<form action={…}>` still contains a
 * textarea or text input. Create-only forms that navigate to a new URL may be
 * allowlisted; everything else must use ServerActionForm.
 */
const ROOT = join(__dirname, "..");

/** Paths relative to apps/admin/src — create-only forms that redirect elsewhere. */
const ALLOWLIST = new Set([
  "app/(shell)/story/releases/new/page.tsx",
]);

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walkTsx(full, out);
    } else if (name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Find `<form … action={…} …>…</form>` blocks (non-greedy, nested-safe enough). */
function formActionBlocks(source: string): string[] {
  const blocks: string[] = [];
  const openRe = /<form\b[^>]*\baction=\{[^}]+\}[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(source)) !== null) {
    const start = match.index;
    const afterOpen = start + match[0].length;
    const close = source.indexOf("</form>", afterOpen);
    if (close === -1) continue;
    blocks.push(source.slice(start, close + "</form>".length));
  }
  return blocks;
}

function hasTextField(block: string): boolean {
  if (/<textarea\b/i.test(block)) return true;
  // Default type is text; also catch explicit type="text".
  const inputRe = /<input\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = inputRe.exec(block)) !== null) {
    const tag = m[0];
    const typeMatch = /\btype\s*=\s*["']([^"']+)["']/i.exec(tag);
    const type = (typeMatch?.[1] ?? "text").toLowerCase();
    if (type === "text" || type === "search" || type === "email" || type === "url") {
      return true;
    }
    // No type attribute ⇒ text
    if (!typeMatch) return true;
  }
  return false;
}

describe("ServerActionForm guard (M3h R2)", () => {
  it("rejects <form action={…}> with text fields outside the create-only allowlist", () => {
    const offenders: string[] = [];
    for (const file of walkTsx(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (ALLOWLIST.has(rel)) continue;
      const source = readFileSync(file, "utf8");
      for (const block of formActionBlocks(source)) {
        if (hasTextField(block)) {
          offenders.push(rel);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
