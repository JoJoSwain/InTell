/**
 * Option C: copy Deno-safe shared modules into supabase/functions/_shared/from-shared
 * (flat layout with .ts import suffixes for Deno).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destRoot = path.join(root, "supabase/functions/_shared/from-shared");

const files = [
  ["src/canonicalJson.ts", "canonicalJson.ts"],
  ["src/schemas/device.ts", "device.ts"],
  ["src/schemas/l10n.ts", "l10n.ts"],
  ["src/schemas/music.ts", "music.ts"],
  ["src/schemas/packs.ts", "packs.ts"],
  ["src/schemas/snapshots.ts", "snapshots.ts"],
];

fs.mkdirSync(destRoot, { recursive: true });
for (const [srcRel, destName] of files) {
  const src = path.join(root, "packages/shared", srcRel);
  let text = fs.readFileSync(src, "utf8");
  // Deno needs explicit .ts extensions on relative imports
  text = text
    .replace(/from "\.\/l10n"/g, 'from "./l10n.ts"')
    .replace(/from "\.\/music"/g, 'from "./music.ts"')
    .replace(/from "\.\/snapshots"/g, 'from "./snapshots.ts"')
    .replace(/from "\.\/schemas\/l10n"/g, 'from "./l10n.ts"')
    .replace(/from "\.\/schemas\/music"/g, 'from "./music.ts"')
    .replace(/from "\.\/schemas\/snapshots"/g, 'from "./snapshots.ts"');
  const dest = path.join(destRoot, destName);
  fs.writeFileSync(dest, text);
  console.log(`copied ${srcRel} → ${path.relative(root, dest)}`);
}

// Remove nested schemas/ copy if present (legacy)
const nested = path.join(destRoot, "schemas");
if (fs.existsSync(nested)) {
  fs.rmSync(nested, { recursive: true, force: true });
  console.log("removed nested schemas/ copy");
}
console.log("sync-edge-shared done");
