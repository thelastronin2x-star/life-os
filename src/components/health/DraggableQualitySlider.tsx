"use client";

import { useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

export interface QualityLevelOption<T extends string> {
  value: T;
  label: string;
}

interface DraggableQualitySliderProps<T extends string> {
  levels: QualityLevelOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** CSS color, e.g. "var(--health-sleep)" — set once per instance via the
   *  --slider-accent custom property rather than baked into the shared CSS,
   *  so the same track/thumb/fill rules in globals.css work for both Сон
   *  and Самопочуття without duplicating them per category. */
  accentColor: string;
  ariaLabel: string;
  /** Dashboard widget variant: no room for all N labels, so it shows only
   *  the current value as one line under the track instead. */
  compact?: boolean;
}

/** Drag-controlled slider where the thumb tracks the finger 1:1 during the
 *  gesture — snapping to one of the `levels` values only happens on
 *  release, not on every pointermove. That distinction is what makes it
 *  feel smooth instead of jumpy: snapping mid-drag means the thumb can only
 *  ever occupy N fixed spots while dragging, never the position under the
 *  finger.
 *
 *  `value` starts null until the user actually rates the day — visually
 *  defaults to the middle position since the track needs *some* resting
 *  spot, but onChange (and any persistence) only fires once, on release.
 *  Generic over `T` (a string union) so both Сон's QualityLevel keys and
 *  Самопочуття's FeelingLevel labels can reuse this one component instead
 *  of duplicating the drag logic. */
export function DraggableQualitySlider<T extends string>({
  levels,
  value,
  onChange,
  accentColor,
  ariaLabel,
  compact,
}: DraggableQualitySliderProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  // The track doesn't move during a drag, so it's measured once on
  // pointerdown rather than re-measured on every move.
  const trackRectRef = useRef<DOMRect | null>(null);
  // Mirrors `rawPct` state so handlePointerUp can read the latest position
  // synchronously (see the comment there for why this can't just be the
  // functional-updater form of setRawPct).
  const rawPctRef = useRef<number | null>(null);
  const middleIndex = Math.floor((levels.length - 1) / 2);
  const index = value !== null ? levels.findIndex((l) => l.value === value) : middleIndex;
  const settledPct = index / (levels.length - 1);

  // Raw, unsnapped 0..1 position while a drag is in progress — null when
  // not dragging, in which case the thumb sits at the last committed value.
  const [rawPct, setRawPct] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  function updateFromClientX(clientX: number) {
    const rect = trackRectRef.current;
    if (!rect) return;
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    rawPctRef.current = pct;
    setRawPct(pct);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // `setPointerCapture` re-targets every later pointermove/pointerup for
    // this pointerId to this element even once the finger leaves its
    // bounds, so onPointerMove/onPointerUp below fire correctly for the
    // whole gesture without needing a `window`-level listener.
    e.currentTarget.setPointerCapture(e.pointerId);
    trackRectRef.current = trackRef.current!.getBoundingClientRect();
    setDragging(true);
    updateFromClientX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  }

  // Reads rawPctRef directly rather than the functional-updater form of
  // setRawPct((current) => { onChange(...); return null }) — that form ran
  // onChange (which for both callers here ends up synchronously mutating a
  // Zustand store, forcing a re-render of the *parent* page) from inside a
  // state-updater function, i.e. while React was still mid-render computing
  // this component's own pending state. Under a fast enough gesture (no
  // measurable gap between the last pointermove and the pointerup) that
  // nested cross-component update landed inside the in-progress render and
  // triggered "Cannot update a component while rendering a different
  // component." Reading the ref and calling onChange as a separate,
  // top-level statement — after the state updates, not inside one — keeps
  // "compute this component's next state" and "notify the outside world"
  // from overlapping.
  function handlePointerUp() {
    const finalPct = rawPctRef.current;
    setDragging(false);
    setRawPct(null);
    rawPctRef.current = null;
    if (finalPct !== null) {
      const snappedIndex = Math.round(finalPct * (levels.length - 1));
      const level = levels[snappedIndex].value;
      if (level !== value) onChange(level);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const prev = levels[Math.max(0, index - 1)].value;
      if (prev !== value) onChange(prev);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = levels[Math.min(levels.length - 1, index + 1)].value;
      if (next !== value) onChange(next);
    }
  }

  const displayPct = dragging && rawPct !== null ? rawPct : settledPct;

  return (
    <div style={{ "--slider-accent": accentColor } as CSSProperties}>
      <div
        ref={trackRef}
        className="quality-slider-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={cn("quality-slider-fill", dragging && "dragging")}
          style={{ transform: `scaleX(${displayPct})` }}
        />
        <div
          className={cn("quality-slider-thumb", dragging && "dragging")}
          style={{ left: `${displayPct * 100}%` }}
          role="slider"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={levels.length - 1}
          aria-valuenow={index}
          aria-valuetext={levels[index].label}
          onKeyDown={handleKeyDown}
        />
      </div>
      {compact ? (
        <div className="quality-slider-value">{levels[index].label}</div>
      ) : (
        <div className="quality-slider-labels">
          {levels.map((level, i) => (
            <span key={level.value} className={cn(i === index && "active")}>
              {level.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
