"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useFinanceStore,
  latestCheckIn,
  latestQuizAttempt,
  INSURANCE_TYPES,
  type FinancialGoal,
  type Transaction,
  type InsuranceType,
  type QuizAttempt,
} from "@/lib/finance-store";
import { GoalForm } from "./GoalForm";
import { TransactionForm } from "./TransactionForm";
import { MonthlyCheckInForm } from "./MonthlyCheckInForm";
import { FinancialQuizModal } from "./FinancialQuizModal";
import { PillarCard, StatusPill } from "./PillarCard";
import { PlusIcon, GearIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/currency-format";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { sparklinePoints } from "@/lib/sparkline";
import { pluralizeUk } from "@/lib/calendar-utils";
import { quizStatus } from "@/lib/finance-quiz";
import { computeFinanceInsights } from "@/lib/finance-pillar-insights";
import { AIInsightCard } from "@/components/ui/AIInsightCard";
import {
  computeEmergencyFundMonths,
  emergencyFundStatus,
  emergencyFundShortfall,
  savingsRateStatus,
  computeDebtToIncome,
  debtStatus,
  debtPayoffMonths,
  investmentStatus,
  investmentRebalanceAmount,
} from "@/lib/financial-health";
import { cn } from "@/lib/cn";

function formatShortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
}

const INSURANCE_LABELS: Record<InsuranceType, string> = {
  life: "Життя",
  health: "Здоров'я",
  property: "Майно",
};

/** Фінанси is 8 independent financial-health indicators, each with its own
 *  good/warn/bad status, no overall score, and no Monobank dependency —
 *  everything reads from MonthlyCheckIn (a hand-entered monthly snapshot)
 *  plus the manually-tracked Debt/Investment/InsurancePolicy/Goal lists.
 *  All 8 (bar the quiz, which opens its own modal instead) collapse to a
 *  one-line header by default so the whole dashboard fits without
 *  scrolling; tapping one expands its detail and advice, closing whichever
 *  else was open. */
function FinanceOverviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    accounts,
    goals,
    debts,
    investments,
    insurancePolicies,
    checkIns,
    quizAttempts,
    manualDataOnboarded,
    budgetCategories,
    addTransaction,
    addGoal,
    updateGoal,
    removeGoal,
    upsertCheckIn,
    addQuizAttempt,
  } = useFinanceStore();

  const [txnFormOpen, setTxnFormOpen] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [checkInFormOpen, setCheckInFormOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const appCurrency = useAppStore((s) => s.settings.currency);
  const symbol = CURRENCIES.find((c) => c.id === appCurrency)?.symbol ?? "₴";

  function toggleCard(id: string) {
    setExpandedCard((cur) => (cur === id ? null : id));
  }

  // Shown once automatically on first visit — see manual-data/page.tsx's own
  // doc comment. `replace`, not `push`: this isn't a page the user should
  // land back on by hitting the browser's back button.
  useEffect(() => {
    if (!manualDataOnboarded) router.replace("/balance/manual-data");
  }, [manualDataOnboarded, router]);

  // Deep link from the monthly push reminder (see /api/push/send-reminders'
  // sendCheckInReminders) — opens the same modal the dashboard's own
  // "Оновити чек-ін" row does, just pre-triggered on arrival.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep-link check on mount/param change, not a render-cascading loop
    if (searchParams.get("action") === "checkin") setCheckInFormOpen(true);
  }, [searchParams]);

  // Deep link from the quarterly quiz push reminder (see send-reminders'
  // sendQuizReminders) — same idea as the check-in deep link above.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time deep-link check on mount/param change, not a render-cascading loop
    if (searchParams.get("action") === "quiz") setQuizModalOpen(true);
  }, [searchParams]);

  const latest = latestCheckIn(checkIns);
  const hasHistory = checkIns.length >= 2;
  // Chronological, capped at the last 12 — every per-pillar mini-trend and
  // the net-worth chart below all walk the same window, so they can never
  // silently disagree about "the last year" meaning different things.
  const sortedCheckIns = [...checkIns].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

  const emergencyFundMonths = computeEmergencyFundMonths(latest?.savings ?? 0, latest?.monthlyExpenses ?? 0);
  const efStatus = emergencyFundStatus(emergencyFundMonths);
  const efTrend = hasHistory
    ? sparklinePoints(
        sortedCheckIns.map((c) => computeEmergencyFundMonths(c.savings, c.monthlyExpenses)),
        52,
        18
      )
    : undefined;
  const efShortfall = emergencyFundShortfall(emergencyFundMonths, latest?.monthlyExpenses ?? 0, latest?.savings ?? 0);

  const savingsRate =
    latest && latest.monthlyIncome > 0 ? (latest.monthlyIncome - latest.monthlyExpenses) / latest.monthlyIncome : 0;
  const srStatus = savingsRateStatus(savingsRate);
  const savingsRingCircumference = 2 * Math.PI * 24;
  const srTrend = hasHistory
    ? sparklinePoints(
        sortedCheckIns.map((c) => (c.monthlyIncome > 0 ? (c.monthlyIncome - c.monthlyExpenses) / c.monthlyIncome : 0)),
        52,
        18
      )
    : undefined;

  const totalMonthlyDebtPayments = debts.reduce((s, d) => s + d.monthlyPayment, 0);
  const debtRatio = computeDebtToIncome(totalMonthlyDebtPayments, latest?.monthlyIncome ?? 0);
  const dStatus = debts.length === 0 ? "good" : debtStatus(debtRatio);
  const debtTrend =
    hasHistory && debts.length > 0
      ? sparklinePoints(
          sortedCheckIns.map((c) => computeDebtToIncome(c.totalMonthlyDebtPayments, c.monthlyIncome)),
          52,
          18
        )
      : undefined;

  const totalInvestments = investments.reduce((s, i) => s + i.amount, 0);
  const investmentPct = totalInvestments + (latest?.savings ?? 0) > 0 ? totalInvestments / (totalInvestments + (latest?.savings ?? 0)) : 0;
  const invStatus = investmentStatus(investments.length > 0, investmentPct);
  const invTrend = hasHistory
    ? sparklinePoints(
        sortedCheckIns.map((c) => (c.investmentsTotal + c.savings > 0 ? c.investmentsTotal / (c.investmentsTotal + c.savings) : 0)),
        52,
        18
      )
    : undefined;
  const rebalanceAmount = investmentRebalanceAmount(totalInvestments, latest?.savings ?? 0);

  const insuredCount = insurancePolicies.filter((p) => p.hasPolicy).length;
  const insuranceStatus = insuredCount === 3 ? "good" : insuredCount >= 1 ? "warn" : "bad";

  // --- Чистий капітал: цілком зі знімків MonthlyCheckIn (savings +
  // investmentsTotal - debtsTotal, кожен зафіксований на момент чек-іну) —
  // ніякого живого перерахунку з поточних Investment[]/Debt[], щоб число й
  // тренд-лінія завжди узгоджувались з тим самим джерелом. */
  const netWorth = latest ? latest.savings + latest.investmentsTotal - latest.debtsTotal : 0;
  const netWorthSeries = sortedCheckIns.map((c) => c.savings + c.investmentsTotal - c.debtsTotal);
  const netWorthChangePct =
    netWorthSeries.length >= 2 && netWorthSeries[0] !== 0
      ? Math.round(((netWorth - netWorthSeries[0]) / Math.abs(netWorthSeries[0])) * 100)
      : null;
  const nwStatus = netWorth >= 0 ? "good" : "bad";

  // --- 8. Фінансові знання — не частина expand/collapse-групи вище: тап
  // одразу відкриває квіз-модалку (той самий інтерактивний патерн, що вже
  // затестований), а не розгортає деталі inline. ---
  const lastQuizAttempt = latestQuizAttempt(quizAttempts);
  const qStatus = quizStatus(lastQuizAttempt);
  const quizTrendPoints =
    quizAttempts.length >= 2 ? sparklinePoints(quizAttempts.slice(-8).map((a) => a.scorePct), 52, 18) : undefined;

  // --- AI-картка: протиріччя між показниками, не часові кореляції — щомісячних
  // точок замало для тих. good/warn/bad-таблиця тут не потрібна: сирі числа
  // достатньо. ---
  const financeInsights = computeFinanceInsights({
    savingsRate,
    emergencyFundMonths,
    investmentPct,
    hasInvestments: investments.length > 0,
    debtToIncome: debtRatio,
  });

  function handleCompleteQuiz(attempt: Omit<QuizAttempt, "id">) {
    addQuizAttempt(attempt);
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
  function handleSaveTxn(data: Omit<Transaction, "id">) {
    addTransaction(data);
    setTxnFormOpen(false);
  }
  function closeCheckInForm() {
    setCheckInFormOpen(false);
    if (searchParams.get("action") === "checkin") router.replace("/balance");
  }
  function handleSaveCheckIn(data: { savings: number; monthlyIncome: number; monthlyExpenses: number }) {
    upsertCheckIn(data);
    closeCheckInForm();
  }

  if (!manualDataOnboarded) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between px-0.5 pt-1">
        <h1 className="text-[19px] font-extrabold tracking-tight text-text">Фінанси</h1>
        <Link
          href="/balance/settings"
          aria-label="Налаштування"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-icon border border-border bg-surface text-text-faint"
        >
          <GearIcon className="h-[15px] w-[15px]" />
        </Link>
      </div>

      <button
        onClick={() => setCheckInFormOpen(true)}
        className="mb-3.5 flex w-full items-center justify-between rounded-card-sm border border-dashed border-border bg-surface px-3.5 py-2.5 text-left"
      >
        <span className="text-[11.5px] text-text-dim">
          {latest ? `Чек-ін: ${formatMonthLabel(latest.month)}` : "Ще не було чек-іну"}
        </span>
        <span className="text-[11px] font-semibold text-sage">оновити →</span>
      </button>

      <AIInsightCard
        insights={financeInsights}
        emptyText="Асистент ще не бачить протиріч між показниками — це добре, або ще замало даних для порівняння."
      />

      {/* 1. Резервний фонд */}
      <PillarCard
        title="Резервний фонд"
        keyMetric={`${emergencyFundMonths.toFixed(1)} місяця`}
        status={efStatus}
        statusLabel={efStatus === "good" ? "Відмінно" : efStatus === "warn" ? "Недостатньо" : "Немає"}
        trendPoints={efTrend}
        trendColor="var(--sage)"
        expanded={expandedCard === "emergency"}
        onToggle={() => toggleCard("emergency")}
      >
        <div className="text-[11px] text-text-faint">{formatCurrency(latest?.savings ?? 0, symbol)} з рекомендованих 3-6 місяців витрат</div>
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-sage" style={{ width: `${Math.min(100, (emergencyFundMonths / 6) * 100)}%` }} />
          <div className="absolute top-0 h-full w-[2px] bg-text/40" style={{ left: "50%" }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[9.5px] text-text-faint">
          <span>0</span>
          <span>Ціль: 3 міс</span>
          <span>6 міс</span>
        </div>
        <div className="advice-box mt-2.5 rounded-input bg-surface-2 p-2.5 text-[11.5px] leading-relaxed text-text-dim">
          {efShortfall === null
            ? "Подушка безпеки в нормі — нічого змінювати не треба."
            : `Щоб досягти 3 місяців, бракує ${formatCurrency(efShortfall.shortfall, symbol)}. При відкладанні ${formatCurrency((latest?.monthlyExpenses ?? 0) * 0.1, symbol)}/міс — це ще ${Math.ceil(efShortfall.monthsToGoal)} міс.`}
        </div>
      </PillarCard>

      {/* 2. Норма заощаджень */}
      <PillarCard
        title="Норма заощаджень"
        keyMetric={`${Math.round(savingsRate * 100)}%`}
        status={srStatus}
        statusLabel={srStatus === "good" ? "Відмінно" : srStatus === "warn" ? "Недостатньо" : "Низько"}
        trendPoints={srTrend}
        trendColor="var(--sage)"
        expanded={expandedCard === "savings"}
        onToggle={() => toggleCard("savings")}
      >
        <div className="flex items-center gap-3.5">
          <svg className="h-[60px] w-[60px] flex-shrink-0" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--bg)" strokeWidth={7} />
            <circle
              cx="30"
              cy="30"
              r="24"
              fill="none"
              stroke="var(--sage)"
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={savingsRingCircumference}
              strokeDashoffset={savingsRingCircumference * (1 - Math.max(0, Math.min(1, savingsRate)))}
              transform="rotate(-90 30 30)"
            />
          </svg>
          <div className="text-[11px] text-text-faint">від доходу цього місяця. Рекомендовано: 20%+</div>
        </div>
        <div className="advice-box mt-2.5 rounded-input bg-surface-2 p-2.5 text-[11.5px] leading-relaxed text-text-dim">
          {srStatus === "good"
            ? "Чудовий результат — тримай темп."
            : srStatus === "warn"
              ? "Ще трохи до рекомендованих 20% — спробуй скоротити одну статтю витрат наступного місяця."
              : "Спробуй скоротити витрати або збільшити дохід, щоб наблизитись до рекомендованих 20%."}
        </div>
      </PillarCard>

      {/* 3. Борги проти доходу */}
      <PillarCard
        title="Співвідношення боргу до доходу"
        keyMetric={debts.length === 0 ? "Боргів немає" : `${Math.round(debtRatio * 100)}%`}
        status={dStatus}
        statusLabel={debts.length === 0 ? "Немає" : dStatus === "good" ? "Здорово" : dStatus === "warn" ? "Помірно" : "Високо"}
        trendPoints={debtTrend}
        trendColor="var(--clay)"
        expanded={expandedCard === "debt"}
        onToggle={() => toggleCard("debt")}
      >
        {debts.length === 0 ? (
          <div className="text-[11.5px] text-text-faint">Боргів немає — нічого відстежувати.</div>
        ) : (
          <>
            <div className="text-[11px] text-text-faint">
              {formatCurrency(totalMonthlyDebtPayments, symbol)} щомісячних платежів із {formatCurrency(latest?.monthlyIncome ?? 0, symbol)} доходу
            </div>
            <div className="relative mt-3 h-2 rounded-full bg-surface-2">
              <div
                className={cn("absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full", dStatus === "bad" ? "bg-clay" : dStatus === "warn" ? "bg-gold" : "bg-sage")}
                style={{ left: `calc(${Math.min(100, debtRatio * 100)}% - 6px)` }}
              />
            </div>
            <div className="mt-3 space-y-1.5">
              {debts.map((d) => {
                const months = debtPayoffMonths(d.remainingAmount, d.monthlyPayment);
                return (
                  <div key={d.id} className="flex items-center justify-between text-[11px] text-text-dim">
                    <span className="truncate">{d.name || "Без назви"}</span>
                    <span className="flex-shrink-0 font-mono">
                      {months === null ? "без активних платежів" : `${months} міс до погашення`}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PillarCard>

      {/* 4. Інвестиції */}
      <PillarCard
        title="Диверсифікація активів"
        keyMetric={investments.length === 0 ? "Немає" : `${Math.round(investmentPct * 100)}%`}
        status={invStatus}
        statusLabel={investments.length === 0 ? "Немає" : investmentPct > 0.2 ? "Добре" : "Мало"}
        trendPoints={invTrend}
        trendColor="var(--accent)"
        expanded={expandedCard === "investments"}
        onToggle={() => toggleCard("investments")}
      >
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-surface-2" style={{ width: `${(1 - investmentPct) * 100}%` }} />
          <div className="h-full bg-accent" style={{ width: `${investmentPct * 100}%` }} />
        </div>
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-surface-2" />
            <span className="flex-1">Готівка/депозити</span>
            <span className="font-mono font-semibold text-text">{Math.round((1 - investmentPct) * 100)}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
            <span className="flex-1">Інвестиції</span>
            <span className="font-mono font-semibold text-text">{Math.round(investmentPct * 100)}%</span>
          </div>
        </div>
        <div className="advice-box mt-2.5 rounded-input bg-surface-2 p-2.5 text-[11.5px] leading-relaxed text-text-dim">
          {rebalanceAmount > 0
            ? `Перевести ще ${formatCurrency(rebalanceAmount, symbol)} із готівки, щоб вийти на 20% портфеля.`
            : "Розподіл уже відповідає рекомендованим 20%+."}
        </div>
      </PillarCard>

      {/* 5. Фінансові цілі */}
      <PillarCard
        title="Фінансові цілі"
        keyMetric={goals.length === 0 ? "Додати першу" : `${goals.length} ${pluralizeUk(goals.length, ["ціль", "цілі", "цілей"])}`}
        status={goals.length === 0 ? "warn" : "good"}
        statusLabel={goals.length === 0 ? "Немає" : "Активні"}
        expanded={expandedCard === "goals"}
        onToggle={() => toggleCard("goals")}
      >
        <div className="space-y-2.5">
          {goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
            return (
              <button
                key={g.id}
                onClick={(e) => {
                  e.stopPropagation();
                  openEditGoal(g);
                }}
                className="block w-full rounded-card-sm border border-border bg-surface p-3 text-left"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="truncate text-[12.5px] font-semibold text-text">{g.name}</span>
                  <span className="flex-shrink-0 font-mono text-[12px] font-bold text-text">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-1.5 text-[10.5px] text-text-faint">
                  {formatCurrency(g.currentAmount, symbol)} з {formatCurrency(g.targetAmount, symbol)}
                  {g.targetDate && ` · орієнтовно ${formatShortDate(g.targetDate)}`}
                </div>
              </button>
            );
          })}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openAddGoal();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-card-sm border-[1.5px] border-dashed border-border py-2.5 text-text-faint"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold">Додати ціль</span>
          </button>
        </div>
      </PillarCard>

      {/* 6. Страхування */}
      <PillarCard
        title="Страхування"
        keyMetric={`${insuredCount}/3 застраховано`}
        status={insuranceStatus}
        statusLabel={insuredCount === 3 ? "Відмінно" : insuredCount >= 1 ? "Частково" : "Немає"}
        expanded={expandedCard === "insurance"}
        onToggle={() => toggleCard("insurance")}
      >
        <div className="space-y-2">
          {INSURANCE_TYPES.map((type) => {
            const policy = insurancePolicies.find((p) => p.type === type);
            const has = policy?.hasPolicy ?? false;
            return (
              <div key={type} className="flex items-center gap-2.5">
                <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", has ? "bg-sage" : "bg-surface-2")} />
                <span className={cn("text-[12.5px] font-medium", has ? "text-text" : "text-text-faint")}>{INSURANCE_LABELS[type]}</span>
              </div>
            );
          })}
          <Link
            href="/balance/manual-data"
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 block text-[11.5px] font-semibold text-sage"
          >
            редагувати →
          </Link>
        </div>
      </PillarCard>

      {/* 7. Чистий капітал у часі */}
      <PillarCard
        title="Чистий капітал у часі"
        keyMetric={formatCurrency(netWorth, symbol)}
        status={nwStatus}
        statusLabel={nwStatus === "good" ? "Позитивний" : "Від'ємний"}
        trendPoints={netWorthSeries.length >= 2 ? sparklinePoints(netWorthSeries, 52, 18) : undefined}
        trendColor="var(--sage)"
        expanded={expandedCard === "networth"}
        onToggle={() => toggleCard("networth")}
      >
        {netWorthSeries.length >= 2 ? (
          <>
            <div className="text-[11px] text-text-faint">
              {netWorthChangePct === null ? "недостатньо даних для порівняння" : `${netWorthChangePct >= 0 ? "+" : ""}${netWorthChangePct}% за період чек-інів`}
            </div>
            <svg className="mt-3 h-[60px] w-full" viewBox="0 0 300 60" preserveAspectRatio="none">
              <polyline
                points={sparklinePoints(netWorthSeries, 300, 60)}
                fill="none"
                stroke="var(--sage)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </>
        ) : (
          <div className="text-[11px] text-text-faint">Зроби ще кілька чек-інів, щоб побачити динаміку</div>
        )}
      </PillarCard>

      {/* 8. Фінансові знання — єдина картка не про фінансовий стан, тож
          завершує список окремо; тап одразу відкриває квіз, а не розгортає
          картку inline. */}
      <button
        onClick={() => setQuizModalOpen(true)}
        className="mb-2.5 block w-full rounded-card border border-border bg-surface p-4 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-text-faint">Фінансові знання</div>
            <div className="font-display mt-0.5 text-[17px] font-bold text-text">
              {lastQuizAttempt ? `${lastQuizAttempt.answers.filter((a) => a.correct).length} з ${lastQuizAttempt.answers.length}` : "Пройти тест"}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            <StatusPill status={qStatus} label={lastQuizAttempt ? `${lastQuizAttempt.scorePct}%` : "Не пройдено"} />
            {quizTrendPoints && (
              <svg className="h-[18px] w-[52px]" viewBox="0 0 52 18">
                <polyline points={quizTrendPoints} fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        </div>
      </button>

      <button
        onClick={() => setTxnFormOpen(true)}
        aria-label="Додати транзакцію"
        className="assistant-fab fixed bottom-[84px] right-4 z-[45] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-text text-bg shadow-lg"
      >
        <PlusIcon className="h-5 w-5" />
      </button>

      {txnFormOpen && (
        <TransactionForm
          categories={budgetCategories}
          accounts={accounts}
          editingTxn={null}
          onSave={handleSaveTxn}
          onClose={() => setTxnFormOpen(false)}
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
