"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Learned "this exact merchant name always goes in this category" rules —
 *  built from the user's own manual categorization, not hardcoded per-brand
 *  guessing. This is what makes categorization actually scale across
 *  different consumers with completely different spending habits: nobody
 *  has to hand-list every possible store/service, the app just remembers
 *  what the user already told it once. */
interface MerchantRulesState {
  rules: Record<string, string>; // normalized merchant name -> categoryId
  setRule: (merchantKey: string, categoryId: string) => void;
  getCategoryForMerchant: (merchantKey: string) => string | null;
  clearAll: () => void;
}

export function normalizeMerchantKey(title: string): string {
  return title.trim().toLowerCase();
}

export const useMerchantRulesStore = create<MerchantRulesState>()(
  persist(
    (set, get) => ({
      rules: {},
      setRule: (merchantKey, categoryId) =>
        set((s) => ({ rules: { ...s.rules, [merchantKey]: categoryId } })),
      getCategoryForMerchant: (merchantKey) => get().rules[merchantKey] ?? null,
      clearAll: () => set({ rules: {} }),
    }),
    { name: "life-os-merchant-rules" }
  )
);
