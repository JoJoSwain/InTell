export function publicMediaUrl(supabaseUrl: string, objectPath: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/public-media/${objectPath}`;
}

export function assetObjectPath(kind: string, sha: string, ext: string): string {
  const folder = kind === "image" ? "i" : "a";
  return `${folder}/${sha}.${ext}`;
}
