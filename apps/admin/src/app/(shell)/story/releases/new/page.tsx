import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canPublishRelease, isActiveStaff, loadStaff } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { createRelease } from "../actions";

export default async function NewReleasePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");
  if (!canPublishRelease(staff.role)) redirect("/no-access");

  return (
    <main className="px-8 py-10">
      <p className="text-sm text-textMuted">
        <Link href="/story/releases" className="text-primary underline">
          ← Releases
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-3xl font-semibold">New release</h1>
      <form action={createRelease} className="mt-8 max-w-xl space-y-4">
        <label className="block text-sm">
          <span className="text-textMuted">Name</span>
          <input
            name="name"
            required
            aria-label="Release name"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-textMuted">Notes</span>
          <textarea
            name="notes"
            rows={3}
            aria-label="Release notes"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
          />
        </label>
        <Button type="submit" aria-label="Create release">
          Create release
        </Button>
      </form>
    </main>
  );
}
