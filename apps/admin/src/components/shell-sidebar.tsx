"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@/lib/staff";
import { canManageStaff, canViewAudit } from "@/lib/staff";

type NavItem = { href: string; label: string; show: boolean };

export function ShellSidebar({
  role,
  displayName,
}: {
  role: StaffRole;
  displayName: string;
}) {
  const pathname = usePathname();
  const ops: NavItem[] = [
    { href: "/regions", label: "Regions", show: true },
    { href: "/audit", label: "Audit", show: canViewAudit(role) },
    { href: "/staff", label: "Staff", show: canManageStaff(role) },
  ];

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar px-3 py-6">
      <div className="px-2">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">
          Replaceplace
        </p>
        <p className="mt-1 font-serif text-lg font-semibold text-sidebar-foreground">
          InTell Admin
        </p>
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {displayName} · {role}
        </p>
      </div>
      <nav className="mt-8 space-y-6" aria-label="Ops">
        <div>
          <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ops
          </p>
          <ul className="mt-2 space-y-1">
            {ops
              .filter((i) => i.show)
              .map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "block rounded-md px-2 py-2 text-sm",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/70",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      </nav>
      <form action="/auth/sign-out" method="post" className="mt-auto px-2">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </aside>
  );
}
