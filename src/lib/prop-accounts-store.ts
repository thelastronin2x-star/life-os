"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { TradingCurrency } from "./personal-trading-accounts-store";

export interface PropAccount {
  id: string;
  firm: string;
  phase: string;
  profitPct: number;
  profitTarget: number;
  drawdownPct: number;
  maxDrawdown: number;
  /** See PersonalTradingAccount.currency — same reasoning, same USD default.
   *  Prop challenges are sized in dollars essentially without exception. */
  currency?: TradingCurrency;
}

function seedAccounts(): PropAccount[] {
  return [];
}

interface PropAccountsState {
  accounts: PropAccount[];
  addAccount: (a: Omit<PropAccount, "id">) => void;
  updateAccount: (id: string, patch: Partial<Omit<PropAccount, "id">>) => void;
  removeAccount: (id: string) => void;
}

export const usePropAccountsStore = create<PropAccountsState>()(
  persist(
    (set) => ({
      accounts: seedAccounts(),
      addAccount: (a) =>
        set((s) => ({ accounts: [...s.accounts, { ...a, id: crypto.randomUUID() }] })),
      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
    }),
    { name: "life-os-prop-accounts-v2" }
  )
);
