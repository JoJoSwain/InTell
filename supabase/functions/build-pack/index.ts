import { z } from "zod";
import { serviceClient } from "../_shared/clients.ts";
import { json, requireServiceCaller } from "../_shared/http.ts";
import { buildGrovePack } from "../_shared/buildGrovePack.ts";
import { buildRegionPack } from "../_shared/buildRegionPack.ts";

const Body = z
  .object({
    grove_id: z.string().uuid().optional(),
    region_id: z.string().uuid().optional(),
    release_id: z.string().uuid().optional(),
    reason: z.string().optional(),
  })
  .refine((b) => !!(b.grove_id || b.region_id), {
    message: "grove_id or region_id required",
  });

Deno.serve(async (req) => {
  const denied = requireServiceCaller(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return json({ error: String(e) }, 400);
  }

  const client = serviceClient();
  const results: unknown[] = [];
  if (body.grove_id) {
    results.push(
      await buildGrovePack(client, body.grove_id, body.reason, body.release_id),
    );
  }
  if (body.region_id) {
    results.push(
      await buildRegionPack(client, body.region_id, body.reason, body.release_id),
    );
  }
  return json({ ok: true, results });
});
