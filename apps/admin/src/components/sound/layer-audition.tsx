"use client";

/**
 * Lightweight layer asset audition for P2a (HTML audio).
 * Full Web Audio mixing / Simulator is P2b.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type Asset = {
  id: string;
  title: string;
  staging_path: string | null;
};

export function LayerAudition({ assets }: { assets: Asset[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audio?.pause();
    };
  }, [audio]);

  async function play(asset: Asset) {
    setError(null);
    if (!asset.staging_path) {
      setError("No staging audio for this asset");
      return;
    }
    audio?.pause();
    const supabase = createClient();
    const parts = asset.staging_path.split("/");
    const bucket = parts[0] ?? "staging-audio";
    const objectPath = parts.slice(1).join("/");
    const { data, error: urlErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, 600);
    if (urlErr || !data?.signedUrl) {
      setError(urlErr?.message ?? "Could not get signed URL");
      return;
    }
    const el = new Audio(data.signedUrl);
    el.onended = () => setPlayingId(null);
    setAudio(el);
    setPlayingId(asset.id);
    try {
      await el.play();
    } catch (err) {
      setPlayingId(null);
      setError(err instanceof Error ? err.message : "Play failed");
    }
  }

  function stop() {
    audio?.pause();
    setPlayingId(null);
  }

  if (!assets.length) return null;

  return (
    <section className="mt-8 max-w-xl" aria-labelledby="audition-heading">
      <h2 id="audition-heading" className="font-serif text-xl font-semibold">
        Audition
      </h2>
      <p className="mt-1 text-xs text-textMuted">
        Preview staging assets. Mix rules and zone blending land in the
        Listening Simulator (P2b).
      </p>
      <ul className="mt-3 space-y-2">
        {assets.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">{a.title}</span>
            {playingId === a.id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={stop}
                aria-label={`Stop ${a.title}`}
              >
                Stop
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void play(a)}
                aria-label={`Audition ${a.title}`}
                disabled={!a.staging_path}
              >
                Play
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
