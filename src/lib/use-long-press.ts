"use client";

import { useEffect, useRef } from "react";

const DEFAULT_LONG_PRESS_MS = 500;

/** Distinguishes a long-press (holds for `ms`) from a normal tap on the same
 *  element. One shared implementation for the whole "tap does one thing,
 *  long-press does another" pattern used across list rows (category cards,
 *  account cards) — a single hook instance covers a whole list, since hooks
 *  can't be called per-item inside a `.map()`; `start(item)` captures which
 *  row is being pressed at call time instead.
 *
 *  Usage per row:
 *    onPointerDown={() => start(item)}
 *    onPointerUp={cancel}
 *    onPointerLeave={cancel}
 *    onPointerCancel={cancel}
 *    onClick={() => { if (wasLongPress()) return; ...normal tap action... }} */
export function useLongPress<T>(onLongPress: (item: T) => void, ms: number = DEFAULT_LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function start(item: T) {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress(item);
    }, ms);
  }

  /** Call from onClick — returns true (and consumes the flag) if the press
   *  that just ended was already handled as a long-press, so the tap's own
   *  action can be skipped. */
  function wasLongPress(): boolean {
    if (fired.current) {
      fired.current = false;
      return true;
    }
    return false;
  }

  useEffect(() => cancel, []);

  return { start, cancel, wasLongPress };
}
