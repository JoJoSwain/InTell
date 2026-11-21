import type { SupabaseClient } from "@supabase/supabase-js";

export type StagingBucket = "staging-audio" | "staging-images";

/** Hex sha256 of file bytes (SubtleCrypto). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload to staging with upsert:false. Treat "already exists" as success.
 * Object path is `{sha256}.{ext}` inside the bucket (row staging_path = `{bucket}/{sha}.{ext}`).
 */
export async function uploadStagingObject(
  supabase: SupabaseClient,
  bucket: StagingBucket,
  sha256: string,
  ext: string,
  bytes: ArrayBuffer | Blob,
  contentType?: string,
): Promise<{ path: string; stagingPath: string }> {
  const objectPath = `${sha256}.${ext}`;
  const stagingPath = `${bucket}/${objectPath}`;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    upsert: false,
    contentType,
  });
  if (error) {
    const msg = error.message.toLowerCase();
    const exists =
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      msg.includes("resource already exists") ||
      (error as { statusCode?: string }).statusCode === "409";
    if (!exists) throw new Error(error.message);
  }
  return { path: objectPath, stagingPath };
}

export async function stagingObjectExists(
  supabase: SupabaseClient,
  bucket: StagingBucket,
  sha256: string,
  ext: string,
): Promise<boolean> {
  const objectPath = `${sha256}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).list("", {
    search: objectPath,
    limit: 20,
  });
  if (error) return false;
  return (data ?? []).some((f) => f.name === objectPath);
}
