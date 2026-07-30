"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LedgerSyncState {
  /** 0 means "never synced" — a fresh device or a cleared browser pulls the
   *  full server ledger from the start, no special-case needed. */
  cursor: number;
  setCursor: (cursor: number) => void;
}

export const useLedgerSyncStore = create<LedgerSyncState>()(
  persist(
    (set) => ({
      cursor: 0,
      setCursor: (cursor) => set({ cursor }),
    }),
    { name: "life-os-ledger-sync" }
  )
);
