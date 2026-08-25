"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive, isOverlayRoute } from "./nav-items";
import { cn } from "@/lib/cn";

export function BottomNav() {
  const pathname = usePathname();
  const overlay = isOverlayRoute(pathname);

  return (
    <nav
      className={cn(
        // pb-6 was hand-tuned for the home indicator; with edge-to-edge
        // rendering the real inset is available, so use it and keep pb-6 as
        // the floor for devices that report none.
        "fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-bg/90 px-1.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden",
        overlay && "opacity-35"
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active = !overlay && isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[9.5px] font-medium",
              active ? "text-accent" : "text-text-faint"
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
