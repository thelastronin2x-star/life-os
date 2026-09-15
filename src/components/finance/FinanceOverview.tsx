"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useFinanceStore,
  latestCheckIn,
  getPeriodTotals,
  getCategorySpent,
  sortTransactionsDesc,
  type FinancialGoal,
  type Transaction,
  type QuizAttempt,
} from "@/lib/finance-store";
import { useVoiceDraftStore } from "@/lib/voice-draft-store";
import { schemaAttachedToTab, useSchemaStore } from "@/lib/schema-store";
import { useSchemaEntriesStore, type SchemaFieldValue } from "@/lib/schema-entries-store";
import { GoalForm } from "./GoalForm";
import { TransactionForm } from "./TransactionForm";
import { BudgetCategoryForm } from "./BudgetCategoryForm";
import { MonthlyCheckInForm } from "./MonthlyCheckInForm";
import { FinancialQuizModal } from "./FinancialQuizModal";
import { ApplePayCategorizeSheet } from "./ApplePayCategorizeSheet";
import { CategoryIcon } from "@/lib/finance-categories";
import { suggestCategoryForMerchant } from "@/lib/finance-merchant-suggest";
import { computeEmergencyFundMonths } from "@/lib/financial-health";
import { periodStartKey } from "@/lib/finance-periods";
import { formatCurrency } from "@/lib/currency-format";
import { CURRENCIES, useAppStore } from "@/lib/store";
import {
  PlusIcon,
  GearIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ListIcon,
  BankIcon,
  TransferIcon,
  DocumentIcon,
  WalletIcon,
  AlertTriangleIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

interface PendingApplePayTxn {
  id: string;
  amount: number;
  merchant: string;
  date: string;
}

const TOP_CATEGORY_COUNT = 4;
const RECENT_TX_COUNT = 4;

function formatShortDateTime(t: Transaction): string {
  const [y, m, d] = t.date.split("-");
  const day = `${d}.${m}.${y}`;
  if (!t.time) return day;
  const time = new Date(t.time * 1000).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

/** Full replacement of the old "8 financial-health pillars" dashboard (see
 *  git history) — a warm personal expense tracker instead of a judgmental
 *  bank audit, per finance_comfortable_final_2.html. Норма заощаджень/
 *  Диверсифікація активів/Чистий капітал/Тест фінзнань are intentionally
 *  gone from this screen (confirmed with the user) — their data and edit
 *  screens (manual-data, the quiz modal) still exist, just not surfaced
 *  here. The ?action=checkin/?action=quiz deep links stay wired even
 *  without visible entry points, since real push reminders
 *  (sendCheckInReminders/sendQuizReminders) still promise they'll work. */
function FinanceOverviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    goals,
    debts,
    insurancePolicies,
    checkIns,
    manualDataOnboarded,
    budgetCategories,
    transactions,
    accounts,
    addTransaction,
    addBudgetCategory,
    addGoal,
    updateGoal,
    removeGoal,
    upsertCheckIn,
    addQuizAttempt,
  } = useFinanceStore();

  const [txnFormOpen, setTxnFormOpen] = useState(false);
  const [txnInitialType, setTxnInitialType] = useState<Transaction["type"]>("expense");
  const [txnDraft, setTxnDraft] = useState<Partial<Omit<Transaction, "id">> | undefined>(undefined);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [checkInFormOpen, setCheckInFormOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [applePayQueue, setApplePayQueue] = useState<PendingApplePayTxn[]>([]);

  const appCurrency = useAppStore((s) => s.settings.currency);
  const symbol = CURRENCIES.find((c) => c.id === appCurrency)?.symbol ?? "₴";
  const monthLabel = new Date().toLocaleDateString("uk-UA", { month: "long" });

  // Shown once automatically on first visit — see manual-data/page.tsx's own
  // doc comment. `replace`, not `push`.
  useEffect(() => {
    if (!manualDataOnboarded) router.replace("/balance/manual-data");
  }, [manualDataOnboarded, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep-link check on mount/param change
    if (searchParams.get("action") === "checkin") setCheckInFormOpen(true);
  }, [searchParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep-link check on mount/param change
    if (searchParams.get("action") === "quiz") setQuizModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("action") !== "voice") return;
    const draft = useVoiceDraftStore.getState().pendingDraft;
    if (draft && draft.section === "finance") {
      const category = draft.categoryName
        ? budgetCategories.find((c) => c.name.toLowerCase().includes(draft.categoryName!.toLowerCase()))
        : undefined;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep-link check on mount/param change
      setTxnDraft({ type: "expense", title: draft.title, amount: draft.amount ?? 0, categoryId: category?.id ?? null, date: draft.date });
      useVoiceDraftStore.getState().clearPendingDraft();
      setTxnInitialType("expense");
      setTxnFormOpen(true);
    }
    router.replace("/balance");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Apple Pay: push-tap deep link AND a best-effort poll on every normal
  // open (same reasoning as checkAndGenerateAutoReports — the server has no
  // other way to reach a device that missed/dismissed the push).
  useEffect(() => {
    fetch("/api/finance/apple-pay/pending")
      .then((r) => r.json())
      .then((data: { pending: PendingApplePayTxn[] }) => setApplePayQueue(data.pending ?? []))
      .catch(() => undefined);
    if (searchParams.get("action") === "applepay") router.replace("/balance");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthStart = periodStartKey("Місяць");
  const monthTransactions = transactions.filter((t) => t.date >= monthStart);
  const { income, expense } = getPeriodTotals(transactions, monthStart);
  const balance = income - expense;

  const topCategories = budgetCategories
    .map((c) => ({
      category: c,
      spent: getCategorySpent(c.id, monthTransactions),
      count: monthTransactions.filter((t) => t.categoryId === c.id && t.type === "expense").length,
    }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, TOP_CATEGORY_COUNT);

  const recentTransactions = sortTransactionsDesc(transactions).slice(0, RECENT_TX_COUNT);

  const firstGoal = goals[0] ?? null;

  const latest = latestCheckIn(checkIns);
  const emergencyFundMonths = computeEmergencyFundMonths(latest?.savings ?? 0, latest?.monthlyExpenses ?? 0);
  const insuredCount = insurancePolicies.filter((p) => p.hasPolicy).length;

  const needsAttention = transactions.filter((t) => t.source === "apple-pay" && !t.categoryId);

  const currentApplePayItem = applePayQueue[0] ?? null;
  const suggestedCategoryId = currentApplePayItem
    ? suggestCategoryForMerchant(currentApplePayItem.merchant, transactions)
    : null;

  function openQuickTxn(type: Transaction["type"]) {
    setTxnInitialType(type);
    setTxnDraft(undefined);
    setTxnFormOpen(true);
  }

  function handleSaveTxn(data: Omit<Transaction, "id">, customValues?: Record<string, SchemaFieldValue>) {
    addTransaction(data);
    const recordId = useFinanceStore.getState().transactions[0]?.id;
    const attachedSchema = schemaAttachedToTab(useSchemaStore.getState().schemas, "finance");
    if (attachedSchema && recordId && customValues) {
      useSchemaEntriesStore.getState().saveEntry(attachedSchema.id, recordId, customValues);
    }
    setTxnFormOpen(false);
    setTxnDraft(undefined);
  }

  function handleSaveCategory(data: Parameters<typeof addBudgetCategory>[0]) {
    addBudgetCategory(data);
    setCategoryFormOpen(false);
  }

  function openAddGoal() {
    setEditingGoal(null);
    setGoalFormOpen(true);
  }
  function openEditGoal(g: FinancialGoal) {
    setEditingGoal(g);
    setGoalFormOpen(true);
  }
  function closeGoalForm() {
    setGoalFormOpen(false);
    setEditingGoal(null);
  }
  function handleSaveGoal(data: Omit<FinancialGoal, "id">) {
    if (editingGoal) updateGoal(editingGoal.id, data);
    else addGoal(data);
    closeGoalForm();
  }
  function handleDeleteGoal(id: string) {
    removeGoal(id);
    closeGoalForm();
  }

  function closeCheckInForm() {
    setCheckInFormOpen(false);
    if (searchParams.get("action") === "checkin") router.replace("/balance");
  }
  function handleSaveCheckIn(data: { savings: number; monthlyIncome: number; monthlyExpenses: number }) {
    upsertCheckIn(data);
    closeCheckInForm();
  }
  function handleCompleteQuiz(attempt: Omit<QuizAttempt, "id">) {
    addQuizAttempt(attempt);
  }

  async function resolveApplePayItem(item: PendingApplePayTxn, categoryId: string | null) {
    const defaultAccountId = accounts[0]?.id;
    if (defaultAccountId) {
      addTransaction({
        type: "expense",
        amount: item.amount,
        categoryId,
        accountId: defaultAccountId,
        date: item.date,
        title: item.merchant,
        source: "apple-pay",
      });
    }
    setApplePayQueue((q) => q.filter((p) => p.id !== item.id));
    fetch("/api/finance/apple-pay/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingId: item.id }),
    }).catch(() => undefined);
  }

  if (!manualDataOnboarded) return null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-0.5 pt-1">
        <h1 className="text-[19px] font-extrabold tracking-tight text-text">Фінанси</h1>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold capitalize text-text-faint">{monthLabel}</span>
          <Link
            href="/balance/settings"
            aria-label="Налаштування"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-icon border border-border bg-surface text-text-faint"
          >
            <GearIcon className="h-[15px] w-[15px]" />
          </Link>
        </div>
      </div>

      {/* Баланс місяця */}
      <div className="px-0.5 pb-5 pt-3">
        <div className="mb-1.5 text-[12px] font-semibold text-text-faint">Баланс цього місяця</div>
        <div className="font-display text-[44px] font-bold leading-none tracking-tight text-text">
          {balance >= 0 ? "" : "-"}
          {formatCurrency(Math.abs(balance), symbol)}
        </div>
        <div className="mt-3 flex gap-4">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-sage">
            <TrendingUpIcon className="h-3 w-3" />
            {formatCurrency(income, symbol)}
          </div>
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-clay">
            <TrendingDownIcon className="h-3 w-3" />
            {formatCurrency(expense, symbol)}
          </div>
        </div>
      </div>

      {/* Швидкі дії */}
      <div className="mb-5 flex gap-2">
        <button onClick={() => openQuickTxn("expense")} className="card-raised flex flex-1 flex-col items-center gap-1.5 rounded-card-sm bg-surface py-3.5">
          <PlusIcon className="h-[18px] w-[18px] text-text-dim" />
          <span className="text-[11px] font-bold text-text">Витрата</span>
        </button>
        <button onClick={() => openQuickTxn("income")} className="card-raised flex flex-1 flex-col items-center gap-1.5 rounded-card-sm bg-surface py-3.5">
          <TrendingUpIcon className="h-[18px] w-[18px] text-text-dim" />
          <span className="text-[11px] font-bold text-text">Дохід</span>
        </button>
        <button onClick={() => setCategoryFormOpen(true)} className="card-raised flex flex-1 flex-col items-center gap-1.5 rounded-card-sm bg-surface py-3.5">
          <ListIcon className="h-[18px] w-[18px] text-text-dim" />
          <span className="text-[11px] font-bold text-text">Категорія</span>
        </button>
      </div>

      {/* Потребує уваги — тільки якщо є Apple Pay-транзакції без категорії */}
      {needsAttention.length > 0 && (
        <>
          <div className="mb-2.5 mt-6 flex items-center justify-between px-0.5 first:mt-0">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Потребує уваги</span>
          </div>
          <div className="card-raised mb-1 rounded-card bg-surface p-1.5">
            {needsAttention.map((t) => (
              <button
                key={t.id}
                onClick={() => setApplePayQueue((q) => [{ id: t.id, amount: t.amount, merchant: t.title, date: t.date }, ...q])}
                className="flex w-full items-center gap-3 border-b border-border p-3 text-left last:border-b-0"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon bg-clay-soft text-clay">
                  <AlertTriangleIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text">{t.title}</span>
                <span className="flex-shrink-0 font-mono text-[12.5px] text-text">-{formatCurrency(t.amount, symbol)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Де найбільше пішло */}
      <div className="mb-2.5 mt-6 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Де найбільше пішло</span>
        <Link href="/balance/transactions" className="text-[11px] font-bold text-sage">
          Усі →
        </Link>
      </div>
      {topCategories.length === 0 ? (
        <div className="card-raised rounded-card-sm bg-surface py-6 text-center text-[11.5px] text-text-faint">
          Ще немає витрат цього місяця
        </div>
      ) : (
        <div className="card-raised mb-1 rounded-card bg-surface p-1.5">
          {topCategories.map(({ category, spent, count }) => (
            <div key={category.id} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
              <CategoryIcon categoryKey={category.icon} color={category.color} className="h-9 w-9 flex-shrink-0 rounded-icon" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text">{category.name}</div>
                <div className="text-[10.5px] text-text-faint">
                  {count} {count === 1 ? "покупка" : "покупок"}
                </div>
              </div>
              <div className="font-display flex-shrink-0 text-[13px] text-text">{formatCurrency(spent, symbol)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Що було нещодавно */}
      <div className="mb-2.5 mt-6 flex items-center justify-between px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Що було нещодавно</span>
        <Link href="/balance/transactions" className="text-[11px] font-bold text-sage">
          Усі →
        </Link>
      </div>
      {recentTransactions.length === 0 ? (
        <div className="card-raised rounded-card-sm bg-surface py-6 text-center text-[11.5px] text-text-faint">
          Ще немає жодної операції
        </div>
      ) : (
        recentTransactions.map((t) => {
          const category = t.categoryId ? budgetCategories.find((c) => c.id === t.categoryId) : null;
          return (
            <div key={t.id} className="card-raised mb-2 flex items-center gap-3 rounded-card-sm bg-surface p-3.5">
              {category ? (
                <CategoryIcon categoryKey={category.icon} color={category.color} className="h-9 w-9 flex-shrink-0 rounded-icon" />
              ) : (
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon bg-surface-2 text-text-dim">
                  <WalletIcon className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text">{t.title}</div>
                <div className="text-[10.5px] text-text-faint">{formatShortDateTime(t)}</div>
              </div>
              <div className={cn("font-display flex-shrink-0 text-[13px]", t.type === "income" ? "text-sage" : "text-clay")}>
                {t.type === "income" ? "+" : "-"}
                {formatCurrency(t.amount, symbol)}
              </div>
            </div>
          );
        })
      )}

      {/* Відкладаємо потроху */}
      <div className="mb-2.5 mt-6 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Відкладаємо потроху</div>
      {firstGoal ? (
        <button onClick={() => openEditGoal(firstGoal)} className="card-raised mb-4 block w-full rounded-card bg-surface p-4 text-left">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[13.5px] font-bold text-text">{firstGoal.name}</span>
            <span className="font-display text-[14px] text-sage">
              {firstGoal.targetAmount > 0 ? Math.round((firstGoal.currentAmount / firstGoal.targetAmount) * 100) : 0}%
            </span>
          </div>
          <div className="mb-2.5 h-[9px] overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sage to-sage-deep"
              style={{ width: `${Math.min(100, firstGoal.targetAmount > 0 ? (firstGoal.currentAmount / firstGoal.targetAmount) * 100 : 0)}%` }}
            />
          </div>
          <div className="text-[11px] text-text-faint">
            Вже є {formatCurrency(firstGoal.currentAmount, symbol)}, ціль — {formatCurrency(firstGoal.targetAmount, symbol)}
          </div>
        </button>
      ) : (
        <button onClick={openAddGoal} className="well-pressed mb-4 flex w-full items-center justify-center gap-2 rounded-card bg-surface py-3.5 text-[12.5px] font-bold text-sage">
          <PlusIcon className="h-3.5 w-3.5" />
          Додати ціль
        </button>
      )}

      {/* Фінансове здоров'я */}
      <div className="mb-2.5 mt-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-text-faint">Фінансове здоров&apos;я</div>
      <Link href="/balance/manual-data" className="card-raised mb-2 flex items-center gap-3 rounded-card-sm bg-surface p-3.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon bg-surface-2 text-text-dim">
          <BankIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-text">Резервний фонд</div>
          <div className="text-[10.5px] text-text-faint">
            {latest ? `${emergencyFundMonths.toFixed(1)} міс. витрат` : "Скільки протримаєшся без доходу"}
          </div>
        </div>
        <span className="flex-shrink-0 text-[11px] font-bold text-sage">Розрахувати →</span>
      </Link>
      <Link href="/balance/manual-data" className="card-raised mb-2 flex items-center gap-3 rounded-card-sm bg-surface p-3.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon bg-surface-2 text-text-dim">
          <TransferIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-text">Борги й кредити</div>
          <div className="text-[10.5px] text-text-faint">{debts.length > 0 ? `${debts.length} активних` : "Поки не додано жодного"}</div>
        </div>
        <span className="flex-shrink-0 text-[11px] font-bold text-sage">{debts.length > 0 ? "Переглянути →" : "Додати →"}</span>
      </Link>
      <Link href="/balance/manual-data" className="card-raised mb-4 flex items-center gap-3 rounded-card-sm bg-surface p-3.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-icon bg-surface-2 text-text-dim">
          <DocumentIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-text">Страхування</div>
          <div className="text-[10.5px] text-text-faint">{insuredCount > 0 ? `${insuredCount}/3 оформлено` : "Не позначено, що застраховано"}</div>
        </div>
        <span className="flex-shrink-0 text-[11px] font-bold text-sage">{insuredCount > 0 ? "Переглянути →" : "Додати →"}</span>
      </Link>

      {txnFormOpen && (
        <TransactionForm
          categories={budgetCategories}
          accounts={accounts}
          editingTxn={null}
          initialType={txnInitialType}
          draftValues={txnDraft}
          onSave={handleSaveTxn}
          onClose={() => {
            setTxnFormOpen(false);
            setTxnDraft(undefined);
          }}
        />
      )}

      {categoryFormOpen && (
        <BudgetCategoryForm
          editingCategory={null}
          accounts={accounts}
          currentAccountId={null}
          onSave={handleSaveCategory}
          onClose={() => setCategoryFormOpen(false)}
        />
      )}

      {goalFormOpen && (
        <GoalForm editingGoal={editingGoal} onSave={handleSaveGoal} onClose={closeGoalForm} onDelete={editingGoal ? handleDeleteGoal : undefined} />
      )}

      {checkInFormOpen && (
        <MonthlyCheckInForm
          initial={latest ? { savings: latest.savings, monthlyIncome: latest.monthlyIncome, monthlyExpenses: latest.monthlyExpenses } : undefined}
          onSave={handleSaveCheckIn}
          onClose={closeCheckInForm}
        />
      )}

      {quizModalOpen && (
        <FinancialQuizModal
          onComplete={handleCompleteQuiz}
          onClose={() => {
            setQuizModalOpen(false);
            if (searchParams.get("action") === "quiz") router.replace("/balance");
          }}
        />
      )}

      {currentApplePayItem && (
        <ApplePayCategorizeSheet
          amount={currentApplePayItem.amount}
          merchant={currentApplePayItem.merchant}
          categories={budgetCategories}
          suggestedCategoryId={suggestedCategoryId}
          onPick={(categoryId) => resolveApplePayItem(currentApplePayItem, categoryId)}
          onLater={() => resolveApplePayItem(currentApplePayItem, null)}
        />
      )}
    </div>
  );
}

export function FinanceOverview() {
  return (
    <Suspense fallback={null}>
      <FinanceOverviewInner />
    </Suspense>
  );
}
