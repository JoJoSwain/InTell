"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  sha256Hex,
  stagingObjectExists,
  uploadStagingObject,
} from "@/lib/media/upload";
import { insertImageAssetRow } from "./actions";

function readImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

export function ImageUploadForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    setNote(null);
    setDuplicate(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    const title = String(fd.get("title") ?? "").trim();
    const altEn = String(fd.get("alt_en") ?? "").trim();
    if (!(file instanceof File) || !title || !altEn) {
      setStatus("File, title and alt text (en) are required");
      setBusy(false);
      return;
    }

    try {
      const { width, height } = await readImageSize(file);
      const longest = Math.max(width, height);
      if (longest > 2048 || file.size > 1_048_576) {
        setNote(
          "Note: longest edge over 2048 px or file over 1 MB — images ship in packs.",
        );
      }

      const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
      const bytes = await file.arrayBuffer();
      const sha = await sha256Hex(bytes);
      const supabase = createClient();

      const { data: existing } = await supabase
        .from("image_assets")
        .select("id, title, ext")
        .eq("sha256", sha)
        .maybeSingle();

      if (existing) {
        const exists = await stagingObjectExists(
          supabase,
          "staging-images",
          sha,
          existing.ext as string,
        );
        if (!exists) {
          await uploadStagingObject(
            supabase,
            "staging-images",
            sha,
            existing.ext as string,
            bytes,
            file.type || undefined,
          );
          setStatus("Staging object was missing; re-uploaded. No new library row.");
        }
        setDuplicate({
          id: existing.id as string,
          title: existing.title as string,
        });
        setBusy(false);
        return;
      }

      const { stagingPath } = await uploadStagingObject(
        supabase,
        "staging-images",
        sha,
        ext,
        bytes,
        file.type || undefined,
      );

      const result = await insertImageAssetRow({
        title,
        alt_en: altEn,
        sha256: sha,
        ext,
        bytes: file.size,
        width,
        height,
        staging_path: stagingPath,
      });

      if (result.duplicate) {
        setDuplicate({ id: result.id, title: result.title });
      } else {
        window.location.href = `/media/images/${result.id}`;
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
        <span className="text-textMuted">Alt text (en) — required</span>
        <input
          name="alt_en"
          required
          aria-label="Alt text English"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Image file</span>
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          required
          aria-label="Image file"
          className="mt-1 block w-full text-sm"
        />
      </label>
      {note ? (
        <p className="text-sm text-textMuted" role="status">
          {note}
        </p>
      ) : null}
      {duplicate ? (
        <p className="text-sm" role="status">
          This file is already in the library as{" "}
          <Link
            href={`/media/images/${duplicate.id}`}
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
