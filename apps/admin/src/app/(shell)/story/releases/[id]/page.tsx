import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canPreviewRelease,
  canPublishRelease,
  isActiveStaff,
  loadStaff,
} from "@/lib/staff";
import { l10nEn } from "@/lib/geo";
import { StatusBadge } from "@/components/status-badge";
import {
  failuresFromLastCheck,
  GroupedChecklist,
} from "@/components/checklist-badges";
import { Button } from "@/components/ui/button";
import {
  ServerActionForm,
  ServerActionSubmit,
} from "@/components/server-action-form";
import {
  A5_PUBLISH_CHECK_CODES,
  entityAdminHref,
  RELEASE_ITEM_ENTITIES,
  type ReleaseItemEntity,
} from "@/lib/releases/links";
import {
  addMissingItems,
  cancelScheduleForm,
  copyToNewDraftForm,
  removeReleaseItem,
  retryFailedForm,
  scheduleRelease,
  updateReleaseMeta,
} from "../actions";
import { AddItemForm, type EntityOption } from "../add-item-form";
import {
  PreviewCheckButton,
  PublishNowButton,
  PublishingPoll,
  RunCheckButton,
  ScheduleForm,
} from "../release-actions-client";

type Props = { params: Promise<{ id: string }> };

type ReleaseRow = {
  id: string;
  name: string;
  notes: string | null;
  status: string;
  publish_at: string | null;
  published_at: string | null;
  last_check: unknown;
  created_at: string;
  created_by: string | null;
};

