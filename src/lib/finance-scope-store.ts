"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useFinanceStore, type FinanceAccount } from "./finance-store";
import { useAppStore, CURRENCIES, type Currency } from "./store";

interface FinanceScopeState {
  selectedAccountId: string | null; // null === "Усі рахунки"
  setSelectedAccountId: (id: string | null) => void;
  /** Null until the user taps the balance to cycle currencies for the first
   *  time — until then the app's own default currency (settings.currency)
   *  is what every Фінанси/Аналітика amount is shown in. Once set, it's a
   *  display-only override: settings.currency and every stored amount stay
   *  untouched, this only changes what gets rendered. */
  displayCurrency: Currency | null;
  setDisplayCurrency: (c: Currency) => void;
}

/** Shared by Фінанси, Аналітика and Транзакції — switching the active card
 *  (or the display currency) on any one of those screens keeps it that way
 *  on the other two. */
const useFinanceScopeStore = create<FinanceScopeState>()(
  persist(
    (set) => ({
      selectedAccountId: null,
      setSelectedAccountId: (id) => set({ selectedAccountId: id }),
      displayCurrency: null,
      setDisplayCurrency: (c) => set({ displayCurrency: c }),
    }),
    { name: "life-os-finance-scope" }
  )
);

export interface FinanceScope {
  selectedAccountId: string | null;
  selectedAccount: FinanceAccount | null;
  setSelectedAccountId: (id: string | null) => void;
  /** What every amount on Фінанси/Аналітика is currently shown in. */
  displayCurrency: Currency;
  displaySymbol: string;
  /** Advances ₴ → $ → € → ₴. Returns false (and leaves the currency
   *  unchanged) if `rates` isn't available yet — a currency switch that
   *  can't actually convert anything would just leave every foreign amount
   *  blank, which reads as data loss rather than "rates unavailable". */
  cycleDisplayCurrency: (ratesAvailable: boolean) => boolean;
}

/** Resolves the persisted selection against the current account list — if
 *  the selected account was since deleted, this returns null immediately
 *  (rather than a dangling id that every computation would need to guard
 *  against separately) and persists that fallback so a later session
 *  doesn't reopen pointed at a card that no longer exists. */
export function useFinanceScope(): FinanceScope {
  const { selectedAccountId, setSelectedAccountId, displayCurrency, setDisplayCurrency } = useFinanceScopeStore();
  const accounts = useFinanceStore((s) => s.accounts);
  const appCurrency = useAppStore((s) => s.settings.currency);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;
  const danglingSelection = selectedAccountId !== null && selectedAccount === null;

  useEffect(() => {
    if (danglingSelection) setSelectedAccountId(null);
  }, [danglingSelection, setSelectedAccountId]);

  const effectiveCurrency = displayCurrency ?? appCurrency;

  function cycleDisplayCurrency(ratesAvailable: boolean): boolean {
    if (!ratesAvailable) return false;
    const order = CURRENCIES.map((c) => c.id);
    const next = order[(order.indexOf(effectiveCurrency) + 1) % order.length];
    setDisplayCurrency(next);
    return true;
  }

  return {
    selectedAccountId: danglingSelection ? null : selectedAccountId,
    selectedAccount,
    setSelectedAccountId,
    displayCurrency: effectiveCurrency,
    displaySymbol: CURRENCIES.find((c) => c.id === effectiveCurrency)?.symbol ?? "₴",
    cycleDisplayCurrency,
  };
}
