"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_DURATION_MS = 25 * 60 * 1000;
export const FOCUS_DEFAULT_MINUTES = DEFAULT_DURATION_MS / 60000;

interface WorkFocusState {
  /** Unix ms the running session ends at, or null when idle. Storing the end
   *  timestamp (not a countdown ticking in component state) means the
   *  remaining time survives navigating away and back — or a page reload —
   *  without an interval running while nobody's looking at the timer. */
  endsAt: number | null;
  durationMs: number;
  start: (durationMs?: number) => void;
  stop: () => void;
}

export const useWorkFocusStore = create<WorkFocusState>()(
  persist(
    (set) => ({
      endsAt: null,
      durationMs: DEFAULT_DURATION_MS,
      start: (durationMs = DEFAULT_DURATION_MS) => set({ endsAt: Date.now() + durationMs, durationMs }),
      stop: () => set({ endsAt: null }),
    }),
    { name: "life-os-work-focus" }
  )
);
