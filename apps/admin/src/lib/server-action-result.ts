/** Result shape for admin text-editing server actions used with ServerActionForm. */
export type ServerActionResult =
  | { ok: true; href: string }
  | { ok: false; error: string };

/**
 * Build a hard-nav href that always changes the URL (cache-bust), so the browser
 * does a real load and remounts uncontrolled fields after save.
 */
export function saveHref(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_=${Date.now()}`;
}
