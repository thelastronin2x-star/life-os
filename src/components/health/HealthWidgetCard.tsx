import Link from "next/link";
import { ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

interface HealthWidgetCardProps {
  href: string;
  icon: ReactNode;
  /** One of the fixed --health-* accent vars from globals.css (e.g.
   *  "var(--health-sleep)") — the retro-sticker offset shadow behind the
   *  icon badge. Deliberately not a theme token: these category colors
   *  stay constant across every selected app theme. */
  iconAccent: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Compact dashboard card: tapping anywhere opens the detail screen, except
 *  the interactive controls (`children`) that sit above the link via
 *  `relative z-10` — the same nested-link-plus-button shape as elsewhere in
 *  the app (list rows with a trailing action button).
 *
 *  The content wrapper is `pointer-events-none`, not just `relative z-10`:
 *  without it, the wrapper's own box (which covers nearly the entire card —
 *  header row plus children) intercepts every tap that lands on plain text
 *  or an icon, since a plain non-interactive div still captures pointer
 *  events by default. That left only the ~14px padding strip around the
 *  card's edge actually reaching the Link underneath — the real cause of
 *  "tap doesn't register the first time," not an iOS hover quirk (there's
 *  no `:hover` rule anywhere in this file or its callers). Every actual
 *  button re-enables itself with `pointer-events-auto`. */
export function HealthWidgetCard({ href, icon, iconAccent, title, meta, children, className }: HealthWidgetCardProps) {
  return (
    // No bottom margin here — the bento grid in health/page.tsx spaces
    // cards via its own `gap`, not per-card margins (this card also sits
    // inside a grid-item wrapper div there, not directly as the grid child).
    <div className={cn("card-raised relative h-full rounded-card-sm bg-surface p-3.5", className)}>
      <Link href={href} className="absolute inset-0 z-0" aria-label={title} />
      <div className="relative z-10 pointer-events-none">
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="health-widget-icon flex-shrink-0" style={{ "--icon-accent": iconAccent } as CSSProperties}>
            {icon}
          </div>
          {/* min-w-0 is load-bearing: a flex child's default min-width is its
              content size, not 0, so without it this title never actually
              shrinks below "Самопочуття"'s full width — it just overflows
              past `meta` instead. Never showed up while every card was
              full-width; the half-width bento cells are narrow enough to
              hit it. */}
          <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{title}</div>
          <div className="flex-shrink-0">{meta}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
