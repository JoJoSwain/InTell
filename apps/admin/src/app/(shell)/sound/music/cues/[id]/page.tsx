import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canEditSound,
  canViewSound,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { MusicConditionBuilder } from "@/components/sound/music-condition-builder";
import type { MusicCondition } from "@intell/shared";
import { saveMusicCue, saveMusicCueStems } from "../../../actions";
import { stemsOverMaxMessage } from "@/lib/sound/helpers";

type Props = { params: Promise<{ id: string }> };

export default async function MusicCuePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const { data: cue } = await supabase
    .from("music_cues")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!cue) notFound();

  const { data: stems } = await supabase
    .from("music_cue_stems")
    .select("id, asset_id, role, gain_db, state_gains")
    .eq("cue_id", id)
    .order("created_at");

  const { data: assets } = await supabase
    .from("audio_assets")
    .select("id, title, kind, loop_start_ms, loop_end_ms, duration_ms")
    .order("title");

  const stemAssets = ((assets ?? []) as { id: string; title: string; kind: string }[]).filter(
    (a) => a.kind === "music_stem",
  );
  const resolveAssets = ((assets ?? []) as { id: string; title: string; kind: string }[]).filter(
    (a) => a.kind === "voice_cue" || a.kind === "sfx_oneshot",
  );

  const groveId = cue.grove_id as string | null;
  let fragments: { id: string; label: string; storyOrder: number }[] = [];
  if (groveId) {
    const { data: frags } = await supabase
      .from("fragments")
      .select("id, title, story_order")
      .eq("grove_id", groveId)
      .order("story_order");
    fragments = ((frags ?? []) as {
      id: string;
      title: unknown;
      story_order: number;
    }[]).map((f) => ({
      id: f.id,
      label: l10nEn(f.title) || f.id.slice(0, 8),
      storyOrder: f.story_order,
    }));
  }

  const conditions = (cue.conditions ?? {}) as MusicCondition;
  const editable = canEditSound(staff.role);
  const stemCount = (stems ?? []).length;
  const stemMsg = stemsOverMaxMessage(stemCount);

  const assetById = new Map(
    ((assets ?? []) as {
      id: string;
      title: string;
      loop_start_ms: number | null;
      loop_end_ms: number | null;
      duration_ms: number;
    }[]).map((a) => [a.id, a]),
  );

  return (
    <main className="px-8 py-10">
      <p className="text-sm text-textMuted">
        <Link href="/sound/music" className="text-primary underline">
          ← Music
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">{cue.name as string}</h1>
      <p className="mt-2 text-sm text-textMuted">
        {cue.time_window as string} · priority {cue.priority as number}
      </p>
      {stemMsg ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {stemMsg}
        </p>
      ) : null}

      {editable ? (
        <ServerActionForm action={saveMusicCue} className="mt-8 max-w-2xl space-y-4">
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm">
            <span className="text-textMuted">Name</span>
            <input
              name="name"
              required
              defaultValue={cue.name as string}
              aria-label="Cue name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="text-textMuted">Priority</span>
              <input
                name="priority"
                type="number"
                defaultValue={String(cue.priority)}
                aria-label="Cue priority"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Min dwell (s)</span>
              <input
                name="min_dwell_s"
                type="number"
                defaultValue={String(cue.min_dwell_s)}
                aria-label="Minimum dwell"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Crossfade ms</span>
              <input
                name="crossfade_ms"
                type="number"
                defaultValue={String(cue.crossfade_ms)}
                aria-label="Crossfade"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>

          <MusicConditionBuilder
            name="conditions_json"
            fragments={fragments}
            initial={conditions}
          />

          <fieldset className="space-y-3 rounded-md border border-border p-4">
            <legend className="px-1 text-sm font-medium">Resolve assets (afterglow)</legend>
            {(
              [
                ["resolve_root_asset_id", "Root", cue.resolve_root_asset_id],
                ["resolve_branch_asset_id", "Branch", cue.resolve_branch_asset_id],
                ["resolve_leaf_asset_id", "Leaf", cue.resolve_leaf_asset_id],
              ] as const
            ).map(([field, label, value]) => (
              <label key={field} className="block text-sm">
                <span className="text-textMuted">{label}</span>
                <select
                  name={field}
                  defaultValue={(value as string | null) ?? ""}
                  aria-label={`${label} resolve asset`}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  <option value="">—</option>
                  {resolveAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>

          <ServerActionSubmit aria-label="Save cue">Save cue</ServerActionSubmit>
        </ServerActionForm>
      ) : null}

      <section className="mt-12 max-w-2xl" aria-labelledby="stems-heading">
        <h2 id="stems-heading" className="font-serif text-xl font-semibold">
          Stems (max 4)
        </h2>
        {editable ? (
          <ServerActionForm action={saveMusicCueStems} className="mt-4 space-y-6">
            <input type="hidden" name="cue_id" value={id} />
            {(stems ?? []).map((stem) => {
              const asset = assetById.get(stem.asset_id as string);
              return (
                <div
                  key={stem.id as string}
                  className="space-y-3 rounded-md border border-border p-4"
                >
                  <input type="hidden" name="stem_id" value={stem.id as string} />
                  <label className="block text-sm">
                    <span className="text-textMuted">Stem asset</span>
                    <select
                      name="stem_asset_id"
                      defaultValue={stem.asset_id as string}
                      aria-label="Stem asset"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                    >
                      {stemAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {asset ? (
                    <p className="text-xs text-textMuted">
                      Loop {asset.loop_start_ms ?? 0}–{asset.loop_end_ms ?? asset.duration_ms} ms
                      (edit loops on{" "}
                      <Link
                        href={`/media/audio/${asset.id}`}
                        className="text-primary underline"
                      >
                        audio asset
                      </Link>
                      )
                    </p>
                  ) : null}
                  <label className="block text-sm">
                    <span className="text-textMuted">Role</span>
                    <input
                      name="stem_role"
                      defaultValue={stem.role as string}
                      aria-label="Stem role"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-textMuted">Base gain (dB)</span>
                    <input
                      name="stem_gain_db"
                      type="number"
                      step="0.1"
                      defaultValue={String(stem.gain_db)}
                      aria-label="Stem gain"
                      className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-textMuted">state_gains (JSON array)</span>
                    <textarea
                      name="stem_state_gains_json"
                      rows={3}
                      defaultValue={JSON.stringify(stem.state_gains ?? [], null, 2)}
                      aria-label="State gains JSON"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                    />
                  </label>
                </div>
              );
            })}
            {stemCount < 4 ? (
              <div className="space-y-3 rounded-md border border-dashed border-border p-4">
                <p className="text-sm text-textMuted">Add stem</p>
                <input type="hidden" name="stem_id" value="" />
                <select
                  name="stem_asset_id"
                  aria-label="New stem asset"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  defaultValue=""
                >
                  <option value="">Select stem…</option>
                  {stemAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="stem_role" value="stem" />
                <input type="hidden" name="stem_gain_db" value="0" />
                <input type="hidden" name="stem_state_gains_json" value="[]" />
              </div>
            ) : null}
            <ServerActionSubmit aria-label="Save stems">Save stems</ServerActionSubmit>
          </ServerActionForm>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {(stems ?? []).map((s) => (
              <li key={s.id as string}>
                {assetById.get(s.asset_id as string)?.title ?? s.asset_id} · {s.role as string}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}