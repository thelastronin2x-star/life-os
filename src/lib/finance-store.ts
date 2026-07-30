"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AccountType = "personal" | "prop" | "savings";
export type GoalColor = "sage" | "sky" | "gold" | "clay" | "rose";
export type TxnType = "expense" | "income" | "transfer";

export interface FinanceAccount {
  id: string;
  name: string;
  type: AccountType;
  currencySymbol: string;
  startingBalance: number;
}

export interface FinanceGoal {
  id: string;
  name: string;
  target: number;
  contributed: number;
  color: GoalColor;
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  color: GoalColor;
  /** Per-account monthly limit for this category. An account with no entry
   *  here has no limit set — it contributes nothing to the "Усі рахунки"
   *  total and its own card shows no progress bar for this category (see
   *  finance-scope.ts's `categoryLimit`), rather than a limit of 0 (which
   *  would look like "already exceeded"). */
  limitsByAccount: Record<string, number>;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  categoryId: string | null;
  accountId: string;
  date: string; // "YYYY-MM-DD"
  /** Unix seconds, when known (bank imports) — lets same-day transactions
   *  sort in true chronological order; date alone can't distinguish them. */
  time?: number;
  title: string;
  recurring?: { frequency: "weekly" | "monthly"; nextDate: string };
  /** Set for bank-imported transactions (e.g. "monobank:<id>") — prevents
   *  duplicate imports when re-syncing the same date range. */
  externalId?: string;
  /** Merchant category code from bank import, if any — kept so a transaction
   *  can be re-categorized later as the MCC/keyword mapping improves. */
  mcc?: number;
  /** For type "transfer" only — the account the money arrived in.
   *  `accountId` is where it left from. A transfer between two of the
   *  user's own accounts is a single record (not a linked pair), so
   *  editing or deleting it can never leave one half orphaned. */
  transferAccountId?: string;
}

function seedAccounts(): FinanceAccount[] {
  return [];
}

function seedGoals(): FinanceGoal[] {
  return [];
}

function seedBudgetCategories(): BudgetCategory[] {
  return [];
}

function seedTransactions(): Transaction[] {
  return [];
}

/** v0 -> v1: `BudgetCategory.limit` (one number for the category) became
 *  `limitsByAccount` (one number per account). The old single limit clearly
 *  meant "the limit for whichever account this category is actually used
 *  on" — so it's assigned to the account with the most historical expense
 *  in that category, and every other account starts with no limit set
 *  (not a limit of 0, which would immediately read as "already exceeded").
 *  Guarded per-category so running this twice (e.g. a migration re-run) is
 *  a no-op rather than re-deriving from an already-migrated shape. */
export function migrateBudgetCategoryLimits(
  categories: (Omit<BudgetCategory, "limitsByAccount"> & { limit?: number; limitsByAccount?: Record<string, number> })[],
  transactions: Transaction[]
): BudgetCategory[] {
  return categories.map((cat) => {
    if (cat.limitsByAccount) return cat as BudgetCategory;

    const { limit, ...rest } = cat;
    if (!limit || limit <= 0) return { ...rest, limitsByAccount: {} };

    const spendByAccount = new Map<string, number>();
    for (const t of transactions) {
      if (t.categoryId === cat.id && t.type === "expense") {
        spendByAccount.set(t.accountId, (spendByAccount.get(t.accountId) ?? 0) + t.amount);
      }
    }

    let bestAccountId: string | null = null;
    let bestAmount = -1;
    for (const [accountId, amount] of spendByAccount) {
      if (amount > bestAmount) {
        bestAmount = amount;
        bestAccountId = accountId;
      }
    }

    return { ...rest, limitsByAccount: bestAccountId ? { [bestAccountId]: limit } : {} };
  });
}

interface FinanceState {
  accounts: FinanceAccount[];
  goals: FinanceGoal[];
  budgetCategories: BudgetCategory[];
  transactions: Transaction[];

