"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FINANCE_CATEGORIES, isFinanceCategoryKey, type FinanceCategoryKey } from "./finance-categories";

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

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // "YYYY-MM-DD"
}

/** One snapshot in time — the central entity behind Резервний фонд, Норма
 *  заощаджень and Чистий капітал (see finance-manual-checkin-prompt.md).
 *  Fully manual, no Monobank dependency: `savings`/`monthlyIncome`/
 *  `monthlyExpenses` are typed in by hand once a month; `investmentsTotal`/
 *  `debtsTotal` are captured automatically from the live Investment[]/
 *  Debt[] arrays at save time (see upsertCheckIn) rather than asked again,
 *  since those are already tracked in their own sections. At most one
 *  entry per `month` — resaving the same month updates it in place instead
 *  of appending a second point for the same month on the trend chart. */
export interface MonthlyCheckIn {
  id: string;
  month: string; // "YYYY-MM"
  savings: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  investmentsTotal: number;
  debtsTotal: number;
  /** Also auto-captured at save time, same reasoning as investmentsTotal/
   *  debtsTotal above — not in the prompt's own MonthlyCheckIn type, but
   *  without it there's no way to reconstruct a historical борги-проти-
   *  доходу trend at all (the ratio needs monthly payments at each point
   *  in time, not just the current live Debt[] total). Added rather than
   *  worked around, since it's the same "snapshot what's already tracked
   *  elsewhere" pattern already established for the other two totals. */
  totalMonthlyDebtPayments: number;
}

export interface Debt {
  id: string;
  name: string;
  remainingAmount: number;
  monthlyPayment: number;
}

export interface Investment {
  id: string;
  type: string;
  amount: number;
}

export type InsuranceType = "life" | "health" | "property";

export interface InsurancePolicy {
  type: InsuranceType;
  hasPolicy: boolean;
}

/** Fixed set — insurance policies aren't user-addable/removable like debts
 *  or investments, just three toggles. */
export const INSURANCE_TYPES: InsuranceType[] = ["life", "health", "property"];

function seedInsurancePolicies(): InsurancePolicy[] {
  return INSURANCE_TYPES.map((type) => ({ type, hasPolicy: false }));
}

/** One completed pass through the financial-literacy quiz (see
 *  finance-quiz.ts's FINANCIAL_LITERACY_QUESTIONS) — the 8th dashboard
 *  card, the only one about understanding rather than financial state.
 *  Every attempt is kept (not just the latest), so the card's mini-trend
 *  can show whether comprehension is actually improving over repeat
 *  attempts, not just the most recent score in isolation. */
export interface QuizAttempt {
  id: string;
  date: string; // "YYYY-MM-DD"
  answers: { questionId: string; selectedOptionId: string; correct: boolean }[];
  scorePct: number;
}

/** Most recent attempt first — QuizAttempt.date is a plain "YYYY-MM-DD" key,
 *  so a lexicographic sort is already a chronological one. */
