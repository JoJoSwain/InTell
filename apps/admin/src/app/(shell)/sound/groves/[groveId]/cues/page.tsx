import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DEPTH_BLOOM_TEXTURE_M_DEFAULT } from "@intell/shared";
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
import { saveGroveSoundCues } from "../../../actions";

type Props = { params: Promise<{ groveId: string }> };

const CUE_KINDS = [
  { key: "beacon_root", label: "Beacon · root" },
  { key: "beacon_branch", label: "Beacon · branch" },
  { key: "beacon_leaf", label: "Beacon · leaf" },
  { key: "threshold_motif_day", label: "Threshold motif · day" },
  { key: "threshold_motif_night", label: "Threshold motif · night" },
] as const;

export default async function GroveSoundCuesPage({ params }: Props) {
  const { groveId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const { data: grove } = await supabase
    .from("groves")
    .select("id, slug, name, depth_bloom_texture_m")
    .eq("id", groveId)
    .maybeSingle();
  if (!grove) notFound();

  const { data: cues } = await supabase
    .from("grove_sound_cues")
    .select("id, kind, asset_id")
    .eq("grove_id", groveId);

  const cueByKind = new Map(
    ((cues ?? []) as { kind: string; asset_id: string }[]).map((c) => [
      c.kind,
      c.asset_id,
    ]),
  );

  const { data: assets } = await supabase
    .from("audio_assets")
    .select("id, title, kind")
    .in("kind", ["voice_cue", "sfx_oneshot", "music_stem"])
    .order("title");

  const editable = canEditSound(staff.role);

  return (
    <main className="px-8 py-10">
      <p className="text-sm text-textMuted">
        <Link
          href={`/story/groves/${groveId}`}
          className="text-primary underline"
        >
          ← {l10nEn(grove.name as Record<string, string>) || grove.slug}
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Grove sound cues</h1>
      <p className="mt-2 text-sm text-textMuted">
        Default beacons per tier, threshold motifs, and depth bloom texture override
        (default {DEPTH_BLOOM_TEXTURE_M_DEFAULT} m).
      </p>

      {editable ? (
        <ServerActionForm action={saveGroveSoundCues} className="mt-8 max-w-xl space-y-6">
          <input type="hidden" name="grove_id" value={groveId} />
          <label className="block text-sm">
            <span className="text-textMuted">Depth bloom texture (m)</span>
            <input
              name="depth_bloom_texture_m"
              type="number"
              step="0.01"
              min={0.01}
              defaultValue={String(
                grove.depth_bloom_texture_m ?? DEPTH_BLOOM_TEXTURE_M_DEFAULT,
              )}
              aria-label="Depth bloom texture metres"
              className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          {CUE_KINDS.map(({ key, label }) => (
            <label key={key} className="block text-sm">
              <span className="text-textMuted">{label}</span>
              <select
                name={`asset_${key}`}
                defaultValue={cueByKind.get(key) ?? ""}
                aria-label={label}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">—</option>
                {((assets ?? []) as { id: string; title: string }[]).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <ServerActionSubmit aria-label="Save grove sound cues">Save</ServerActionSubmit>
        </ServerActionForm>
      ) : (
        <dl className="mt-8 space-y-2 text-sm">
          <div>
            <dt className="text-textMuted">Depth bloom texture</dt>
            <dd>{grove.depth_bloom_texture_m} m</dd>
          </div>
          {CUE_KINDS.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-textMuted">{label}</dt>
              <dd>{cueByKind.get(key) ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}