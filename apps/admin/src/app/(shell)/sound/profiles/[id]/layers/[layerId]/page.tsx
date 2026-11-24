import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canEditSound,
  canViewSound,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { BedAssetHints } from "@/components/sound/bed-asset-hints";
import { LayerAudition } from "@/components/sound/layer-audition";
import { formatIntArray } from "@/lib/sound/helpers";
import { saveAmbienceLayer, saveLayerAssetWeights } from "../../../../actions";

type Props = { params: Promise<{ id: string; layerId: string }> };

export default async function AmbienceLayerPage({ params }: Props) {
  const { id: profileId, layerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff) || !canViewSound(staff.role)) redirect("/no-access");

  const { data: layer } = await supabase
    .from("ambience_layers")
    .select("*")
    .eq("id", layerId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!layer) notFound();

  const { data: weights } = await supabase
    .from("ambience_layer_assets")
    .select("asset_id, weight")
    .eq("layer_id", layerId);

  const assetIds = (weights ?? []).map((w) => w.asset_id as string);
  const { data: assets } = assetIds.length
    ? await supabase
        .from("audio_assets")
        .select("id, title, kind, channels, duration_ms, staging_path")
        .in("id", assetIds)
    : { data: [] };

  const { data: allAssets } = await supabase
    .from("audio_assets")
    .select("id, title, kind, channels, duration_ms")
    .in("kind", ["sfx_bed", "sfx_oneshot"])
    .order("title");

  const assetById = new Map(
    ((assets ?? []) as {
      id: string;
      title: string;
      kind: string;
      channels: number;
      duration_ms: number;
      staging_path: string | null;
    }[]).map((a) => [a.id, a]),
  );

  const editable = canEditSound(staff.role);
  const l = layer as Record<string, unknown>;

  return (
    <main className="px-8 py-10">
      <p className="text-sm text-textMuted">
        <Link href={`/sound/profiles/${profileId}`} className="text-primary underline">
          ← Profile
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">
        {String(l.name)}
      </h1>
      <p className="mt-2 text-sm text-textMuted">
        {String(l.time_window)} · {String(l.kind)}
      </p>

      {editable ? (
        <ServerActionForm action={saveAmbienceLayer} className="mt-8 max-w-xl space-y-4">
          <input type="hidden" name="id" value={layerId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <label className="block text-sm">
            <span className="text-textMuted">Name</span>
            <input
              name="name"
              required
              defaultValue={String(l.name)}
              aria-label="Layer name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Kind</span>
            <select
              name="kind"
              defaultValue={String(l.kind)}
              aria-label="Layer kind"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="bed">bed</option>
              <option value="oneshot">oneshot</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-textMuted">Gain min (dB)</span>
              <input
                name="gain_db_min"
                type="number"
                defaultValue={String(l.gain_db_min)}
                aria-label="Gain minimum"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Gain max (dB)</span>
              <input
                name="gain_db_max"
                type="number"
                defaultValue={String(l.gain_db_max)}
                aria-label="Gain maximum"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-textMuted">Pan min</span>
              <input
                name="pan_min"
                type="number"
                step="0.01"
                defaultValue={String(l.pan_min)}
                aria-label="Pan minimum"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Pan max</span>
              <input
                name="pan_max"
                type="number"
                step="0.01"
                defaultValue={String(l.pan_max)}
                aria-label="Pan maximum"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-textMuted">Pitch cents min</span>
              <input
                name="pitch_cents_min"
                type="number"
                defaultValue={String(l.pitch_cents_min)}
                aria-label="Pitch minimum"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Pitch cents max</span>
              <input
                name="pitch_cents_max"
                type="number"
                defaultValue={String(l.pitch_cents_max)}
                aria-label="Pitch maximum"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          <h3 className="text-sm font-medium">Intervals (oneshots)</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-textMuted">Min interval (s)</span>
              <input
                name="min_interval_s"
                type="number"
                defaultValue={
                  l.min_interval_s != null ? String(l.min_interval_s) : ""
                }
                aria-label="Minimum interval"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Mean interval (s)</span>
              <input
                name="mean_interval_s"
                type="number"
                defaultValue={
                  l.mean_interval_s != null ? String(l.mean_interval_s) : ""
                }
                aria-label="Mean interval"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-textMuted">Max concurrent</span>
              <input
                name="max_concurrent"
                type="number"
                defaultValue={String(l.max_concurrent)}
                aria-label="Max concurrent"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-textMuted">Crossfade ms</span>
              <input
                name="crossfade_ms"
                type="number"
                defaultValue={String(l.crossfade_ms)}
                aria-label="Crossfade"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-textMuted">No repeat last N</span>
            <input
              name="no_repeat_last"
              type="number"
              defaultValue={String(l.no_repeat_last)}
              aria-label="No repeat last"
              className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Active months (1–12, comma-separated)</span>
            <input
              name="months"
              defaultValue={formatIntArray((l.months as number[]) ?? [])}
              aria-label="Active months"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Nesting mute months</span>
            <input
              name="nesting_mute_months"
              defaultValue={formatIntArray((l.nesting_mute_months as number[]) ?? [])}
              aria-label="Nesting mute months"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="speaker_safe"
              defaultChecked={Boolean(l.speaker_safe)}
              aria-label="Speaker safe"
            />
            Speaker safe
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="wildlife_call"
              defaultChecked={Boolean(l.wildlife_call)}
              aria-label="Wildlife call"
            />
            Wildlife call (muted on phone speaker in nesting months)
          </label>
          <ServerActionSubmit aria-label="Save layer">Save layer</ServerActionSubmit>
        </ServerActionForm>
      ) : null}

      <LayerAudition
        assets={((assets ?? []) as {
          id: string;
          title: string;
          staging_path: string | null;
        }[]).map((a) => ({
          id: a.id,
          title: a.title,
          staging_path: a.staging_path,
        }))}
      />

      <section className="mt-12 max-w-xl" aria-labelledby="weights-heading">
        <h2 id="weights-heading" className="font-serif text-xl font-semibold">
          Asset weights
        </h2>
        {editable ? (
          <ServerActionForm
            action={saveLayerAssetWeights}
            className="mt-4 space-y-4"
          >
            <input type="hidden" name="layer_id" value={layerId} />
            <input type="hidden" name="profile_id" value={profileId} />
            {(weights ?? []).map((w) => {
              const asset = assetById.get(w.asset_id as string);
              return (
                <div key={w.asset_id as string} className="rounded-md border border-border p-3">
                  <input type="hidden" name="asset_id" value={w.asset_id as string} />
                  <p className="text-sm font-medium">
                    {asset?.title ?? w.asset_id}
                    {asset ? ` (${asset.kind})` : ""}
                  </p>
                  {asset ? (
                    <BedAssetHints
                      kind={asset.kind}
                      channels={asset.channels}
                      durationMs={asset.duration_ms}
                    />
                  ) : null}
                  <label className="mt-2 block text-sm">
                    <span className="text-textMuted">Weight</span>
                    <input
                      name="weight"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={String(w.weight)}
                      aria-label={`Weight for ${asset?.title ?? "asset"}`}
                      className="mt-1 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2"
                    />
                  </label>
                </div>
              );
            })}
            <div className="rounded-md border border-dashed border-border p-3">
              <p className="text-sm text-textMuted">Add asset</p>
              <select
                name="asset_id"
                aria-label="Add layer asset"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2"
                defaultValue=""
              >
                <option value="">Select…</option>
                {((allAssets ?? []) as { id: string; title: string; kind: string }[]).map(
                  (a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.kind})
                    </option>
                  ),
                )}
              </select>
              <input type="hidden" name="weight" value="1" />
            </div>
            <ServerActionSubmit aria-label="Save weights">Save weights</ServerActionSubmit>
          </ServerActionForm>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {(weights ?? []).map((w) => {
              const asset = assetById.get(w.asset_id as string);
              return (
                <li key={w.asset_id as string}>
                  {asset?.title ?? w.asset_id} · weight {w.weight}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}