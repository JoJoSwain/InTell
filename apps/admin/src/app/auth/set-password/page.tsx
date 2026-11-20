"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
        aria-labelledby="set-password-title"
      >
        <h1 id="set-password-title" className="font-serif text-2xl font-semibold">
          Set password
        </h1>
        <p className="text-sm text-textMuted">
          Choose a password of at least 10 characters.
        </p>
        <label className="block text-sm">
          <span className="text-textMuted">New password</span>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </main>
  );
}
