"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const ITEM_HEIGHT = 40; // px — must match the inline heights below

/** A single vertical wheel: three item-heights tall, one item-height of
 *  padding above and below the real values so the first and last items can
 *  still be scrolled to center. `scrollTop = index * ITEM_HEIGHT` then
 *  always lands `values[index]` dead center — see the padding math this
 *  relies on before changing either. */
export function ScrollPicker({
  values,
  value,
  onChange,
  format,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<number | undefined>(undefined);
  // Distinguishes "value changed because our own scroll settled" (already
  // in place, no need to re-scroll) from "value changed from outside" (a
  // quick-time chip, or the initial mount) — only the latter should move
  // the wheel programmatically.
  const lastCommitted = useRef(value);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || lastCommitted.current === value) return;
    lastCommitted.current = value;
    const index = values.indexOf(value);
    if (index === -1) return;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: "auto" });
  }, [value, values]);

  function commitFromScroll() {
    const el = containerRef.current;
    if (!el) return;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
    const target = index * ITEM_HEIGHT;
    // Only correct if actually off-target — calling scrollTo unconditionally
    // (even to the position we're already at) still fires a scroll event in
    // some browsers, which retriggers this same handler and can chain into a
    // jittery scroll↔settle loop, especially during touch momentum.
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: "smooth" });
    }
    const next = values[index];
    if (next !== lastCommitted.current) {
      lastCommitted.current = next;
      onChange(next);
    }
  }

  function handleScroll() {
    // onScroll fires continuously while scrolling/during momentum — only
    // commit once movement has actually stopped, not on every frame.
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(commitFromScroll, 120);
  }

  function handleItemClick(v: number) {
    const el = containerRef.current;
    if (!el) return;
    const index = values.indexOf(v);
    if (index === -1) return;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: "smooth" });
    lastCommitted.current = v;
    onChange(v);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="no-scrollbar h-[120px] w-16 snap-y snap-mandatory overflow-y-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => handleItemClick(v)}
          className="flex w-full snap-center items-center justify-center font-mono text-[17px] font-bold text-text"
          style={{ height: ITEM_HEIGHT, opacity: v === value ? 1 : 0.35 }}
        >
          {format ? format(v) : String(v).padStart(2, "0")}
        </button>
      ))}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** The "колесо годин:хвилин" block itself — two wheels, a colon between,
 *  framed like a card with a centered selection band. */
export function TimeWheelPicker({
  hour,
  minute,
  onChangeHour,
  onChangeMinute,
  className,
}: {
  hour: number;
  minute: number;
  onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative rounded-input bg-surface", className)}>
      {/* The centered selection band — a translucent bg with hairlines
          top/bottom, sitting behind both wheels so it reads as one shared
          "current row" rather than two independent pickers. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 border-y border-border bg-bg/60"
        style={{ height: ITEM_HEIGHT }}
        aria-hidden
      />
      <div className="relative z-10 flex items-center justify-center gap-1 py-0">
        <ScrollPicker values={HOURS} value={hour} onChange={onChangeHour} />
        <span className="pb-0.5 font-mono text-[17px] font-bold text-text-faint">:</span>
        <ScrollPicker values={MINUTES} value={minute} onChange={onChangeMinute} />
      </div>
    </div>
  );
}
