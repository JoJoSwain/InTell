/**
 * Upload deterministic seed tones to local staging-audio (M2b C23).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = path.join(root, "supabase/seed-media.json");
const tonesDir = path.join(root, "tools/audio-fixtures/seed-tones");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadStackEnv() {
  try {
    const text = execSync("pnpm exec supabase status -o env", {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    return parseEnv(text);
  } catch (e) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) return { API_URL: url, SERVICE_ROLE_KEY: key };
    console.error("supabase status failed; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
}

const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
if (!fs.existsSync(tonesDir)) {
  console.error(
    "Missing tools/audio-fixtures/seed-tones — run: pnpm db:seed-media-meta",
  );
  process.exit(1);
}

const env = loadStackEnv();
const baseUrl = (env.API_URL || env.SUPABASE_URL).replace(/\/$/, "");
const serviceKey = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

async function uploadObject(bucket, objectPath, body, contentType) {
  const url = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${objectPath}: ${res.status} ${text}`);
  }
}

let uploaded = 0;
for (const entry of Object.values(meta.assets)) {
  const sha = entry.sha256;
  const ext = entry.ext || "wav";
  const localName = entry.file || `${sha}.${ext}`;
  const localPath = path.join(tonesDir, localName);
  if (!fs.existsSync(localPath)) {
    console.error(`missing file ${localPath}`);
    process.exit(1);
  }
  const storagePath = `${sha}.${ext}`;
  const body = fs.readFileSync(localPath);
  try {
    await uploadObject(
      "staging-audio",
      storagePath,
      body,
      ext === "wav" ? "audio/wav" : "application/octet-stream",
    );
  } catch (e) {
    console.error(String(e));
    process.exit(1);
  }
  uploaded += 1;
}
console.log(`seed-media-upload: ${uploaded} file(s) -> staging-audio`);