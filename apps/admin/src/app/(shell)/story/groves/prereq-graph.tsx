"use client";

/**
 * Hand-rolled SVG prereq graph (no new dependency — M3c answer 7).
 * Layers by longest prerequisite path; OR groups as junction nodes;
 * cross-grove members as labelled stubs.
 */
import Link from "next/link";

export type GraphFragment = {
  id: string;
  title: string;
  groveId: string;
  thisGrove: boolean;
};

export type GraphGroup = {
  fragmentId: string;
  members: string[];
};

export function PrereqGraph({
  groveId,
  fragments,
  groups,
}: {
  groveId: string;
  fragments: GraphFragment[];
  groups: GraphGroup[];
}) {
  const byId = new Map(fragments.map((f) => [f.id, f]));
  const local = fragments.filter((f) => f.thisGrove);

  // Longest path depth among local fragments (edges: member → fragment via group)
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  function longest(id: string): number {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const incoming = groups.filter((g) => g.fragmentId === id);
    let max = 0;
    for (const g of incoming) {
      for (const m of g.members) {
        if (byId.get(m)?.thisGrove) {
          max = Math.max(max, longest(m) + 1);
        } else {
          max = Math.max(max, 1);
        }
      }
    }
    visiting.delete(id);
    depth.set(id, max);
    return max;
  }
  for (const f of local) longest(f.id);

  const layers = new Map<number, GraphFragment[]>();
  for (const f of local) {
    const d = depth.get(f.id) ?? 0;
    const list = layers.get(d) ?? [];
    list.push(f);
    layers.set(d, list);
  }
  const maxLayer = Math.max(0, ...layers.keys());
  const colW = 180;
  const rowH = 56;
  const pad = 24;
  const width = (maxLayer + 1) * colW + pad * 2;
  let maxRows = 1;
  for (const list of layers.values()) maxRows = Math.max(maxRows, list.length);
  const height = maxRows * rowH + pad * 2 + 40;

  const positions = new Map<string, { x: number; y: number }>();
  for (const [d, list] of layers) {
    list.forEach((f, i) => {
      positions.set(f.id, {
        x: pad + d * colW + 60,
        y: pad + i * rowH + 20,
      });
    });
  }

  const edges: {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label?: string;
  }[] = [];

  for (const g of groups) {
    const target = positions.get(g.fragmentId);
    if (!target) continue;
    // Junction slightly left of target
    const jx = target.x - 40;
    const jy = target.y;
    edges.push({
      key: `j-${g.fragmentId}-${jx}`,
      x1: jx,
      y1: jy,
      x2: target.x - 50,
      y2: target.y,
    });
    g.members.forEach((m, mi) => {
      const src = positions.get(m);
      if (src) {
        edges.push({
          key: `${m}-${g.fragmentId}-${mi}`,
          x1: src.x + 50,
          y1: src.y,
          x2: jx,
          y2: jy,
        });
      } else {
        const stub = byId.get(m);
        edges.push({
          key: `stub-${m}-${g.fragmentId}-${mi}`,
          x1: jx - 80,
          y1: jy + mi * 14 - 7,
          x2: jx,
          y2: jy,
          label: stub ? `${stub.title} (other grove)` : "other grove",
        });
      }
    });
  }

  return (
    <div
      className="overflow-x-auto rounded-md border border-border bg-muted/20 p-2"
      role="img"
      aria-label="Prerequisite graph"
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {edges.map((e) => (
          <g key={e.key}>
            <line
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke="currentColor"
              strokeOpacity={0.4}
            />
            {e.label ? (
              <text
                x={(e.x1 + e.x2) / 2}
                y={e.y1 - 4}
                fontSize={10}
                fill="currentColor"
                opacity={0.7}
              >
                {e.label}
              </text>
            ) : null}
          </g>
        ))}
        {[...layers.entries()].flatMap(([, list]) =>
          list.map((f) => {
            const p = positions.get(f.id)!;
            return (
              <g key={f.id}>
                <rect
                  x={p.x - 50}
                  y={p.y - 14}
                  width={100}
                  height={28}
                  rx={4}
                  fill="var(--background, #fff)"
                  stroke="currentColor"
                  strokeOpacity={0.35}
                />
                <foreignObject x={p.x - 48} y={p.y - 10} width={96} height={20}>
                  <Link
                    href={`/story/groves/${groveId}?fragment=${f.id}`}
                    className="block truncate text-center text-xs text-primary underline"
                  >
                    {f.title}
                  </Link>
                </foreignObject>
              </g>
            );
          }),
        )}
        {/* OR junctions */}
        {groups.map((g) => {
          const target = positions.get(g.fragmentId);
          if (!target) return null;
          return (
            <circle
              key={`or-${g.fragmentId}-${g.members.join(",")}`}
              cx={target.x - 40}
              cy={target.y}
              r={6}
              fill="currentColor"
              opacity={0.5}
            >
              <title>OR</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
