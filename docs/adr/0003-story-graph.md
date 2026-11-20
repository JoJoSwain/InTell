# ADR 0003: Story graph: prerequisite groups replace the fragment tree

**Status:** Accepted
**Date:** 2026-11-19
**Deciders:** JoJo (product owner), architect (Claude)
**Amends:** PRODUCT_SPEC §1 and FR-1/FR-2, DATA_MODEL §4, §11, §12.1, §14 and §15, JOURNAL_SPEC §3, AUDIO_SPEC §4.2

## Context
The v2 specs model a Grove's story as a strict tree. Every Branch has one Root parent, every Leaf has one Branch parent, Roots are always visible, and a child is revealed when its parent is heard to 80%. JoJo's test chain (the Farmington Bird Refuge table, 2026-11-19) and his intent for the product need things a tree can't express:

- **AND:** a fragment can need several earlier fragments (Frag 5 needs Frag 2 **and** Frag 3).
- **OR:** a fragment can be reachable by several routes (needs Frag A **or** Frag B). Taking one route never closes another. Every fragment that's already revealed stays available. The story is non-linear, not branching-exclusive.
- **Endings:** a "Root End" closes the story (Frag 6 needs Frags 1–5) and can share a location with the opening Root (Frags 1 and 6 are the same point).
- **Gated starts:** a "Root Start" can itself need earlier fragments (Frag 7 needs Frag 6). It opens a new thread of the same story, in the same Grove.
- **Completion:** a fragment counts as heard only when the listener has played **all** of it, not 80%.

Crossroads are unchanged. They're a community vote that gates **revisions** for everyone (`requires_outcome_option_id`). Prerequisites are personal, device-local and gate **fragments**.

## Decision

### 1. Tiers stay, and mean weight, not position
`tier` keeps `root | branch | leaf`. It now sets only the trigger priority (Root > Branch > Leaf), the default radius (30/25/20 m), the length guideline, and the marker style. It no longer constrains which fragments may depend on which: a Leaf can require a Leaf, and a Root can require anything.

Add `fragments.is_ending boolean not null default false`, with `check (not is_ending or tier = 'root')`. A Root with `is_ending = true` is a **Root End**. A Root with no prerequisites is a **Root Start** in the original sense, and one with prerequisites is a **gated Root Start**. A Grove may have several of each.

### 2. Prerequisite groups (AND of ORs)
Remove `fragments.parent_id` and the `tier_parent` check. Add:

```sql
create table fragment_prereq_groups (               -- ALL groups must be satisfied
  id uuid pk,
  fragment_id uuid not null references fragments(id) on delete cascade,
  sort_order int not null default 0,
  …ts
);
create table fragment_prereq_members (              -- ANY one member satisfies its group
  group_id uuid not null references fragment_prereq_groups(id) on delete cascade,
  requires_fragment_id uuid not null references fragments(id) on delete restrict,
  sort_order int not null default 0,
  primary key (group_id, requires_fragment_id)
);
```

- **Revealed** ⇔ every group of the fragment has at least one member that the device has **completed**. A fragment with no groups is revealed from the start (visibility rules for `unmarked` and `protected` are unchanged).
- Examples: Frag 5 = groups `{2}`, `{3}`. "Needs 2 and (3 or 4)" = groups `{2}`, `{3, 4}`. Frag 6 in the test table = `{1}`, `{2}`, `{3}`, `{4}`, `{5}`. (`{4}`, `{5}` alone would be equivalent; redundant groups are allowed.)
- **Guards** (trigger on `fragment_prereq_members`, plus `fn_fragment_guard`): the required fragment is in the same Grove; no self-reference; **no cycles** (a recursive check on insert and update).
- **Layout parent** (Journal tree only, not stored): the member with the lowest `sort_order` in the group with the lowest `sort_order`. Other prerequisite links are drawn as secondary connectors.

### 3. Completion
"Heard" now means **completed**: playback of the fragment's current revision reached its natural end. Pausing and resuming is fine, including across sessions. Leaving range, an interruption or the app closing leaves the fragment **started, not completed** until it's finished. Completion is recorded per fragment, so a later revision doesn't undo it. Only completion reveals anything, counts for music `heard` conditions, or anchors crossroads voting and questions. Device table `heard` gains `completed_at timestamptz null`. `max_progress` stays for display only.

### 4. Publish checklist (DATA_MODEL §11)
- `PARENT_UNPUBLISHED` → **`PREREQ_UNPUBLISHED`**: every prerequisite group has at least one member whose fragment is `published` or `retired`, or in the same batch.
- `NO_ROOT` → **`NO_START`**: the Grove has at least one published fragment with no prerequisite groups.
- New **`EMPTY_PREREQ_GROUP`** (error): a group has no members.
- **`RADIUS_OVERLAP`** (warning) skips any pair that can never compete, meaning one fragment **must precede** the other. Define it recursively: B must precede A if A has a group whose **only** member is B, or a group whose only member X has B as a must-precede. That's conservative: it may still warn on some OR routes, and that's acceptable.

### 5. Pack shape (DATA_MODEL §12.1)
Fragments replace `parentId` with `requires: string[][]` (each inner array is one OR group; the outer array is AND; both are ordered by `sort_order`) and add `isEnding: boolean`. Ids may refer to fragments that aren't in the pack (unpublished or unplayable). The device treats those as never completed. Ids reveal nothing about location, so protected fragments may be prerequisites (completing one by QR counts).

### 6. Revocation
If a prerequisite becomes unplayable after a device has completed it, the completion stands (it's device-local, like the Journal). If the device hasn't completed it, routes through that fragment are closed until it returns, and other OR members still work. A published Grove may therefore have unreachable fragments after a revocation. The pack builder doesn't fail. That case gets an audit entry so staff can see it.

## Consequences
- **M2a (now, unmerged):** the story migration, `fn_fragment_guard`, the checklist, the pgTAP tests and the seed change. The migrations aren't merged and no shared database has applied them, so edit them in place rather than adding a migration.
- **M2b:** the zod `GrovePack` uses `requires` and `isEnding`.
- **M4:** `packages/shared` `unlock.ts` implements the group rule. `trigger.ts` keeps tier priority.
- **M6/M8:** completion tracking; Journal layout from the layout parent; silhouettes for fragments with at least one completed prerequisite member.
- **Admin (M3):** the Grove editor edits groups as rows of "needs one of …", and draws the graph rather than a tree.
- Story teams gain non-linear structure. The cost is that authors can create dead ends. `PREREQ_UNPUBLISHED` and the cycle guard catch the structural ones.

## Alternatives considered
- **A single parent plus an extra AND list:** can't express OR.
- **A boolean expression in `jsonb`:** flexible, but hard to validate in SQL, hard to edit in the admin, and hard to test. Groups cover every positive AND/OR combination.
- **Exclusive forks ("hearing A hides B"):** rejected by JoJo. Taking one route never closes another.
