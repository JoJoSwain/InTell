/** Result shape for admin text-editing server actions used with ServerActionForm. */
export type ServerActionResult =
  | { ok: true; href: string }
  | { ok: false; error: string };

/** Auth helper result: success context or a form-visible failure (V2). */
export type ActionAuthResult<T extends object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export function serverActionError(
  error: string,
): Extract<ServerActionResult, { ok: false }> {
  return { ok: false, error };
}

/**
 * Build a hard-nav href that always changes the URL (cache-bust), so the browser
 * does a real load and remounts uncontrolled fields after save.
 */
export function saveHref(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}_=${Date.now()}`;
}
