import { z } from "zod";
import { requireStaffAdmin } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/clients.ts";
import { json } from "../_shared/http.ts";

const StaffRole = z.enum([
  "admin",
  "editor",
  "writer",
  "sound",
  "moderator",
  "viewer",
]);

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    email: z.string().email(),
    displayName: z.string().min(1).max(200),
    role: StaffRole,
  }),
  z.object({
    action: z.literal("deactivate"),
    userId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("reactivate"),
    userId: z.string().uuid(),
  }),
]);

async function findAuthUserByEmail(
  svc: ReturnType<typeof serviceClient>,
  email: string,
) {
  const needle = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === needle);
    if (hit) return hit;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const gate = await requireStaffAdmin(req);
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  const svc = serviceClient();

  if (body.action === "invite") {
    let existing;
    try {
      existing = await findAuthUserByEmail(svc, body.email);
    } catch (e) {
      return json({
        error: "invite failed",
        detail: e instanceof Error ? e.message : "lookup failed",
      }, 400);
    }

    if (existing?.email_confirmed_at) {
      return json({
        error: "already registered",
        detail:
          "That email already has an account. Ask them to sign in or use Forgot password.",
      }, 409);
    }

    const { data: invited, error: inviteErr } = await svc.auth.admin
      .inviteUserByEmail(body.email, {
        data: { display_name: body.displayName },
      });
    if (inviteErr || !invited.user) {
      return json({
        error: "invite failed",
        detail: inviteErr?.message ?? "no user",
      }, 400);
    }

    const { error: staffErr } = await svc.from("staff").upsert({
      user_id: invited.user.id,
      display_name: body.displayName,
      role: body.role,
      active: true,
      invited_by: gate.userId,
    }, { onConflict: "user_id" });

    if (staffErr) {
      return json({ error: staffErr.message }, 400);
    }

    await svc.from("audit_log").insert({
      actor: gate.userId,
      action: existing ? "staff.reinvite" : "staff.invite",
      entity: "staff",
      entity_id: invited.user.id,
      detail: { role: body.role, email: body.email },
    });

    return json({
      ok: true,
      userId: invited.user.id,
      resent: Boolean(existing),
    });
  }

  if (body.action === "deactivate") {
    if (body.userId === gate.userId) {
      return json({ error: "cannot deactivate yourself" }, 400);
    }

    const { data: row, error: readErr } = await svc
      .from("staff")
      .select("user_id, active, role")
      .eq("user_id", body.userId)
      .maybeSingle();
    if (readErr) return json({ error: readErr.message }, 400);
    if (!row) return json({ error: "staff not found" }, 404);

    const { error: updErr } = await svc
      .from("staff")
      .update({ active: false })
      .eq("user_id", body.userId);
    if (updErr) {
      return json({ error: updErr.message }, 400);
    }

    const { error: banErr } = await svc.auth.admin.updateUserById(body.userId, {
      ban_duration: "876000h",
    });
    if (banErr) {
      return json({ error: banErr.message }, 400);
    }

    await svc.from("audit_log").insert({
      actor: gate.userId,
      action: "staff.deactivate",
      entity: "staff",
      entity_id: body.userId,
      detail: { role: row.role },
    });

    return json({ ok: true });
  }

  const { data: row, error: readErr } = await svc
    .from("staff")
    .select("user_id, active, role")
    .eq("user_id", body.userId)
    .maybeSingle();
  if (readErr) return json({ error: readErr.message }, 400);
  if (!row) return json({ error: "staff not found" }, 404);

  const { error: updErr } = await svc
    .from("staff")
    .update({ active: true })
    .eq("user_id", body.userId);
  if (updErr) return json({ error: updErr.message }, 400);

  const { error: unbanErr } = await svc.auth.admin.updateUserById(body.userId, {
    ban_duration: "none",
  });
  if (unbanErr) return json({ error: unbanErr.message }, 400);

  await svc.from("audit_log").insert({
    actor: gate.userId,
    action: "staff.reactivate",
    entity: "staff",
    entity_id: body.userId,
    detail: { role: row.role },
  });

  return json({ ok: true });
});
