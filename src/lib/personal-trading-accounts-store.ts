"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Trading accounts denominate in their own currency, independent of the
 *  app's display currency.
 *
 *  This is a correctness fix, not a preference: the journal was labelling
 *  P&L with `settings.currency` — the setting that controls whether *personal
 *  finances* are shown in ₴, $ or €. A crypto account settles in USDT and a
 *  prop challenge is sized in dollars, so a trade worth $610 was being printed
 *  as "610 ₴". Nothing converted; only the symbol lied, which is the worst
 *  kind of wrong number because it looks plausible. */
export type TradingCurrency = "USD" | "EUR" | "UAH";

export const TRADING_CURRENCY_SYMBOL: Record<TradingCurrency, string> = {
  USD: "$",
  EUR: "€",
  UAH: "₴",
};

export interface PersonalTradingAccount {
  id: string;
  name: string;
  startingDeposit: number;
  /** Optional for data written before this existed — readers fall back to USD,
   *  which is what every existing account actually was. */
  currency?: TradingCurrency;
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
