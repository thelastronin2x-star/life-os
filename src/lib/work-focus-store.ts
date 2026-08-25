"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_DURATION_MS = 25 * 60 * 1000;
export const FOCUS_DEFAULT_MINUTES = DEFAULT_DURATION_MS / 60000;

export type FocusStatus = "idle" | "running" | "paused" | "completed";

interface WorkFocusState {
  status: FocusStatus;
  durationMs: number;
  /** Unix ms the running session ends at, set only while status is
   *  "running" — storing the end timestamp (not a ticking countdown in
   *  component state) means the remaining time survives navigating away
   *  and back, or a page reload, without an interval running while nobody
   *  is looking at the timer. */
  endsAt: number | null;
  /** Remaining time frozen at the moment of pausing — the one piece a
   *  timestamp-based clock can't derive on its own, since a paused session
   *  has no "ends at" to count down to. */
  pausedRemainingMs: number | null;
  completedCount: number;
  start: (durationMs?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  complete: () => void;
}

export const useWorkFocusStore = create<WorkFocusState>()(
  persist(
    (set, get) => ({
      status: "idle",
      durationMs: DEFAULT_DURATION_MS,
      endsAt: null,
      pausedRemainingMs: null,
      completedCount: 0,
      start: (durationMs = DEFAULT_DURATION_MS) =>
        set({ status: "running", durationMs, endsAt: Date.now() + durationMs, pausedRemainingMs: null }),
      pause: () => {
        const { status, endsAt } = get();
        if (status !== "running" || endsAt === null) return;
        set({ status: "paused", pausedRemainingMs: Math.max(0, endsAt - Date.now()), endsAt: null });
      },
      resume: () => {
        const { status, pausedRemainingMs } = get();
        if (status !== "paused" || pausedRemainingMs === null) return;
        set({ status: "running", endsAt: Date.now() + pausedRemainingMs, pausedRemainingMs: null });
      },
      stop: () => set({ status: "idle", endsAt: null, pausedRemainingMs: null }),
      complete: () => set((s) => ({ status: "completed", endsAt: null, pausedRemainingMs: null, completedCount: s.completedCount + 1 })),
    }),
    { name: "life-os-work-focus" }
  )
);
