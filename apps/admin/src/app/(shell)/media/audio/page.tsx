import Link from "next/link";
import { redirect } from "next/navigation";
import {
  audioFormatOffTarget,
  loudnessOffTarget,
  type LoudnessAssetKind,
} from "@intell/shared";
import { createClient } from "@/lib/supabase/server";
import { canWriteMedia, isActiveStaff, loadStaff } from "@/lib/staff";
import { AudioWarningBadges } from "@/components/checklist-badges";
import { Button } from "@/components/ui/button";
import { AudioUploadForm } from "./upload-form";

type AudioRow = {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  ext: string;
  channels: number;
  sample_rate: number;
  bitrate_kbps: number | null;
  loudness_lufs: number | null;
  max_short_term_lufs?: number | null;
};

export default async function AudioLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  let query = supabase
    .from("audio_assets")
    .select(
      "id, title, kind, tags, ext, channels, sample_rate, bitrate_kbps, loudness_lufs, max_short_term_lufs",
    )
    .order("title");
  if (sp.kind) query = query.eq("kind", sp.kind);
  if (sp.q) query = query.ilike("title", `%${sp.q}%`);

  const { data, error } = await query;
  const rows = (data ?? []) as AudioRow[];
  const writable = canWriteMedia(staff.role);

  return (
    <main className="px-8 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Audio</h1>
          <p className="mt-2 text-textMuted">
            Staging library. Off-spec files upload with warnings.
          </p>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <label className="text-sm">
          <span className="sr-only">Kind filter</span>
          <select
            name="kind"
            defaultValue={sp.kind ?? ""}
            aria-label="Kind filter"
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">All kinds</option>
            {(
              [
                "narration",
                "sfx_oneshot",
                "sfx_bed",
                "music_stem",
                "voice_cue",
                "growth_cue",
              ] as const
            ).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Search</span>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search title"
            aria-label="Search title"
            className="rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {rows.map((r) => {
          const kind = r.kind as LoudnessAssetKind;
          const loudness = loudnessOffTarget(
            kind,
            r.loudness_lufs,
            r.max_short_term_lufs ?? null,
          );
          const format = audioFormatOffTarget(kind, {
            ext: r.ext,
            channels: r.channels,
            sampleRate: r.sample_rate,
            bitrateKbps: r.bitrate_kbps ?? 0,
          });
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <Link
                  href={`/media/audio/${r.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {r.title}
                </Link>
                <p className="text-sm text-textMuted">
                  {r.kind}
                  {r.tags.length ? ` · ${r.tags.join(", ")}` : ""}
                </p>
              </div>
              <AudioWarningBadges loudness={loudness} format={format} />
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="py-6 text-sm text-textMuted">No audio assets yet.</li>
        ) : null}
      </ul>

      {writable ? (
        <section className="mt-10 max-w-xl">
          <h2 className="font-serif text-xl font-semibold">Upload</h2>
          <div className="mt-4">
            <AudioUploadForm />
          </div>
        </section>
      ) : null}
    </main>
  );
}
