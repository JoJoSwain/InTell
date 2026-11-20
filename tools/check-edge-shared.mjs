/**
 * CI: fail if supabase/functions/_shared/from-shared drifts from packages/shared
 * (after the same Deno import rewrite as sync-edge-shared).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = path.join(root, "supabase/functions/_shared/from-shared");

const files = [
  ["src/canonicalJson.ts", "canonicalJson.ts"],
  ["src/schemas/l10n.ts", "l10n.ts"],
  ["src/schemas/music.ts", "music.ts"],
  ["src/schemas/packs.ts", "packs.ts"],
];

function rewrite(text) {
  return text
    .replace(/from "\.\/l10n"/g, 'from "./l10n.ts"')
    .replace(/from "\.\/music"/g, 'from "./music.ts"')
    .replace(/from "\.\/schemas\/l10n"/g, 'from "./l10n.ts"')
    .replace(/from "\.\/schemas\/music"/g, 'from "./music.ts"')
    .replace(/\r\n/g, "\n");
}

let failed = false;
for (const [srcRel, destName] of files) {
  const src = path.join(root, "packages/shared", srcRel);
  const dest = path.join(destRoot, destName);
  if (!fs.existsSync(dest)) {
    console.error(`missing copy: ${destName} (run pnpm db:sync-edge-shared)`);
    failed = true;
    continue;
  }
  const expected = rewrite(fs.readFileSync(src, "utf8"));
  const actual = fs.readFileSync(dest, "utf8").replace(/\r\n/g, "\n");
  if (expected !== actual) {
    console.error(`drift: ${destName} differs from packages/shared/${srcRel}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("edge shared copies match packages/shared");
