"use client";

import { useRef, useState, type PointerEvent } from "react";

export interface TooltipState {
  x: number;
  y: number;
  text: string;
}

/** The tooltip bubble every chart on the app shares — dark pill, positioned
 *  above whatever point/bar triggered it. Pointer events (not separate
 *  mouse/touch handlers) cover hover on desktop and hold-to-see on mobile
 *  in one code path. */
export function ChartTooltipBubble({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md bg-text px-2.5 py-1.5 text-[10.5px] font-bold text-bg"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      {tooltip.text}
    </div>
  );
}

/** For continuous line/area charts: one set of handlers on the chart's
 *  wrapping div. Position along X picks the nearest entry in `values` —
 *  each chart passes its own already-formatted label per data point (e.g.
 *  "78% win rate", "+180$ – +420$"). */
export function useContinuousChartTooltip(values: string[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || values.length === 0 || rect.width === 0) return;
    const x = e.clientX - rect.left;
    const idx = Math.min(values.length - 1, Math.max(0, Math.floor((x / rect.width) * values.length)));
    setTooltip({ x, y: 0, text: values[idx] });
  }

  return {
    containerRef,
    tooltip,
    handlers: { onPointerMove: handleMove, onPointerDown: handleMove, onPointerLeave: () => setTooltip(null) },
  };
}

/** For discrete bar charts: each bar knows its own label already, so the
 *  handlers just need the bar's own position relative to the container. */
export function useDiscreteChartTooltip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function bind(text: string) {
    function show(e: PointerEvent<HTMLElement>) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const targetRect = e.currentTarget.getBoundingClientRect();
      if (!containerRect) return;
      setTooltip({ x: targetRect.left - containerRect.left + targetRect.width / 2, y: targetRect.top - containerRect.top, text });
    }
    return { onPointerMove: show, onPointerDown: show, onPointerLeave: () => setTooltip(null) };
  }

  return { containerRef, tooltip, bind };
}