function toLocalDatetimeValue(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function ReleaseDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const staff = await loadStaff(supabase, user.id);
  if (!isActiveStaff(staff)) redirect("/no-access");

  const { data: release } = await supabase
    .from("releases")
    .select(
      "id, name, notes, status, publish_at, published_at, last_check, created_at, created_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (!release) notFound();
  const r = release as ReleaseRow;

  // Composite PK (release_id, entity, entity_id) — no surrogate id column.
  const { data: items } = await supabase
    .from("release_items")
    .select("entity, entity_id")
    .eq("release_id", id)
    .order("entity");

  const itemRows = (items ?? []) as {
    entity: string;
    entity_id: string;
  }[];

  const [
    { data: groves },
    { data: fragments },
    { data: revisions },
    { data: characters },
    { data: images },
    { data: creatorRow },
  ] = await Promise.all([
    supabase.from("groves").select("id, slug, name").order("slug"),
    supabase.from("fragments").select("id, grove_id, title, teaser").order("id"),
    supabase
      .from("fragment_revisions")
      .select("id, fragment_id, revision_no, status, change_kind")
      .order("revision_no", { ascending: false }),
    supabase.from("characters").select("id, name, public_name").order("name"),
    supabase.from("image_assets").select("id, title").order("title"),
    r.created_by
      ? supabase
          .from("staff")
          .select("display_name")
          .eq("user_id", r.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null as { display_name: string } | null }),
  ]);
  const creatorName =
    creatorRow && typeof creatorRow === "object" && "display_name" in creatorRow
      ? String(
          (creatorRow as { display_name: string | null }).display_name ?? "",
        )
      : "";

  const groveById = new Map(
    ((groves ?? []) as { id: string; slug: string; name: unknown }[]).map(
      (g) => [g.id, g],
    ),
  );
  const fragById = new Map(
    (
      (fragments ?? []) as {
        id: string;
        grove_id: string;
        title: unknown;
        teaser: unknown;
      }[]
    ).map((f) => [f.id, f]),
  );

  const pickerOptions: Record<ReleaseItemEntity, EntityOption[]> = {
    grove: ((groves ?? []) as { id: string; slug: string; name: unknown }[]).map(
      (g) => ({
        id: g.id,
        label: `${g.slug} — ${l10nEn(g.name) || g.slug}`,
      }),
    ),
    fragment: (
      (fragments ?? []) as {
        id: string;
        grove_id: string;
        title: unknown;
        teaser: unknown;
      }[]
    ).map((f) => {
      const g = groveById.get(f.grove_id);
      const title = l10nEn(f.title) || l10nEn(f.teaser) || f.id.slice(0, 8);
      return {
        id: f.id,
        label: g ? `${g.slug} · ${title}` : title,
      };
    }),
    revision: (
      (revisions ?? []) as {
        id: string;
        fragment_id: string;
        revision_no: number;
        status: string;
        change_kind: string;
      }[]
    ).map((rev) => {
      const frag = fragById.get(rev.fragment_id);
      const g = frag ? groveById.get(frag.grove_id) : undefined;
      const fragLabel = frag
        ? l10nEn(frag.title) || frag.id.slice(0, 8)
        : rev.fragment_id.slice(0, 8);
      return {
        id: rev.id,
        label: `${g?.slug ?? "?"} · ${fragLabel} · r${rev.revision_no} (${rev.status})`,
      };
    }),
    character: (
      (characters ?? []) as {
        id: string;
        name: string;
        public_name: unknown;
      }[]
    ).map((c) => ({
      id: c.id,
      label: `${c.name}${l10nEn(c.public_name) ? ` — ${l10nEn(c.public_name)}` : ""}`,
    })),
    image: ((images ?? []) as { id: string; title: string }[]).map((img) => ({
      id: img.id,
      label: img.title,
    })),
  };

  const canEdit = canPublishRelease(staff.role);
  const canPreview = canPreviewRelease(staff.role);
  const failures = failuresFromLastCheck(r.last_check);
  const a5Failures = failures.filter((f) =>
  A5_PUBLISH_CHECK_CODES.includes(
      f.code as (typeof A5_PUBLISH_CHECK_CODES)[number],
    ),
  );
  const hasMissingDeps = failures.some(
    (f) =>
      f.code === "DEPENDENCY_UNPUBLISHED" &&
      f.entity &&
      f.entity_id &&
      (RELEASE_ITEM_ENTITIES as readonly string[]).includes(f.entity),
  );
  const editableStatus =
    r.status === "draft" || r.status === "failed" || r.status === "scheduled";
  const showFailures =
    failures.length > 0 &&
    (r.status === "publishing" ||
      r.status === "published" ||
      r.status === "failed" ||
      r.status === "draft" ||
      r.status === "scheduled");

  function itemLabel(entity: string, entityId: string): string {
    if ((RELEASE_ITEM_ENTITIES as readonly string[]).includes(entity)) {
      const opt = pickerOptions[entity as ReleaseItemEntity]?.find(
        (o) => o.id === entityId,
      );
      if (opt) return opt.label;
    }
    return `${entity} ${entityId.slice(0, 8)}`;
  }

  function itemHref(entity: string, entityId: string): string | null {
    if (entity === "fragment") {
      const frag = fragById.get(entityId);
      return entityAdminHref(entity, entityId, {
        groveId: frag?.grove_id,
      });
    }
    if (entity === "revision") {
      const rev = (
        (revisions ?? []) as { id: string; fragment_id: string }[]
      ).find((x) => x.id === entityId);
      const frag = rev ? fragById.get(rev.fragment_id) : undefined;
      return entityAdminHref(entity, entityId, {
        groveId: frag?.grove_id,
        fragmentId: rev?.fragment_id,
      });
    }
    return entityAdminHref(entity, entityId);
  }

  return (
    <main className="px-8 py-10">
      <p className="text-sm text-textMuted">
        <Link href="/story/releases" className="text-primary underline">
          ← Releases
        </Link>
      </p>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold">{r.name}</h1>
            <StatusBadge status={r.status} />
          </div>
          <p className="mt-2 text-sm text-textMuted">
            Created {new Date(r.created_at).toLocaleString()}
            {creatorName ? ` · ${creatorName}` : ""}
            {r.publish_at
              ? ` · scheduled ${new Date(r.publish_at).toLocaleString()}`
              : ""}
            {r.published_at
              ? ` · published ${new Date(r.published_at).toLocaleString()}`
              : ""}
          </p>
        </div>
      </div>

      {r.status === "publishing" ? <PublishingPoll /> : null}

      {canEdit && editableStatus ? (
        <ServerActionForm
          action={updateReleaseMeta}
          className="mt-8 max-w-xl space-y-4"
        >
          <input type="hidden" name="id" value={r.id} />
          <label className="block text-sm">
            <span className="text-textMuted">Name</span>
            <input
              name="name"
              required
              defaultValue={r.name}
              aria-label="Release name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-textMuted">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={r.notes ?? ""}
              aria-label="Release notes"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <ServerActionSubmit
            variant="outline"
            aria-label="Save release metadata"
          >
            Save
          </ServerActionSubmit>
        </ServerActionForm>
      ) : r.notes ? (
        <p className="mt-6 max-w-xl whitespace-pre-wrap text-sm text-textMuted">
          {r.notes}
        </p>
      ) : null}

      <section className="mt-10" aria-labelledby="items-heading">
        <h2 id="items-heading" className="font-serif text-xl font-semibold">
          Items
        </h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {itemRows.map((item) => {
            const href = itemHref(item.entity, item.entity_id);
            return (
              <li
                key={`${item.entity}:${item.entity_id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-textMuted">
                    {item.entity}
                  </p>
                  {href ? (
                    <Link
                      href={href}
                      className="text-primary hover:underline"
                      aria-label={`Open ${item.entity} ${item.entity_id}`}
                    >
                      {itemLabel(item.entity, item.entity_id)}
                    </Link>
                  ) : (
                    <span>{itemLabel(item.entity, item.entity_id)}</span>
                  )}
                </div>
                {canEdit && editableStatus ? (
                  <form action={removeReleaseItem}>
                    <input type="hidden" name="release_id" value={r.id} />
                    <input type="hidden" name="entity" value={item.entity} />
                    <input
                      type="hidden"
                      name="entity_id"
                      value={item.entity_id}
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${item.entity} from release`}
                    >
                      Remove
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
          {itemRows.length === 0 ? (
            <li className="py-6 text-sm text-textMuted">No items yet.</li>
          ) : null}
        </ul>

        {canEdit && editableStatus ? (
          <div className="mt-4 space-y-4">
            <AddItemForm releaseId={r.id} options={pickerOptions} />
            {hasMissingDeps ? (
              <form action={addMissingItems}>
                <input type="hidden" name="release_id" value={r.id} />
                <Button
                  type="submit"
                  variant="secondary"
                  aria-label="Add missing dependency items from checklist"
                >
                  Add missing items
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-10" aria-labelledby="checklist-heading">
        <h2 id="checklist-heading" className="font-serif text-xl font-semibold">
          Checklist
        </h2>
        {canEdit ? (
          <div className="mt-3">
            <RunCheckButton releaseId={r.id} />
          </div>
        ) : null}
        {showFailures ? (
          <div className="mt-4">
            {a5Failures.length > 0 ? (
              <div className="mb-6">
                <h3 className="text-sm font-medium">Sound checks (A5)</h3>
                <div className="mt-2">
                  <GroupedChecklist failures={a5Failures} />
                </div>
              </div>
            ) : null}
            <GroupedChecklist failures={failures} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-textMuted">
            {r.last_check
              ? "Last check reported no failures."
              : "Run a check to validate this release."}
          </p>
        )}
      </section>

      {canEdit ? (
        <section className="mt-10 space-y-6" aria-labelledby="publish-heading">
          <h2 id="publish-heading" className="font-serif text-xl font-semibold">
            Publish
          </h2>

          {(r.status === "draft" || r.status === "failed") && (
            <PublishNowButton releaseId={r.id} />
          )}

          {(r.status === "draft" ||
            r.status === "failed" ||
            r.status === "scheduled") && (
            <div>
              <h3 className="text-sm font-medium">Schedule</h3>
              <div className="mt-2">
                <ScheduleForm
                  releaseId={r.id}
                  action={scheduleRelease}
                  defaultLocal={toLocalDatetimeValue(r.publish_at)}
                />
              </div>
            </div>
          )}

          {r.status === "scheduled" ? (
            <form action={cancelScheduleForm}>
              <input type="hidden" name="release_id" value={r.id} />
              <Button
                type="submit"
                variant="outline"
                aria-label="Cancel scheduled publish"
              >
                Cancel schedule
              </Button>
            </form>
          ) : null}

          {r.status === "failed" ? (
            <div className="flex flex-wrap gap-2">
              <form action={retryFailedForm}>
                <input type="hidden" name="release_id" value={r.id} />
                <input type="hidden" name="mode" value="draft" />
                <Button
                  type="submit"
                  variant="outline"
                  aria-label="Return failed release to draft"
                >
                  Retry as draft
                </Button>
              </form>
              <form action={retryFailedForm}>
                <input type="hidden" name="release_id" value={r.id} />
                <input type="hidden" name="mode" value="publish" />
                <Button type="submit" aria-label="Retry publish now">
                  Retry publish now
                </Button>
              </form>
            </div>
          ) : null}

          {r.status === "cancelled" ? (
            <form action={copyToNewDraftForm}>
              <input type="hidden" name="release_id" value={r.id} />
              <Button
                type="submit"
                variant="outline"
                aria-label="Copy cancelled release to a new draft"
              >
                Copy to new draft
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {canPreview &&
      (r.status === "draft" ||
        r.status === "scheduled" ||
        r.status === "failed") ? (
        <section className="mt-10" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="font-serif text-xl font-semibold">
            Preview
          </h2>
          <p className="mt-2 text-sm text-textMuted">
            Builds a staging preview manifest for staff devices (never public).
          </p>
          <div className="mt-3">
            <PreviewCheckButton releaseId={r.id} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
