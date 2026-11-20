import { serviceClient } from "../_shared/clients.ts";
import { json, requireServiceRole } from "../_shared/http.ts";
import { reconcilePublicAudio } from "../_shared/purgeReconcile.ts";

Deno.serve(async (req) => {
  const denied = requireServiceRole(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  void req.json().catch(() => ({}));

  const client = serviceClient();
  const stats = await reconcilePublicAudio(client);
  return json({ ok: true, ...stats });
});