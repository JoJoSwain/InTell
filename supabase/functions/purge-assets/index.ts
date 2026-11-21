import { serviceClient } from "../_shared/clients.ts";
import { json, requireServiceCaller } from "../_shared/http.ts";
import { reconcilePublicMedia } from "../_shared/purgeReconcile.ts";

Deno.serve(async (req) => {
  const denied = requireServiceCaller(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  void req.json().catch(() => ({}));

  const client = serviceClient();
  const stats = await reconcilePublicMedia(client);
  return json({ ok: true, ...stats });
});
