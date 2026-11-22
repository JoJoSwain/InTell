import { notFound, redirect } from "next/navigation";
import {
  audioFormatOffTarget,
  loudnessOffTarget,
  type LoudnessAssetKind,
} from "@intell/shared";
import { createClient } from "@/lib/supabase/server";
import { canWriteMedia, isActiveStaff, loadStaff } from "@/lib/staff";
import { AudioWarningBadges } from "@/components/checklist-badges";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { updateAudioAsset } from "../actions";
import { AudioWaveform } from "../waveform";

type Props = { params: Promise<{ id: string }> };

export default async function AudioDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data } = await supabase
    .from("audio_assets")
    .select(
      "id, title, kind, tags, staging_path, ext, channels, sample_rate, bitrate_kbps, loudness_lufs, true_peak_dbtp, max_short_term_lufs, duration_ms",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const row = data as {
    id: string;
    title: string;
    kind: string;
    tags: string[];
    staging_path: string;
    ext: string;
    channels: number;
    sample_rate: number;
    bitrate_kbps: number | null;
    loudness_lufs: number | null;
    true_peak_dbtp: number | null;
    max_short_term_lufs?: number | null;
    duration_ms: number;
  };
  const kind = row.kind as LoudnessAssetKind;
  const loudness = loudnessOffTarget(
    kind,
    row.loudness_lufs,
    row.max_short_term_lufs ?? null,
  );
  const format = audioFormatOffTarget(kind, {
    ext: row.ext,
    channels: row.channels,
    sampleRate: row.sample_rate,
    bitrateKbps: row.bitrate_kbps ?? 0,
  });
  const editable = canWriteMedia(staff.role);

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">{row.title}</h1>
      <p className="mt-2 text-textMuted">
        {row.kind} · {row.ext} · {row.channels} ch · {row.sample_rate} Hz ·{" "}
        {row.bitrate_kbps ?? "?"} kbps · {row.duration_ms} ms
      </p>
      <div className="mt-3">
        <AudioWarningBadges loudness={loudness} format={format} />
      </div>
      <div className="mt-6 max-w-2xl">
        <AudioWaveform stagingPath={row.staging_path} />
      </div>
      {editable ? (
        <ServerActionForm
          action={updateAudioAsset}
          className="mt-8 max-w-xl space-y-4"
        >
          <input type="hidden" name="id" value={row.id} />
          <label className="block text-sm">
            <span className="text-textMuted">Title</span>
            <input
              name="title"
              required
              defaultValue={row.title}
              aria-label="Title"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Tags (comma-separated)</span>
            <input
              name="tags"
              defaultValue={row.tags.join(", ")}
              aria-label="Tags"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <ServerActionSubmit>Save</ServerActionSubmit>
        </ServerActionForm>
      ) : (
        <p className="mt-6 text-sm text-textMuted">View only for your role.</p>
      )}
    </main>
  );
}