  addTransaction: (t: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  removeTransaction: (id: string) => void;

  addGoal: (g: Omit<FinanceGoal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Omit<FinanceGoal, "id">>) => void;
  removeGoal: (id: string) => void;
  contributeToGoal: (id: string, amount: number) => void;

  addBudgetCategory: (c: Omit<BudgetCategory, "id">) => string;
  updateBudgetCategory: (id: string, patch: Partial<Omit<BudgetCategory, "id">>) => void;
  removeBudgetCategory: (id: string) => void;

  addAccount: (a: Omit<FinanceAccount, "id">) => string;
  updateAccount: (id: string, patch: Partial<Omit<FinanceAccount, "id">>) => void;
  removeAccount: (id: string) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      accounts: seedAccounts(),
      goals: seedGoals(),
      budgetCategories: seedBudgetCategories(),
      transactions: seedTransactions(),

      addTransaction: (t) =>
        set((s) => {
          // Belt-and-suspenders: callers (sync, history backfill, webhook
          // poll) already dedup by externalId before calling this, but they
          // read state at the start of an async operation — two of them
          // resolving in an interleaved order could both decide the same
          // bank transaction is new. Guard here too, at the one place that
          // actually commits it.
          if (t.externalId && s.transactions.some((existing) => existing.externalId === t.externalId)) {
            return s;
          }
          return { transactions: [{ ...t, id: crypto.randomUUID() }, ...s.transactions] };
        }),
      updateTransaction: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addGoal: (g) => set((s) => ({ goals: [...s.goals, { ...g, id: crypto.randomUUID() }] })),
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      contributeToGoal: (id, amount) =>
        set((s) => ({
          goals: s.goals.map((g) => (g.id === id ? { ...g, contributed: g.contributed + amount } : g)),
        })),

      addBudgetCategory: (c) => {
        const id = crypto.randomUUID();
        set((s) => ({ budgetCategories: [...s.budgetCategories, { ...c, id }] }));
        return id;
      },
      updateBudgetCategory: (id, patch) =>
        set((s) => ({
          budgetCategories: s.budgetCategories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      removeBudgetCategory: (id) =>
        set((s) => ({ budgetCategories: s.budgetCategories.filter((c) => c.id !== id) })),

      addAccount: (a) => {
        const id = crypto.randomUUID();
        set((s) => ({ accounts: [...s.accounts, { ...a, id }] }));
        return id;
      },
      updateAccount: (id, patch) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAccount: (id) => set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) })),
    }),
    {
      name: "life-os-finance-v2",
      version: 1,
      migrate: (persisted) => {
        const state = persisted as FinanceState;
        return {
          ...state,
          budgetCategories: migrateBudgetCategoryLimits(state.budgetCategories ?? [], state.transactions ?? []),
        };
      },
    }
  )
);

/** Epoch seconds for sorting: uses the real bank timestamp when known,
 *  otherwise midday of the transaction's date so it sorts reasonably among
 *  same-day entries that do have an exact time. */
function transactionTimestamp(t: Transaction): number {
  if (t.time) return t.time;
  return Math.floor(new Date(`${t.date}T12:00:00`).getTime() / 1000);
}

/** Most-recent-first — the correct way to order transactions for display.
 *  Never rely on store array order: new transactions are prepended on add,
 *  but a batch import (bank sync, history backfill) adds its items one at a
 *  time, which reverses that batch's relative order, and "date" alone can't
 *  break ties between same-day transactions either. */
export function sortTransactionsDesc(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => transactionTimestamp(b) - transactionTimestamp(a));
}

/** A transfer moves real money between two of the user's own accounts — it
 *  must still move both balances, just without ever counting as income or
 *  expense anywhere (see getPeriodTotals, and every income/expense sum in
 *  reports/page.tsx and FinanceOverview.tsx, which already filter by exact
 *  type and so exclude "transfer" without needing changes of their own). */
export function getAccountBalance(account: FinanceAccount, transactions: Transaction[]): number {
  const sum = transactions.reduce((acc, t) => {
    if (t.type === "transfer") {
      if (t.accountId === account.id) return acc - t.amount; // left this account
      if (t.transferAccountId === account.id) return acc + t.amount; // arrived in this account
      return acc;
    }
    if (t.accountId !== account.id) return acc;
    return acc + (t.type === "income" ? t.amount : -t.amount);
  }, 0);
  return account.startingBalance + sum;
}

export function getCategorySpent(categoryId: string, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.categoryId === categoryId && t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);
}

export function getPeriodTotals(transactions: Transaction[], sinceDate: string) {
  const income = transactions
    .filter((t) => t.type === "income" && t.date >= sinceDate)
    .reduce((acc, t) => acc + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense" && t.date >= sinceDate)
    .reduce((acc, t) => acc + t.amount, 0);
  return { income, expense };
}
