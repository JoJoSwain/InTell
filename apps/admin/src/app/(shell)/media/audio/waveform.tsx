"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { createClient } from "@/lib/supabase/client";

export function AudioWaveform({
  stagingPath,
}: {
  stagingPath: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let ws: WaveSurfer | null = null;
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      // staging_path = staging-audio/{sha}.ext
      const parts = stagingPath.split("/");
      const bucket = parts[0] ?? "staging-audio";
      const objectPath = parts.slice(1).join("/");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 3600);
      if (error || !data?.signedUrl || cancelled) return;

      ws = WaveSurfer.create({
        container: el,
        waveColor: "#6b7c6e",
        progressColor: "#2f4a3a",
        height: 80,
        url: data.signedUrl,
      });
    })();

    return () => {
      cancelled = true;
      ws?.destroy();
    };
  }, [stagingPath]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-md border border-border bg-muted/30"
      role="img"
      aria-label="Audio waveform"
    />
  );
}
