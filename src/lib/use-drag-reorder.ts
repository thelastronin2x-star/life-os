"use client";

import { useRef, useState, type PointerEvent } from "react";

/** Touch-and-mouse reordering via the Pointer Events API — plain HTML5
 *  `draggable` doesn't fire on touch at all, which every screen in this app
 *  has to support. Pointer capture on the grip handle means its own
 *  pointermove/pointerup keep firing no matter where the finger physically
 *  lands, so the array is reordered live by comparing `clientY` against
 *  each row's current bounding rect — no ghost element, just an immediate
 *  swap the moment the pointer crosses into a neighboring row. */
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const rowRefs = useRef<(HTMLElement | null)[]>([]);
  const draggingIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  function setRowRef(index: number) {
    return (el: HTMLElement | null) => {
      rowRefs.current[index] = el;
    };
  }

  function handlePointerMove(e: PointerEvent) {
    const from = draggingIndexRef.current;
    if (from === null) return;
    const y = e.clientY;
    for (let i = 0; i < rowRefs.current.length; i++) {
      if (i === from) continue;
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        const next = [...items];
        const [moved] = next.splice(from, 1);
        next.splice(i, 0, moved);
        onReorder(next);
        draggingIndexRef.current = i;
        setDraggingIndex(i);
        break;
      }
    }
  }

  function endDrag() {
    draggingIndexRef.current = null;
    setDraggingIndex(null);
  }

  function bindHandle(index: number) {
    return {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        draggingIndexRef.current = index;
        setDraggingIndex(index);
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    };
  }

  return { draggingIndex, bindHandle, setRowRef };
}
