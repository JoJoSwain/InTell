"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (signErr) {
      setError(signErr.message);
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
        aria-labelledby="sign-in-title"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary">
            Replaceplace
          </p>
          <h1 id="sign-in-title" className="mt-2 font-serif text-2xl font-semibold">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-textMuted">
            Invite-only staff access for InTell.
          </p>
        </div>
        <label className="block text-sm">
          <span className="text-textMuted">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-textMuted">Password</span>
          <input
            type="password"
            required
            minLength={10}
            autoComplete="current-password"
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
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-textMuted underline-offset-4 hover:underline"
          onClick={async () => {
            setError(null);
            if (!email) {
              setError("Enter your email first");
              return;
            }
            setPending(true);
            setInfo(null);
            const supabase = createClient();
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
              email,
              { redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password` },
            );
            setPending(false);
            if (resetErr) {
              setError(resetErr.message);
              return;
            }
            setInfo(
              "If that address has an account, a reset email is on the way.",
            );
          }}
        >
          Forgot password
        </button>
        {info ? (
          <p className="text-sm text-textMuted" role="status">
            {info}
          </p>
        ) : null}
      </form>
    </main>
  );
}
