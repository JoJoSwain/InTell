import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWriteStoryNotes, isActiveStaff, loadStaff } from "@/lib/staff";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import { saveThread } from "./actions";

type ThreadRow = {
  id: string;
  title: string;
  notes: string | null;
};

export default async function StoryNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: threads, error } = await supabase
    .from("threads")
    .select("id, title, notes")
    .order("title");

  const editable = canWriteStoryNotes(staff.role);
  const selected =
    ((threads ?? []) as ThreadRow[]).find((t) => t.id === sp.thread) ??
    ((threads ?? []) as ThreadRow[])[0];

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Story Notes</h1>
      <p className="mt-2 text-textMuted">
        Threads (title and private notes). Writers may edit.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <ul className="divide-y divide-border border-y border-border">
          {((threads ?? []) as ThreadRow[]).map((t) => (
            <li key={t.id} className="py-2">
              <a
                href={`/story/notes?thread=${t.id}`}
                className="text-primary hover:underline"
                aria-current={t.id === selected?.id ? "page" : undefined}
              >
                {t.title}
              </a>
            </li>
          ))}
          {(threads ?? []).length === 0 ? (
            <li className="py-4 text-sm text-textMuted">No threads yet.</li>
          ) : null}
        </ul>

        <div className="max-w-xl space-y-8">
          {selected && editable ? (
            <ServerActionForm action={saveThread} className="space-y-4">
              <input type="hidden" name="id" value={selected.id} />
              <h2 className="font-serif text-xl font-semibold">Edit thread</h2>
              <label className="block text-sm">
                <span className="text-textMuted">Title</span>
                <input
                  name="title"
                  required
                  defaultValue={selected.title}
                  aria-label="Thread title"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-textMuted">Notes</span>
                <textarea
                  name="notes"
                  rows={8}
                  defaultValue={selected.notes ?? ""}
                  aria-label="Thread notes"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <ServerActionSubmit aria-label="Save thread">
                Save thread
              </ServerActionSubmit>
            </ServerActionForm>
          ) : selected ? (
            <div>
              <h2 className="font-serif text-xl font-semibold">
                {selected.title}
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm">
                {selected.notes || "(no notes)"}
              </p>
            </div>
          ) : null}

          {editable ? (
            <ServerActionForm
              action={saveThread}
              className="space-y-4 border-t border-border pt-8"
            >
              <h2 className="font-serif text-xl font-semibold">New thread</h2>
              <label className="block text-sm">
                <span className="text-textMuted">Title</span>
                <input
                  name="title"
                  required
                  aria-label="New thread title"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-textMuted">Notes</span>
                <textarea
                  name="notes"
                  rows={4}
                  aria-label="New thread notes"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </label>
              <ServerActionSubmit>Create thread</ServerActionSubmit>
            </ServerActionForm>
          ) : null}
        </div>
      </div>
    </main>
  );
}
