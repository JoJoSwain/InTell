import { StatusBadge } from "@/components/status-badge";

export default function HomePage() {
  return (
    <main className="px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold">Home</h1>
      <p className="mt-2 max-w-xl text-textMuted">
        Hosted foundation for InTell staff. Use Ops in the sidebar for regions,
        audit and staff. Authoring tools arrive in later milestones.
      </p>
      <div className="mt-6 flex flex-wrap gap-2" aria-label="Status badge samples">
        <StatusBadge status="draft" />
        <StatusBadge status="scheduled" />
        <StatusBadge status="published" />
        <StatusBadge status="failed" />
        <StatusBadge status="retired" />
        <StatusBadge status="unpublished" />
      </div>
    </main>
  );
}