export function latestQuizAttempt(attempts: QuizAttempt[]): QuizAttempt | null {
  if (attempts.length === 0) return null;
  return [...attempts].sort((a, b) => b.date.localeCompare(a.date))[0];
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

function seedGoals(): FinancialGoal[] {
  return [];
}

function seedBudgetCategories(): BudgetCategory[] {
  return [];
}

function seedTransactions(): Transaction[] {
  return [];
}

/** v2 -> v3: goals moved from `{target, contributed, color}` (never
 *  actually displayed anywhere in the app — see finance-manual-data-
 *  prompt.md) to `{targetAmount, currentAmount, targetDate?}`. `color` is
 *  dropped — the new goal card is a plain progress bar, not a colored
 *  ring. A `linkedMonobankJarId` field existed briefly between the manual-
 *  data and manual-checkin prompts but was never actually settable from
 *  any UI (no jar picker was ever built), so there's nothing to migrate
 *  off of it — it just stops being read. */
export function migrateFinancialGoals(
  goals: (Partial<FinancialGoal> & { target?: number; contributed?: number })[]
): FinancialGoal[] {
  return goals.map((g) => ({
    id: g.id ?? crypto.randomUUID(),
    name: g.name ?? "",
    targetAmount: g.targetAmount ?? g.target ?? 0,
    currentAmount: g.currentAmount ?? g.contributed ?? 0,
    ...(g.targetDate ? { targetDate: g.targetDate } : {}),
  }));
}

/** "2026-08" for the current calendar month, in the user's local time —
 *  the natural key for MonthlyCheckIn's `month` field and for finding
 *  "this month's" entry (upsertCheckIn) without a separate lookup index. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Most-recent month first — MonthlyCheckIn.month sorts lexicographically
 *  the same as chronologically ("YYYY-MM"), so a plain string sort works. */
export function latestCheckIn(checkIns: MonthlyCheckIn[]): MonthlyCheckIn | null {
  if (checkIns.length === 0) return null;
  return [...checkIns].sort((a, b) => b.month.localeCompare(a.month))[0];
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

/** v1 -> v2: category identity moved from a free-text name + a pick of 9
 *  SVG icon ids to a fixed key from FINANCE_CATEGORIES (see finance-
 *  categories.ts) — the "Своя категорія" free-naming flow is gone, so every
 *  existing category has to land on *some* fixed key, and its `name` has to
 *  match that key's canonical Ukrainian name (a category's name is no longer
 *  independently editable). Old icon ids map to their closest equivalent;
 *  anything unrecognised (or already a valid key, if this ever re-runs)
 *  falls back to "home" rather than crashing on an unknown category. */
const LEGACY_ICON_TO_CATEGORY: Record<string, FinanceCategoryKey> = {
  utensils: "restaurant",
  car: "car",
  clapperboard: "entertainment",
  smartphone: "subscriptions",
  house: "home",
  "shopping-bag": "clothes",
  pill: "health",
  book: "education",
  transfer: "transfers",
};

export function migrateBudgetCategoryIconIds(categories: BudgetCategory[]): BudgetCategory[] {
  return categories.map((cat) => {
    const key = isFinanceCategoryKey(cat.icon) ? cat.icon : (LEGACY_ICON_TO_CATEGORY[cat.icon] ?? "home");
    return { ...cat, icon: key, name: FINANCE_CATEGORIES[key].name };
  });
}

interface FinanceState {
  accounts: FinanceAccount[];
  goals: FinancialGoal[];
  budgetCategories: BudgetCategory[];
  transactions: Transaction[];
  debts: Debt[];
  investments: Investment[];
  insurancePolicies: InsurancePolicy[];
  checkIns: MonthlyCheckIn[];
  quizAttempts: QuizAttempt[];
  /** Set once the 4-step manual-data flow (Чек-ін/Борги/Інвестиції/
   *  Страхування) has been shown once, whether finished or skipped — so it
   *  auto-opens exactly once on first visit to Фінанси, and only ever
   *  again from Налаштування after that. */
  manualDataOnboarded: boolean;

  addTransaction: (t: Omit<Transaction, "id">) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  removeTransaction: (id: string) => void;

  addGoal: (g: Omit<FinancialGoal, "id">) => void;
  updateGoal: (id: string, patch: Partial<Omit<FinancialGoal, "id">>) => void;
  removeGoal: (id: string) => void;

  addBudgetCategory: (c: Omit<BudgetCategory, "id">) => string;
  updateBudgetCategory: (id: string, patch: Partial<Omit<BudgetCategory, "id">>) => void;
  removeBudgetCategory: (id: string) => void;

  addAccount: (a: Omit<FinanceAccount, "id">) => string;
  updateAccount: (id: string, patch: Partial<Omit<FinanceAccount, "id">>) => void;
  removeAccount: (id: string) => void;

  addDebt: (d: Omit<Debt, "id">) => void;
  updateDebt: (id: string, patch: Partial<Omit<Debt, "id">>) => void;
  removeDebt: (id: string) => void;

  addInvestment: (i: Omit<Investment, "id">) => void;
  updateInvestment: (id: string, patch: Partial<Omit<Investment, "id">>) => void;
  removeInvestment: (id: string) => void;

  setInsurancePolicy: (type: InsuranceType, hasPolicy: boolean) => void;
  /** `investmentsTotal`/`debtsTotal` are NOT parameters — they're captured
   *  from the live investments/debts arrays at save time (see this store's
   *  own doc comment on MonthlyCheckIn), so the caller only ever supplies
   *  the three numbers the person actually typed in. */
  upsertCheckIn: (data: { savings: number; monthlyIncome: number; monthlyExpenses: number }) => void;
  addQuizAttempt: (a: Omit<QuizAttempt, "id">) => void;
  setManualDataOnboarded: (v: boolean) => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      accounts: seedAccounts(),
      goals: seedGoals(),
      budgetCategories: seedBudgetCategories(),
      transactions: seedTransactions(),
      debts: [],
      investments: [],
      insurancePolicies: seedInsurancePolicies(),
      checkIns: [],
      quizAttempts: [],
      manualDataOnboarded: false,

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

      addDebt: (d) => set((s) => ({ debts: [...s.debts, { ...d, id: crypto.randomUUID() }] })),
      updateDebt: (id, patch) =>
        set((s) => ({ debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
      removeDebt: (id) => set((s) => ({ debts: s.debts.filter((d) => d.id !== id) })),

      addInvestment: (i) => set((s) => ({ investments: [...s.investments, { ...i, id: crypto.randomUUID() }] })),
      updateInvestment: (id, patch) =>
        set((s) => ({ investments: s.investments.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      removeInvestment: (id) => set((s) => ({ investments: s.investments.filter((i) => i.id !== id) })),

      setInsurancePolicy: (type, hasPolicy) =>
        set((s) => ({
          insurancePolicies: s.insurancePolicies.map((p) => (p.type === type ? { ...p, hasPolicy } : p)),
        })),
      upsertCheckIn: (data) =>
        set((s) => {
          const month = currentMonthKey();
          const investmentsTotal = s.investments.reduce((sum, i) => sum + i.amount, 0);
          const debtsTotal = s.debts.reduce((sum, d) => sum + d.remainingAmount, 0);
          const totalMonthlyDebtPayments = s.debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
          const existing = s.checkIns.find((c) => c.month === month);
          const entry: MonthlyCheckIn = {
            id: existing?.id ?? crypto.randomUUID(),
            month,
            ...data,
            investmentsTotal,
            debtsTotal,
            totalMonthlyDebtPayments,
          };
          return {
            checkIns: existing ? s.checkIns.map((c) => (c.month === month ? entry : c)) : [...s.checkIns, entry],
          };
        }),
      addQuizAttempt: (a) => set((s) => ({ quizAttempts: [...s.quizAttempts, { ...a, id: crypto.randomUUID() }] })),
      setManualDataOnboarded: (v) => set({ manualDataOnboarded: v }),
    }),
    {
      name: "life-os-finance-v2",
      version: 6,
      migrate: (persisted, version) => {
        const state = persisted as FinanceState;
        let budgetCategories = migrateBudgetCategoryLimits(state.budgetCategories ?? [], state.transactions ?? []);
        if (version < 2) {
          budgetCategories = migrateBudgetCategoryIconIds(budgetCategories);
        }
        let goals = state.goals ?? [];
        if (version < 3) {
          goals = migrateFinancialGoals(goals);
        }
        let checkIns = state.checkIns ?? [];
        if (version < 6) {
          // Old check-ins predate totalMonthlyDebtPayments — 0 (not today's
          // live debt total) is the honest value for a month we never
          // actually captured it in, not a guess dressed up as history.
          checkIns = checkIns.map((c) => ({ ...c, totalMonthlyDebtPayments: (c as Partial<MonthlyCheckIn>).totalMonthlyDebtPayments ?? 0 }));
        }
        return {
          ...state,
          budgetCategories,
          goals,
          debts: state.debts ?? [],
          investments: state.investments ?? [],
          insurancePolicies: state.insurancePolicies?.length ? state.insurancePolicies : seedInsurancePolicies(),
          checkIns,
          quizAttempts: state.quizAttempts ?? [],
          manualDataOnboarded: state.manualDataOnboarded ?? false,
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
