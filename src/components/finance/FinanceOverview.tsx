"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  sortTransactionsDesc,
  useFinanceStore,
  type BudgetCategory,
  type FinanceAccount,
  type FinanceGoal,
} from "@/lib/finance-store";
import { GoalRing } from "./GoalRing";
import { CategoryRing } from "./CategoryRing";
import { TransactionForm } from "./TransactionForm";
import { GoalForm } from "./GoalForm";
import { AccountForm } from "./AccountForm";
import { BudgetCategoryForm } from "./BudgetCategoryForm";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Card } from "@/components/ui/Card";
import { formatTimeOfDay } from "@/lib/calendar-utils";
import type { Transaction } from "@/lib/finance-store";
import { getCategoryIcon } from "@/lib/category-icons";
import { BankIcon, ShoppingBagIcon, BarChartIcon, PlusIcon, HistoryIcon, TransferIcon } from "@/components/icons";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useNbuRates } from "@/lib/use-nbu-rates";
import { formatCurrency, convertCurrency, currencyIdForSymbol } from "@/lib/currency-format";
import { recategorizeUncategorizedTransactions, learnMerchantRule } from "@/lib/recategorize";
import { FINANCE_PERIODS, periodStartKey, type FinancePeriod } from "@/lib/finance-periods";
import { useLongPress } from "@/lib/use-long-press";
import { useFinanceScope } from "@/lib/finance-scope-store";
import { computeFinanceScope } from "@/lib/finance-scope";
import { AccountCarousel } from "./AccountCarousel";

