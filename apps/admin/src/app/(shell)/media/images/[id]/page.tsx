import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWriteMedia, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { updateImageAsset } from "../actions";

type Props = { params: Promise<{ id: string }> };

export default async function ImageDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data } = await supabase
    .from("image_assets")
    .select("id, title, alt_text, width, height, bytes, ext, staging_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const editable = canWriteMedia(staff.role);
  const note =
    Math.max(data.width, data.height) > 2048 || data.bytes > 1_048_576
      ? "Longest edge over 2048 px or file over 1 MB — images ship in packs."
      : null;

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">{data.title}</h1>
      <p className="mt-2 text-textMuted">
        {data.width}×{data.height} · {data.ext} · {Math.round(data.bytes / 1024)}{" "}
        KB
      </p>
      {note ? (
        <p className="mt-2 text-sm text-textMuted" role="status">
          {note}
        </p>
      ) : null}
      {editable ? (
        <form action={updateImageAsset} className="mt-8 max-w-xl space-y-4">
          <input type="hidden" name="id" value={data.id} />
          <label className="block text-sm">
            <span className="text-textMuted">Title</span>
            <input
              name="title"
              required
              defaultValue={data.title}
              aria-label="Title"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Alt text (en) — required</span>
            <input
              name="alt_en"
              required
              defaultValue={l10nEn(data.alt_text)}
              aria-label="Alt text English"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <Button type="submit">Save</Button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-textMuted">
          Alt: {l10nEn(data.alt_text) || "(none)"}
        </p>
      )}
    </main>
  );
}
