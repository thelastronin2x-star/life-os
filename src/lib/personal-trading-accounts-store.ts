"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PersonalTradingAccount {
  id: string;
  name: string;
  startingDeposit: number;
}

interface PersonalTradingAccountsState {
  accounts: PersonalTradingAccount[];
  addAccount: (a: Omit<PersonalTradingAccount, "id">) => string;
  updateAccount: (id: string, patch: Partial<Omit<PersonalTradingAccount, "id">>) => void;
  removeAccount: (id: string) => void;
}

export const usePersonalTradingAccountsStore = create<PersonalTradingAccountsState>()(
  persist(
    (set) => ({
      accounts: [],
      addAccount: (a) => {
        const id = crypto.randomUUID();
        set((s) => ({ accounts: [...s.accounts, { ...a, id }] }));
        return id;
      },
      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
    }),
    { name: "life-os-personal-trading-accounts" }
  )
);
