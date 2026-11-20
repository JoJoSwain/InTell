import { L10n, pickL10n } from "@intell/shared";
import { Button } from "@/components/ui/button";

const title = L10n.parse({
  en: "InTell Admin",
  es: "Admin de InTell",
});

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">
          Replaceplace · Staff
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold">
          {pickL10n(title, "en")}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-7 text-textMuted">
          M0 scaffold. Story editors, the Listening Simulator, seed inbox, and
          rights tools land in M3–M4 and M9–M10. Sidebar groups will follow
          DESIGN.md §5.
        </p>
        <div className="mt-8">
          <Button type="button">Open staff tools</Button>
        </div>
        <ul className="mt-10 space-y-2 text-sm text-textMuted">
          <li>Story · Sound · Community · Rights · Ops</li>
          <li>Auth + RLS roles arrive with M2/M3</li>
          <li>
            Shared zod schemas live in <code>@intell/shared</code>
          </li>
        </ul>
      </div>
    </main>
  );
}
