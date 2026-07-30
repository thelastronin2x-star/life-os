"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocalMigrationState {
  migratedAt: string | null;
  setMigratedAt: (date: string) => void;
}

/** Purely informational — re-running the migration is always safe (see
 *  migrateLocalTransactions's dedup keys), this just lets the settings page
 *  show "done on <date>" instead of always presenting it as a fresh action. */
export const useLocalMigrationStore = create<LocalMigrationState>()(
  persist(
    (set) => ({
      migratedAt: null,
      setMigratedAt: (date) => set({ migratedAt: date }),
    }),
    { name: "life-os-local-migration" }
  )
);
