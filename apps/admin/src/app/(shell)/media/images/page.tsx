import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canWriteMedia, isActiveStaff, loadStaff } from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { ImageUploadForm } from "./upload-form";

type ImageRow = {
  id: string;
  title: string;
  alt_text: unknown;
  width: number;
  height: number;
  bytes: number;
};

export default async function ImagesLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  let query = supabase
    .from("image_assets")
    .select("id, title, alt_text, width, height, bytes")
    .order("title");
  if (sp.q) query = query.ilike("title", `%${sp.q}%`);
  const { data, error } = await query;
  const rows = (data ?? []) as ImageRow[];
  const writable = canWriteMedia(staff.role);

  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Images</h1>
      <p className="mt-2 text-textMuted">
        Portraits and artwork. Alt text (en) is required.
      </p>

      <form className="mt-6 flex gap-3" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search title"
          aria-label="Search title"
          className="rounded-md border border-input bg-background px-3 py-2"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {rows.map((r) => {
          const alt = l10nEn(r.alt_text);
          return (
            <li key={r.id} className="py-3">
              <Link
                href={`/media/images/${r.id}`}
                className="font-medium text-primary hover:underline"
              >
                {r.title}
              </Link>
              <p className="text-sm text-textMuted">
                {r.width}×{r.height} · {Math.round(r.bytes / 1024)} KB
                {!alt ? " · missing alt text" : ""}
              </p>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="py-6 text-sm text-textMuted">No images yet.</li>
        ) : null}
      </ul>

      {writable ? (
        <section className="mt-10 max-w-xl">
          <h2 className="font-serif text-xl font-semibold">Upload</h2>
          <div className="mt-4">
            <ImageUploadForm />
          </div>
        </section>
      ) : null}
    </main>
  );
}
