"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive, isOverlayRoute } from "./nav-items";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const overlay = isOverlayRoute(pathname);

  return (
    <nav
      className={cn(
        "sticky top-0 hidden h-screen w-56 flex-shrink-0 flex-col gap-1 border-r border-border bg-surface p-4 md:flex",
        overlay && "opacity-35"
      )}
    >
      <div className="mb-4 px-2 font-heading text-lg font-semibold text-text">
        0.0 / Life OS
      </div>
      {NAV_ITEMS.map((item) => {
        const active = !overlay && isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
              active ? "bg-surface-2 text-accent" : "text-text-dim hover:bg-surface-2"
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
