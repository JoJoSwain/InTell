export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function decodeJwtPayload(authHeader: string | null): Record<string, unknown> | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function requireServiceRole(req: Request): Response | null {
  const payload = decodeJwtPayload(req.headers.get("Authorization"));
  if (!payload || payload.role !== "service_role") {
    return json({ error: "service_role required" }, 403);
  }
  return null;
}
