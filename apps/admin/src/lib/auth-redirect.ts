/**
 * Accept only same-origin relative paths for auth `next` redirects (R2).
 * Rejects absolute URLs and protocol-relative / scheme tricks.
 */
export function sanitizeNext(
  next: string | null | undefined,
  fallback = "/auth/set-password",
): string {
  if (!next) return fallback;
  const value = next.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
