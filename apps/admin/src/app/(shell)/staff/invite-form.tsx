"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inviteStaff } from "./actions";

export function InviteStaffForm() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setInfo(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const result = await inviteStaff(fd);
        setPending(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setInfo(result.resent ? "Invite resent." : "Invite sent.");
        form.reset();
      }}
    >
      <label className="block text-sm">
        <span className="text-textMuted">Email</span>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Display name</span>
        <input
          name="displayName"
          required
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-textMuted">Role</span>
        <select
          name="role"
          defaultValue="writer"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="writer">writer</option>
          <option value="sound">sound</option>
          <option value="moderator">moderator</option>
          <option value="viewer">viewer</option>
        </select>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="text-sm text-textMuted" role="status">
          {info}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
