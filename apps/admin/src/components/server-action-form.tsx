"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import type { ServerActionResult } from "@/lib/server-action-result";

type ServerAction = (formData: FormData) => Promise<ServerActionResult>;

const PendingContext = createContext(false);
const MountedContext = createContext(false);

/** True while a ServerActionForm submit is in flight. */
export function useServerActionPending(): boolean {
  return useContext(PendingContext);
}

/**
 * Admin text-editing forms: submit via onSubmit + startTransition (no `action`
 * prop), show errors, disable submit while pending, then hard-navigate to the
 * href the server action returns. Avoids React 19's automatic form reset racing
 * a same-URL soft redirect (M3e/M3h doubling).
 *
 * Submit stays disabled until mount so a soft-nav remount cannot native-GET
 * the form before `onSubmit` is attached.
 */
export function ServerActionForm({
  action,
  className,
  children,
  formKey,
}: {
  action: ServerAction;
  className?: string;
  children: ReactNode;
  /** Optional remount key after navigation (e.g. journey passages). */
  formKey?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mounted) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result?.ok || !result.href) {
          throw new Error("Save succeeded without a redirect href");
        }
        window.location.assign(result.href);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message || "Save failed"
            : typeof err === "string"
              ? err
              : "Save failed";
        setError(message);
      }
    });
  }

  return (
    <MountedContext.Provider value={mounted}>
      <PendingContext.Provider value={pending}>
        {/* method/action guard: without JS, avoid a GET that dumps fields into the URL */}
        <form
          key={formKey}
          method="post"
          action="#"
          className={className}
          onSubmit={onSubmit}
        >
          {children}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </PendingContext.Provider>
    </MountedContext.Provider>
  );
}

export function ServerActionSubmit({
  children,
  pendingLabel = "Saving…",
  "aria-label": ariaLabel,
  className,
  variant,
  size,
}: {
  children: ReactNode;
  pendingLabel?: string;
  "aria-label"?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  const pending = useServerActionPending();
  const mounted = useContext(MountedContext);
  const label = typeof children === "string" ? children : undefined;
  const disabled = !mounted || pending;
  return (
    <Button
      type="submit"
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={className}
      variant={variant}
      size={size}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
