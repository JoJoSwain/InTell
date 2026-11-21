"use client";

import { useState } from "react";
import Link from "next/link";
import {
  audioFormatOffTarget,
  loudnessOffTarget,
  type LoudnessAssetKind,
} from "@intell/shared";
import { Button } from "@/components/ui/button";
import { AudioWarningBadges } from "@/components/checklist-badges";
import { analyzeAudioFile } from "@/lib/audio/analyze";
import { createClient } from "@/lib/supabase/client";
import {
  sha256Hex,
  stagingObjectExists,
  uploadStagingObject,
} from "@/lib/media/upload";
import { insertAudioAssetRow } from "./actions";

const KINDS: LoudnessAssetKind[] = [
  "narration",
  "sfx_oneshot",
  "sfx_bed",
  "music_stem",
  "voice_cue",
  "growth_cue",
];

export function AudioUploadForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [warnings, setWarnings] = useState<{
    loudness: boolean;
    format: boolean;
  } | null>(null);
  const [loudnessMsg, setLoudnessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setDuplicate(null);
    setWarnings(null);
    setLoudnessMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    const title = String(fd.get("title") ?? "").trim();
    const kind = String(fd.get("kind") ?? "narration") as LoudnessAssetKind;
    const tags = String(fd.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!(file instanceof File) || !title) {
      setStatus("File and title required");
      setBusy(false);
      return;
    }

    try {
      const analysis = await analyzeAudioFile(file, kind);
      if (analysis.loudnessError) setLoudnessMsg(analysis.loudnessError);

      const warn = {
        loudness: loudnessOffTarget(
          kind,
          analysis.loudnessLufs,
          analysis.maxShortTermLufs,
        ),
        format: audioFormatOffTarget(kind, {
          ext: analysis.ext,
          channels: analysis.channels,
          sampleRate: analysis.sampleRate,
          bitrateKbps: analysis.bitrateKbps,
        }),
      };
      setWarnings(warn);

      const bytes = await file.arrayBuffer();
      const sha = await sha256Hex(bytes);
      const supabase = createClient();

      const { data: existing } = await supabase
        .from("audio_assets")
        .select("id, title, staging_path, ext")
        .eq("sha256", sha)
        .maybeSingle();

      if (existing) {
        const exists = await stagingObjectExists(
          supabase,
          "staging-audio",
          sha,
          existing.ext as string,
        );
        if (!exists) {
          await uploadStagingObject(
            supabase,
            "staging-audio",
            sha,
            existing.ext as string,
            bytes,
            file.type || undefined,
          );
          setStatus("Staging object was missing; re-uploaded. No new library row.");
        }
        setDuplicate({ id: existing.id as string, title: existing.title as string });
        setBusy(false);
        return;
      }

      const { stagingPath } = await uploadStagingObject(
        supabase,
        "staging-audio",
        sha,
        analysis.ext,
        bytes,
        file.type || undefined,
      );

      const result = await insertAudioAssetRow({
        title,
        kind,
        tags,
        sha256: sha,
        ext: analysis.ext,
        bytes: file.size,
        duration_ms: analysis.durationMs || 1,
        channels: analysis.channels,
        sample_rate: analysis.sampleRate,
        bitrate_kbps: analysis.bitrateKbps || null,
        loudness_lufs: analysis.loudnessLufs,
        true_peak_dbtp: analysis.truePeakDbtp,
        max_short_term_lufs: analysis.maxShortTermLufs,
        staging_path: stagingPath,
      });

      if (result.duplicate) {
        setDuplicate({ id: result.id, title: result.title });
      } else {
        setStatus("Uploaded.");
        window.location.href = `/media/audio/${result.id}`;
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-textMuted">Title</span>
        <input
          name="title"
          required
          aria-label="Title"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Kind</span>
        <select
          name="kind"
          aria-label="Kind"
          defaultValue="narration"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Tags (comma-separated)</span>
        <input
          name="tags"
          aria-label="Tags"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Audio file</span>
        <input
          name="file"
          type="file"
          accept=".m4a,audio/*"
          required
          aria-label="Audio file"
          className="mt-1 block w-full text-sm"
        />
      </label>
      {warnings ? (
        <AudioWarningBadges
          loudness={warnings.loudness}
          format={warnings.format}
        />
      ) : null}
      {loudnessMsg ? (
        <p className="text-sm text-textMuted" role="status">
          {loudnessMsg}
        </p>
      ) : null}
      {duplicate ? (
        <p className="text-sm" role="status">
          This file is already in the library as{" "}
          <Link
            href={`/media/audio/${duplicate.id}`}
            className="text-primary underline"
          >
            &lsquo;{duplicate.title}&rsquo;
          </Link>
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-textMuted" role="status">
          {status}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
