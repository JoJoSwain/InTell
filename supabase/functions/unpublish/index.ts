import { z } from "zod";
import { getAuthHeader, userClient } from "../_shared/clients.ts";
import { json } from "../_shared/http.ts";

const Body = z.object({
  entity: z.enum([
    "grove",
    "fragment",
    "revision",
    "music_cue",
    "ambience_zone",
    "music_zone",
    "ui_cue",
  ]),
  ids: z.array(z.string().uuid()).min(1),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = getAuthHeader(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const caller = userClient(auth);
  const { data: allowed, error: roleErr } = await caller.rpc("has_role", {
    roles: ["editor", "admin"],
  });
  if (roleErr || !allowed) return json({ error: "editor required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  const { data, error } = await caller.rpc("fn_unpublish_commit", {
    p_entity: body.entity,
    p_ids: body.ids,
  });
  if (error) return json({ error: error.message }, 500);
  return json(data ?? { ok: true });
});