export function FinanceOverview() {
  const router = useRouter();
  const {
    accounts,
    goals,
    budgetCategories,
    transactions,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addGoal,
    updateGoal,
    removeGoal,
    addAccount,
    updateAccount,
    removeAccount,
    addBudgetCategory,
    updateBudgetCategory,
    removeBudgetCategory,
  } = useFinanceStore();

  const [txnFormOpen, setTxnFormOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinanceGoal | null>(null);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [categoryPeriod, setCategoryPeriod] = useState<FinancePeriod>("Місяць");

  const appCurrency = useAppStore((s) => s.settings.currency);
  const appSymbol = CURRENCIES.find((c) => c.id === appCurrency)?.symbol ?? "₴";
  const { rates, status: ratesStatus } = useNbuRates();
  const {
    selectedAccountId,
    selectedAccount,
    setSelectedAccountId,
    displayCurrency,
    displaySymbol,
    cycleDisplayCurrency,
  } = useFinanceScope();

  useEffect(() => {
    recategorizeUncategorizedTransactions();
  }, []);

  // Everything below is recomputed against the selected card (or "Усі
  // рахунки" when null) through this one scope object, rather than each
  // useMemo repeating its own account-matching/currency logic. Amounts land
  // in `displayCurrency` (a tap-to-cycle override, see AccountCarousel),
  // not necessarily the app's own default currency.
  const scope = useMemo(
    () => computeFinanceScope(selectedAccount, accounts, transactions, displayCurrency, displaySymbol, rates),
    [selectedAccount, accounts, transactions, displayCurrency, displaySymbol, rates]
  );

  // Sort by date rather than array/insertion order — backfilling older bank
  // history (or importing out of order) prepends old transactions to the
  // store, which would otherwise make stale entries show up as "recent".
  const recentTxns = useMemo(
    () => sortTransactionsDesc(transactions.filter((t) => scope.includesTxn(t))).slice(0, 2),
    [transactions, scope]
  );

  // The most expensive computation here — a full filter+reduce over every
  // transaction PER category — so it's the one most worth memoizing.
  const categorySpends = useMemo(() => {
    const categoryPeriodStart = periodStartKey(categoryPeriod);
    return budgetCategories
      .map((cat) => {
        const spent = transactions
          .filter((t) => t.categoryId === cat.id && t.type === "expense" && t.date >= categoryPeriodStart && scope.includesTxn(t))
          .reduce((sum, t) => {
            const converted = scope.convert(t);
            return converted === null ? sum : sum + converted;
          }, 0);
        return { cat, spent };
      })
      // Biggest spend first — matches how Monobank itself ranks category
      // breakdowns, instead of category-creation order.
      .sort((a, b) => b.spent - a.spent);
  }, [budgetCategories, transactions, categoryPeriod, scope]);

  function openEditTxn(t: Transaction) {
    setEditingTxn(t);
    setTxnFormOpen(true);
  }
  function closeTxnForm() {
    setTxnFormOpen(false);
    setEditingTxn(null);
  }
  function handleSaveTxn(data: Omit<Transaction, "id">) {
    if (editingTxn) updateTransaction(editingTxn.id, data);
    else addTransaction(data);
    if (data.type === "expense" && data.categoryId) {
      learnMerchantRule(data.title, data.categoryId);
    }
    closeTxnForm();
  }
  function handleDeleteTxn(id: string) {
    removeTransaction(id);
    closeTxnForm();
  }

  function openAddGoal() {
    setEditingGoal(null);
    setGoalFormOpen(true);
  }
  function openEditGoal(g: FinanceGoal) {
    setEditingGoal(g);
    setGoalFormOpen(true);
  }
  function closeGoalForm() {
    setGoalFormOpen(false);
    setEditingGoal(null);
  }
  function handleSaveGoal(data: Omit<FinanceGoal, "id">) {
    if (editingGoal) updateGoal(editingGoal.id, data);
    else addGoal(data);
    closeGoalForm();
  }
  function handleDeleteGoal(id: string) {
    removeGoal(id);
    closeGoalForm();
  }

  function openAddAccount() {
    setEditingAccount(null);
    setAccountFormOpen(true);
  }
  function openEditAccount(a: FinanceAccount) {
    setEditingAccount(a);
    setAccountFormOpen(true);
  }
  function closeAccountForm() {
    setAccountFormOpen(false);
    setEditingAccount(null);
  }
  function handleSaveAccount(data: Omit<FinanceAccount, "id">) {
    if (!editingAccount) {
      addAccount(data);
      closeAccountForm();
      return;
    }

    const oldCurrency = currencyIdForSymbol(editingAccount.currencySymbol);
    const newCurrency = currencyIdForSymbol(data.currencySymbol);

    if (oldCurrency === newCurrency) {
      updateAccount(editingAccount.id, data);
      closeAccountForm();
      return;
    }

    if (!rates) {
      // Can't safely convert without live rates — keep the original currency
      // rather than risk silently reinterpreting the same numbers as a
      // different, much more (or less) valuable currency.
      updateAccount(editingAccount.id, { ...data, currencySymbol: editingAccount.currencySymbol });
      closeAccountForm();
      return;
    }

    updateAccount(editingAccount.id, {
      ...data,
      startingBalance: convertCurrency(data.startingBalance, oldCurrency, newCurrency, rates),
    });
    for (const t of transactions) {
      if (t.accountId === editingAccount.id) {
        updateTransaction(t.id, { amount: convertCurrency(t.amount, oldCurrency, newCurrency, rates) });
      }
    }
    closeAccountForm();
  }
  function handleDeleteAccount(id: string) {
    removeAccount(id);
    closeAccountForm();
  }

  function openAddCategory() {
    setEditingCategory(null);
    setCategoryFormOpen(true);
  }
  function openEditCategory(c: BudgetCategory) {
    setEditingCategory(c);
    setCategoryFormOpen(true);
  }
  function closeCategoryForm() {
    setCategoryFormOpen(false);
    setEditingCategory(null);
  }
  function handleSaveCategory(data: Omit<BudgetCategory, "id">) {
    if (editingCategory) updateBudgetCategory(editingCategory.id, data);
    else addBudgetCategory(data);
    closeCategoryForm();
  }
  function handleDeleteCategory(id: string) {
    removeBudgetCategory(id);
    closeCategoryForm();
  }

  // Long-press-to-edit for category cards — tap does the "primary" action
  // (filter transactions), long-press opens the edit form. Account cards
  // get the same treatment inside AccountCarousel now that the duplicate
  // account list here is gone.
  const categoryLongPress = useLongPress<BudgetCategory>((cat) => openEditCategory(cat));

  // Without a rate, convertCurrency returns null and every sum that swallows
  // null (category spend, income, expense, balance) renders as a confident 0
  // — indistinguishable from "you genuinely spent nothing". Only worth saying
  // when a conversion is actually needed: if every account is already in the
  // display currency, a missing rate changes nothing on screen.
  const needsConversion = accounts.some((a) => currencyIdForSymbol(a.currencySymbol) !== displayCurrency);
  const ratesUnavailable = ratesStatus === "error" && needsConversion;

  return (
    <div>
      {ratesUnavailable && (
        <div className="mb-3 rounded-card-sm border border-clay/40 bg-clay/10 p-2.5 text-[11px] leading-relaxed text-clay">
          Курс НБУ не завантажився, тому суми з рахунків в іншій валюті зараз не враховані — показані числа неповні.
          Повернись на екран за хвилину, застосунок спробує ще раз.
        </div>
      )}
      <div className="mb-3 flex items-center justify-end">
        <Link
          href="/balance/monobank"
          className="flex h-8 w-8 items-center justify-center rounded-btn bg-accent text-bg"
        >
          <BankIcon className="h-4 w-4" />
        </Link>
      </div>

      <AccountCarousel
        accounts={accounts}
        transactions={transactions}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
        onEditAccount={openEditAccount}
        onAddAccount={openAddAccount}
        displayCurrency={displayCurrency}
        displaySymbol={displaySymbol}
        cycleDisplayCurrency={cycleDisplayCurrency}
      />

      <SectionTitle>
        Витрати за категоріями{selectedAccount ? ` · ${selectedAccount.name}` : ""}
      </SectionTitle>
      <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
        {FINANCE_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setCategoryPeriod(p)}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              categoryPeriod === p ? "border-sage bg-sage text-bg font-semibold" : "border-border bg-surface text-text-dim"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      {budgetCategories.length === 0 ? (
        <button
          onClick={openAddCategory}
          className="mb-4 block w-full rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint"
        >
          Ще немає бюджетних категорій — додай першу
        </button>
      ) : (
        <div className="mb-4 flex gap-4 overflow-x-auto pb-1.5">
          {categorySpends.map(({ cat, spent }) => {
            const limit = scope.categoryLimit(cat);
            // Null (not 0) when there's no limit for this scope — a 0%-filled
            // ring reads as "nothing spent", which is wrong when money WAS
            // spent and there's simply nothing to measure it against.
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : null;
            const CatIcon = getCategoryIcon(cat.icon);
            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (categoryLongPress.wasLongPress()) return;
                  // Account scope is shared (finance-scope-store), not URL
                  // state — the transactions page already reads the same
                  // selection, so only the category needs to travel via URL.
                  router.push(`/balance/transactions?category=${cat.id}`);
                }}
                onPointerDown={() => categoryLongPress.start(cat)}
                onPointerUp={categoryLongPress.cancel}
                onPointerLeave={categoryLongPress.cancel}
                onPointerCancel={categoryLongPress.cancel}
                className="flex flex-shrink-0 flex-col items-center gap-1.5"
              >
                <CategoryRing percent={pct} color={cat.color}>
                  <CatIcon className="h-4 w-4 text-text" />
                </CategoryRing>
                <div className="font-mono text-[11px] font-semibold text-text">{formatCurrency(spent, scope.symbol)}</div>
                <div className="text-[11px] text-text-faint">{cat.name}</div>
              </button>
            );
          })}
          <button onClick={openAddCategory} className="flex flex-shrink-0 flex-col items-center gap-1.5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-dashed border-border text-text-faint">
              <PlusIcon className="h-4.5 w-4.5" />
            </div>
            <div className="text-[11px] text-text-faint">Своя</div>
          </button>
        </div>
      )}

      <SectionTitle
        action={
          <button onClick={openAddGoal} className="text-accent">
            + нова
          </button>
        }
      >
        Цілі
      </SectionTitle>
      {goals.length === 0 && (
        <button
          onClick={openAddGoal}
          className="mb-2.5 block w-full rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint"
        >
          Ще немає цілей — постав першу
        </button>
      )}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => openEditGoal(g)}
            className="flex items-center gap-2.5 rounded-card-sm bg-surface shadow-card p-3 text-left"
          >
            <GoalRing percent={(g.contributed / g.target) * 100} color={g.color} />
            <div className="min-w-0">
              <div className="truncate text-[11.5px] font-semibold text-text">{g.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-text-faint">
                {formatCurrency(g.contributed, appSymbol)} / {formatCurrency(g.target, appSymbol)}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2.5">
        <Link
          href="/balance/transactions"
          className="flex flex-1 flex-col items-center gap-1.5 rounded-card-sm bg-surface shadow-card p-3"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-card-sm"
            style={{ background: "color-mix(in srgb, var(--sage) 15%, transparent)" }}
          >
            <HistoryIcon className="h-3.5 w-3.5 text-sage" />
          </div>
          <div className="text-[11px] font-medium text-text-dim">Історія</div>
        </Link>
        <button
          onClick={openAddCategory}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-card-sm bg-surface shadow-card p-3"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-card-sm"
            style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)" }}
          >
            <BarChartIcon className="h-3.5 w-3.5 text-gold" />
          </div>
          <div className="text-[11px] font-medium text-text-dim">Бюджет</div>
        </button>
      </div>

      <SectionTitle
        action={
          <Link href="/balance/transactions" className="text-accent">
            всі →
          </Link>
        }
      >
        Останні транзакції{selectedAccount ? ` · ${selectedAccount.name}` : ""}
      </SectionTitle>
      {recentTxns.length === 0 ? (
        <div className="mb-2.5 rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint">
          Ще немає транзакцій — додай першу
        </div>
      ) : (
        <Card className="mb-2.5 space-y-0 p-0">
          {recentTxns.map((t) => {
            const cat = budgetCategories.find((c) => c.id === t.categoryId);
            const CatIcon =
              t.type === "transfer" ? TransferIcon : cat ? getCategoryIcon(cat.icon) : t.type === "income" ? BankIcon : ShoppingBagIcon;
            const converted = scope.convert(t);
            // Falls back to the transaction's own native currency only when
            // it can't be converted yet (rates not loaded) — same graceful
            // degradation as every other sum on this screen, rather than
            // showing a wrong number under the wrong symbol.
            const txnAmount = converted ?? t.amount;
            const txnSymbol =
              converted !== null ? scope.symbol : accounts.find((a) => a.id === t.accountId)?.currencySymbol ?? appSymbol;
            const transferToName =
              t.type === "transfer" ? accounts.find((a) => a.id === t.transferAccountId)?.name : undefined;
            return (
              <button
                key={t.id}
                onClick={() => openEditTxn(t)}
                className="flex w-full items-center gap-2.5 border-b border-border p-3 text-left last:border-b-0"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-text-dim">
                  <CatIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-text">{t.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-faint">
                    {formatTimeOfDay(t.time) && <span className="font-mono">{formatTimeOfDay(t.time)}</span>}
                    <span>
                      {t.type === "transfer"
                        ? `Переказ${transferToName ? ` → ${transferToName}` : ""}`
                        : t.type === "income"
                          ? "Дохід"
                          : (cat?.name ?? "Некатегоризовано")}
                    </span>
                  </div>
                </div>
                <div
                  className={`font-mono text-[12px] font-semibold ${
                    t.type === "transfer" ? "text-text-dim" : t.type === "income" ? "text-sage" : "text-clay"
                  }`}
                >
                  {t.type === "transfer" ? "→ " : t.type === "income" ? "+" : "-"}
                  {formatCurrency(txnAmount, txnSymbol)}
                </div>
              </button>
            );
          })}
        </Card>
      )}

      <SectionTitle>Аналітика</SectionTitle>
      <Link href="/balance/reports" className="flex items-center gap-2.5 rounded-card-sm bg-surface shadow-card p-3.5">
        <BarChartIcon className="h-6 w-6 flex-shrink-0 text-text-dim" />
        <div>
          <div className="text-[12px] font-semibold text-text">Аналітика за місяць</div>
          <div className="mt-0.5 text-[11px] text-text-faint">Тренди, розподіл по категоріях</div>
        </div>
      </Link>

      {txnFormOpen && (
        <TransactionForm
          categories={budgetCategories}
          accounts={accounts}
          editingTxn={editingTxn}
          onSave={handleSaveTxn}
          onClose={closeTxnForm}
          onDelete={editingTxn ? handleDeleteTxn : undefined}
        />
      )}

      {goalFormOpen && (
        <GoalForm
          editingGoal={editingGoal}
          onSave={handleSaveGoal}
          onClose={closeGoalForm}
          onDelete={editingGoal ? handleDeleteGoal : undefined}
        />
      )}

      {accountFormOpen && (
        <AccountForm
          editingAccount={editingAccount}
          onSave={handleSaveAccount}
          onClose={closeAccountForm}
          onDelete={editingAccount ? handleDeleteAccount : undefined}
        />
      )}

      {categoryFormOpen && (
        <BudgetCategoryForm
          editingCategory={editingCategory}
          accounts={accounts}
          currentAccountId={selectedAccountId}
          onSave={handleSaveCategory}
          onClose={closeCategoryForm}
          onDelete={editingCategory ? handleDeleteCategory : undefined}
        />
      )}
    </div>
  );
}
