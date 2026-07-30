"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BybitSyncState {
  lastSyncedAt: string | null;
  /** ISO timestamp — oldest point in history synced so far. Bybit's
   *  closed-pnl endpoint only allows a 7-day range per request, so history
   *  before this point is walked backwards one 7-day window at a time (see
   *  loadOlderHistory in use-bybit.ts) — same pattern as Monobank's
   *  earliestSyncedAt in monobank-store.ts. */
  earliestSyncedAt: string | null;
  /** True once a backfill window returned zero trades — the true start of
   *  this account's history has been reached, no further windows to load. */
  historyExhausted: boolean;
  setLastSynced: (iso: string) => void;
  setEarliestSynced: (iso: string, exhausted?: boolean) => void;
  clear: () => void;
}

export const useBybitSyncStore = create<BybitSyncState>()(
  persist(
    (set) => ({
      lastSyncedAt: null,
      earliestSyncedAt: null,
      historyExhausted: false,
      setLastSynced: (iso) => set({ lastSyncedAt: iso }),
      setEarliestSynced: (iso, exhausted) =>
        set((s) => ({ earliestSyncedAt: iso, historyExhausted: exhausted ?? s.historyExhausted })),
      clear: () => set({ lastSyncedAt: null, earliestSyncedAt: null, historyExhausted: false }),
    }),
    { name: "life-os-bybit-sync" }
  )
);
