"use client";

import { useMemo, useState } from "react";
import { FinanceSubpageHeader } from "@/components/finance/FinanceSubpageHeader";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useFinanceStore, type Transaction } from "@/lib/finance-store";
import { formatDateKey } from "@/lib/calendar-utils";
import { formatCurrency } from "@/lib/currency-format";
import { useNbuRates } from "@/lib/use-nbu-rates";
import { FINANCE_PERIODS, periodStartKey, startOfWeek, type FinancePeriod } from "@/lib/finance-periods";
import { normalizeMerchantForGrouping } from "@/lib/merchant-normalize";
import { detectRecurringTransactions } from "@/lib/recurring-detection";
import { median } from "@/lib/stats";
import { useFinanceScope } from "@/lib/finance-scope-store";
import { computeFinanceScope } from "@/lib/finance-scope";

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MONTH_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];
const DONUT_COLORS = ["clay", "sky", "rose", "gold", "sage"] as const;

const TREND_SUBTITLE: Record<FinancePeriod, string> = {
  Тиждень: "з понеділка",
  Місяць: "з початку місяця",
  Рік: "12 місяців",
};

function formatShortDate(dateKey: string): string {
  const d = new Date(dateKey);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function FinanceReportsPage() {
  const { transactions, budgetCategories, accounts } = useFinanceStore();
  const [period, setPeriod] = useState<FinancePeriod>("Місяць");

  const { rates } = useNbuRates();
  const { selectedAccount, displayCurrency, displaySymbol } = useFinanceScope();

  // Everything on this page is recomputed against the selected card (or "Усі
  // рахунки" when null) through this one scope object, matching Огляд — and
  // the same tap-to-cycle display currency from Огляд, so the two screens
  // never disagree on what currency an amount is shown in.
  const scope = useMemo(
    () => computeFinanceScope(selectedAccount, accounts, transactions, displayCurrency, displaySymbol, rates),
    [selectedAccount, accounts, transactions, displayCurrency, displaySymbol, rates]
  );

  const trend = useMemo(() => {
    const buckets: { label: string; income: number; expense: number }[] = [];

    const sumFor = (txns: Transaction[]) =>
      txns.filter((t) => scope.includesTxn(t)).reduce(
        (acc, t) => {
          const converted = scope.convert(t);
          if (converted === null) return acc;
          // Explicit checks, not an else — a transfer between the user's own
          // accounts is neither income nor expense and must be excluded here.
          if (t.type === "income") acc.income += converted;
          else if (t.type === "expense") acc.expense += converted;
          return acc;
        },
        { income: 0, expense: 0 }
      );

    if (period === "Тиждень") {
      // Daily buckets walking forward from Monday of the current week, not a
      // trailing 7 days — same reasoning as "Місяць" below.
      const now = new Date();
      const weekStart = startOfWeek(now);
      const daysSoFar = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000) + 1;
      for (let i = 0; i < daysSoFar; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const key = formatDateKey(d);
        buckets.push({ label: WEEKDAY_SHORT[(d.getDay() + 6) % 7], ...sumFor(transactions.filter((t) => t.date === key)) });
      }
    } else if (period === "Місяць") {
      // Weekly buckets walking forward from the 1st of the current calendar
      // month, not a trailing 4-week window — so "Місяць" always lines up
      // with the actual month, however far into it we are.
      const now = new Date();
      const monthStart = new Date(now);
      monthStart.setDate(1);
      const daysSoFar = Math.floor((now.getTime() - monthStart.getTime()) / 86_400_000) + 1;
      const numWeeks = Math.ceil(daysSoFar / 7);
      for (let w = 0; w < numWeeks; w++) {
        const start = new Date(monthStart);
        start.setDate(monthStart.getDate() + w * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        if (end > now) end.setTime(now.getTime());
        const startKey = formatDateKey(start);
        const endKey = formatDateKey(end);
        const label = `${String(start.getDate()).padStart(2, "0")}.${String(start.getMonth() + 1).padStart(2, "0")}`;
        buckets.push({ label, ...sumFor(transactions.filter((t) => t.date >= startKey && t.date <= endKey)) });
      }
    } else {
      for (let m = 11; m >= 0; m--) {
        const d = new Date();
        d.setDate(1); // avoid month-end overflow (e.g. Mar 31 - 1mo => wrong month)
        d.setMonth(d.getMonth() - m);
        const y = d.getFullYear();
        const mo = d.getMonth();
        const monthTxns = transactions.filter((t) => {
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === y && tm - 1 === mo;
        });
        buckets.push({ label: MONTH_SHORT[mo], ...sumFor(monthTxns) });
      }
    }

    const max = Math.max(1, ...buckets.flatMap((b) => [b.income, b.expense]));
    return { buckets, max };
  }, [transactions, period, scope]);

  const periodStart = periodStartKey(period);
  const periodTxns = useMemo(() => {
    return transactions.filter((t) => t.date >= periodStart && scope.includesTxn(t));
  }, [transactions, periodStart, scope]);

  // The immediately preceding period, used for the comparison card below —
  // Monobank's own analytics doesn't show this at all, only the current
  // period's totals. For "Місяць" this is a fair month-to-date comparison
  // (same number of days into the previous month), not the whole previous
  // month — otherwise an in-progress month always looks artificially better
  // just because fewer days have elapsed.
  const previousPeriodRange = useMemo(() => {
    const now = new Date();
    if (period === "Тиждень") {
      const weekStart = startOfWeek(now);
      const daysSoFar = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000) + 1;
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + daysSoFar - 1);
      return { start: formatDateKey(prevWeekStart), end: formatDateKey(prevWeekEnd) };
    }
    if (period === "Місяць") {
      const prevMonthStart = new Date(now);
      prevMonthStart.setDate(1);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
      const prevMonthEnd = new Date(prevMonthStart);
      prevMonthEnd.setDate(prevMonthStart.getDate() + now.getDate() - 1);
      return { start: formatDateKey(prevMonthStart), end: formatDateKey(prevMonthEnd) };
    }
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 2);
    const end = new Date(now);
    end.setFullYear(end.getFullYear() - 1);
    end.setDate(end.getDate() - 1);
    return { start: formatDateKey(start), end: formatDateKey(end) };
  }, [period]);

  const comparison = useMemo(() => {
    const prevTxns = transactions.filter(
      (t) => t.date >= previousPeriodRange.start && t.date <= previousPeriodRange.end && scope.includesTxn(t)
    );
    const sumExpense = (txns: Transaction[]) =>
      txns.filter((t) => t.type === "expense").reduce((s, t) => s + (scope.convert(t) ?? 0), 0);
    const currentExpense = sumExpense(periodTxns);
    const previousExpense = sumExpense(prevTxns);
    const pctChange =
      previousExpense > 0 ? Math.round(((currentExpense - previousExpense) / previousExpense) * 100) : null;
    return { currentExpense, previousExpense, pctChange };
  }, [transactions, periodTxns, previousPeriodRange, scope]);

  const topMerchants = useMemo(() => {
    // Grouped by normalized merchant, not the raw title — bank statement
    // descriptions for the same real merchant often differ only by a
    // terminal/store-number suffix ("АТБ №1234" vs "АТБ №5678"), which would
    // otherwise split one real merchant across several rows and push a
    // genuinely bigger merchant out of the top 5.
    const totals = new Map<string, { title: string; total: number }>();
    for (const t of periodTxns) {
      if (t.type !== "expense") continue;
      const key = normalizeMerchantForGrouping(t.title);
      const converted = scope.convert(t) ?? 0;
      const existing = totals.get(key);
      if (existing) existing.total += converted;
      else totals.set(key, { title: t.title, total: converted });
    }
    return Array.from(totals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [periodTxns, scope]);

  const donutData = useMemo(() => {
    const totalsByCategory = budgetCategories
      .map((cat) => ({
        name: cat.name,
        total: periodTxns
          .filter((t) => t.categoryId === cat.id && t.type === "expense")
          .reduce((s, t) => s + (scope.convert(t) ?? 0), 0),
      }))
      .filter((c) => c.total > 0)
      // Biggest spend first — matches how Monobank itself ranks category
      // breakdowns, instead of whatever order categories happened to be created in.
      .sort((a, b) => b.total - a.total);

    const grandTotal = totalsByCategory.reduce((s, c) => s + c.total, 0);

    // Only 5 distinct colors exist — past the top 4, further categories would
    // start reusing colors and two unrelated sectors would look identical.
    // Group anything past the top 4 into a single "Інше" sector instead.
    const top = totalsByCategory.slice(0, 4);
    const restTotal = totalsByCategory.slice(4).reduce((s, c) => s + c.total, 0);
    const entries = top.map((c, i) => ({ name: c.name, total: c.total, color: DONUT_COLORS[i] }));
    if (restTotal > 0) {
      entries.push({ name: "Інше", total: restTotal, color: DONUT_COLORS[4] });
    }

    return entries.map((e) => ({
      name: e.name,
      pct: grandTotal > 0 ? Math.round((e.total / grandTotal) * 100) : 0,
      color: e.color,
    }));
  }, [periodTxns, budgetCategories, scope]);

  // Deeper stats beyond raw totals: savings rate, biggest single purchase,
  // and an end-of-month projection (only meaningful mid-month) — none of
  // this exists in Monobank's own analytics tab.
  const insights = useMemo(() => {
    const expenseTxns = periodTxns.filter((t) => t.type === "expense");
    const income = periodTxns.filter((t) => t.type === "income").reduce((s, t) => s + (scope.convert(t) ?? 0), 0);
    const totalExpense = comparison.currentExpense;
    const savingsRate = income > 0 ? Math.round(((income - totalExpense) / income) * 100) : null;

    let projected: number | null = null;
    let projectedMedian: number | null = null;
    if (period === "Місяць") {
      const now = new Date();
      const periodStartMs = new Date(periodStart).getTime();
      const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStartMs) / 86_400_000) + 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const avgPerDay = totalExpense / daysElapsed;
      projected = avgPerDay * daysInMonth;

      // Median-based projection alongside the average — one big purchase
      // (rent, a flight) drags the average up for the whole rest of the
      // month; a median of daily totals (including zero-spend days, so a
      // single splurge day doesn't just get averaged against other splurge
      // days) is far less sensitive to that single outlier.
      const dailyTotals = new Array(daysElapsed).fill(0);
      for (const t of expenseTxns) {
        const dayIndex = Math.floor((new Date(t.date).getTime() - periodStartMs) / 86_400_000);
        if (dayIndex >= 0 && dayIndex < daysElapsed) {
          dailyTotals[dayIndex] += scope.convert(t) ?? 0;
        }
      }
      projectedMedian = median(dailyTotals) * daysInMonth;
    }

    const biggest = expenseTxns.reduce<{ t: Transaction; amount: number } | null>((best, t) => {
      const amount = scope.convert(t) ?? 0;
      return !best || amount > best.amount ? { t, amount } : best;
    }, null);

    return { savingsRate, projected, projectedMedian, biggest };
  }, [periodTxns, period, periodStart, comparison.currentExpense, scope]);

  // Progress against each category's own budget limit (already tracked on
  // the Огляд tab) for the currently selected period — Аналітика didn't
  // surface this at all before, even though it's more actionable than a
  // generic daily average.
  const categoryLimits = useMemo(() => {
    return budgetCategories
      .map((cat) => ({ cat, limit: scope.categoryLimit(cat) }))
      .filter(({ limit }) => limit > 0)
      .map(({ cat, limit }) => {
        const spent = periodTxns
          .filter((t) => t.categoryId === cat.id && t.type === "expense")
          .reduce((s, t) => s + (scope.convert(t) ?? 0), 0);
        return { cat, spent, limit, pct: Math.round((spent / limit) * 100) };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [periodTxns, budgetCategories, scope]);

  const recurring = useMemo(
    () => detectRecurringTransactions(transactions.filter((t) => scope.includesTxn(t))),
    [transactions, scope]
  );
  const showProjected = period === "Місяць" && insights.projected !== null;

  // Cumulative total balance across ALL accounts, walked forward through the
  // same buckets as the "Дохід vs витрати" trend above — a transfer between
  // the user's own accounts nets to zero at this combined-total level (money
  // leaves one account, arrives in another), so only real income/expense
  // ever move this line, consistent with everything else on this page.
  const balanceHistory = useMemo(() => {
    let runningNet = 0;
    const nets: number[] = [];
    for (const b of trend.buckets) {
      runningNet += b.income - b.expense;
      nets.push(runningNet);
    }
    const balanceAtStart = scope.balance - runningNet;
    const points = nets.map((net, i) => ({ label: trend.buckets[i].label, balance: balanceAtStart + net }));
    const values = [balanceAtStart, ...points.map((p) => p.balance)];
    return { points, min: Math.min(...values), max: Math.max(...values) };
  }, [trend, scope]);

  // How far through the period we are, as a %, to compare against spend
  // pace — 60% of a category's limit spent when only 45% of the month has
  // passed is a genuinely different situation than the same 60% on day 29.
  const periodProgressPct = useMemo(() => {
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - new Date(periodStart).getTime()) / 86_400_000) + 1;
    const totalDays =
      period === "Тиждень" ? 7 : period === "Місяць" ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() : 365;
    return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  }, [period, periodStart]);

  // Per-category monthly spend for the last 6 calendar months — answers
  // "is this category getting worse or not", which the period-scoped donut
  // above can't show on its own.
  const categoryTrends = useMemo(() => {
    const now = new Date();
    return budgetCategories
      .map((cat) => {
        const months: number[] = [];
        for (let m = 5; m >= 0; m--) {
          const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const y = d.getFullYear();
          const mo = d.getMonth();
          const total = transactions
            .filter((t) => {
              if (t.categoryId !== cat.id || t.type !== "expense" || !scope.includesTxn(t)) return false;
              const [ty, tm] = t.date.split("-").map(Number);
              return ty === y && tm - 1 === mo;
            })
            .reduce((s, t) => s + (scope.convert(t) ?? 0), 0);
          months.push(total);
        }
        return { cat, months };
      })
      .filter((c) => c.months.some((v) => v > 0));
  }, [budgetCategories, transactions, scope]);

  // Fixed (recurring — can't easily be turned off) vs variable (discretionary)
  // spend for the period — more practical than the category donut for the
  // actual question "how much of my spending is even negotiable".
  const fixedVsVariable = useMemo(() => {
    const recurringKeys = new Set(recurring.map((r) => r.key));
    let fixed = 0;
    let variable = 0;
    for (const t of periodTxns) {
      if (t.type !== "expense") continue;
      const converted = scope.convert(t) ?? 0;
      if (recurringKeys.has(normalizeMerchantForGrouping(t.title))) fixed += converted;
      else variable += converted;
    }
    const total = fixed + variable;
    return {
      fixed,
      variable,
      fixedPct: total > 0 ? Math.round((fixed / total) * 100) : 0,
      variablePct: total > 0 ? Math.round((variable / total) * 100) : 0,
    };
  }, [periodTxns, recurring, scope]);

  const circumference = 2 * Math.PI * 15.5;
  const donutOffsets = donutData.reduce<{ offsets: number[]; running: number }>(
    (state, d) => {
      const len = (d.pct / 100) * circumference;
      return { offsets: [...state.offsets, state.running], running: state.running + len };
    },
    { offsets: [], running: 0 }
  ).offsets;

  return (
    <div>
      <FinanceSubpageHeader
        title="Аналітика"
        subtitle={selectedAccount ? `${selectedAccount.name} · тренди й розподіл витрат` : "Тренди й розподіл витрат"}
      />

      <div className="mb-3.5 flex gap-1.5">
        {FINANCE_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              period === p ? "border-sage bg-sage text-bg font-semibold" : "border-border bg-surface text-text-dim"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="mb-3.5 text-[11px] text-text-faint">
        {formatShortDate(periodStart)} — {formatShortDate(formatDateKey(new Date()))}
      </div>

      <Card className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-text-faint">Витрати за період</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="font-mono text-[20px] font-bold text-text">{formatCurrency(comparison.currentExpense, scope.symbol)}</div>
          {comparison.pctChange !== null && (
            <div className={`text-[11px] font-semibold ${comparison.pctChange > 0 ? "text-clay" : "text-sage"}`}>
              {comparison.pctChange > 0 ? "↑" : "↓"} {Math.abs(comparison.pctChange)}% проти минулого періоду
            </div>
          )}
        </div>
      </Card>

      <SectionTitle>Інсайти</SectionTitle>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className={`p-2.5 ${showProjected ? "" : "col-span-2"}`}>
          <div className="text-[11px] uppercase tracking-wide text-text-faint">Норма заощаджень</div>
          <div
            className={`mt-0.5 font-mono text-[13px] font-semibold ${
              insights.savingsRate === null ? "text-text-faint" : insights.savingsRate >= 0 ? "text-sage" : "text-clay"
            }`}
          >
            {insights.savingsRate === null ? "—" : `${insights.savingsRate}%`}
          </div>
        </Card>
        {showProjected && (
          <Card className="p-2.5">
            <div className="text-[11px] uppercase tracking-wide text-text-faint">Прогноз до кінця місяця</div>
            {/* Both average- and median-based projections shown together —
                one big purchase (rent, a flight) drags the average-based
                number up for the rest of the month; the median-based one is
                far more resistant to that single outlier, so the gap
                between the two is itself useful information. */}
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-[11px] text-text-faint">за середнім</span>
              <span className="font-mono text-[12.5px] font-semibold text-text">
                {formatCurrency(insights.projected!, scope.symbol)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-text-faint">за медіаною</span>
              <span className="font-mono text-[12.5px] font-semibold text-text">
                {formatCurrency(insights.projectedMedian!, scope.symbol)}
              </span>
            </div>
          </Card>
        )}
        {insights.biggest && (
          <Card className="col-span-2 p-2.5">
            <div className="text-[11px] uppercase tracking-wide text-text-faint">Найбільша транзакція</div>
            <div className="mt-0.5 flex items-baseline justify-between">
              <span className="truncate text-[12px] font-medium text-text">{insights.biggest.t.title}</span>
              <span className="ml-2 flex-shrink-0 font-mono text-[13px] font-semibold text-clay">
                {formatCurrency(insights.biggest.amount, scope.symbol)}
              </span>
            </div>
          </Card>
        )}
      </div>

      <SectionTitle>Ліміти категорій ({period.toLowerCase()})</SectionTitle>
      <Card className="mb-2.5 space-y-0 p-0">
        {categoryLimits.length === 0 ? (
          <div className="py-4 text-center text-[11.5px] text-text-faint">Ще немає категорій з лімітом</div>
        ) : (
          categoryLimits.map(({ cat, spent, limit, pct }) => {
            const aheadOfPace = pct > periodProgressPct;
            return (
              <div key={cat.id} className="border-b border-border p-3 last:border-b-0">
                <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-text">{cat.name}</span>
                  <span className={`font-mono ${pct > 100 ? "text-clay font-semibold" : "text-text-dim"}`}>
                    {formatCurrency(spent, scope.symbol)} / {formatCurrency(limit, scope.symbol)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${pct > 100 ? "bg-clay" : "bg-sage"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className={`mt-1 text-[11px] ${aheadOfPace ? "text-clay" : "text-text-faint"}`}>
                  {aheadOfPace ? "⚠ " : ""}витрачено {pct}% ліміту, минуло {periodProgressPct}% періоду
                </div>
                {pct > 100 && (
                  <div className="mt-0.5 text-[11px] text-clay">
                    Перевищено на {formatCurrency(spent - limit, scope.symbol)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      <SectionTitle>Дохід vs витрати — {TREND_SUBTITLE[period]}</SectionTitle>
      <Card className="mb-3">
        <div className="mb-2 flex gap-3.5 text-[11px] text-text-dim">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm bg-sage" />
            Дохід
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm bg-clay" />
            Витрати
          </div>
        </div>
        <div className="mb-1.5 flex h-20 items-end gap-1.5">
          {trend.buckets.map((b, i) => (
            <div key={i} className="flex h-full flex-1 items-end gap-0.5">
              <div
                className="flex-1 rounded-t-sm bg-sage"
                style={{ height: `${Math.max(2, (b.income / trend.max) * 100)}%` }}
              />
              <div
                className="flex-1 rounded-t-sm bg-clay"
                style={{ height: `${Math.max(2, (b.expense / trend.max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 text-[11px] text-text-faint">
          {trend.buckets.map((b, i) => (
            <span key={i} className="flex-1 text-center">
              {b.label}
            </span>
          ))}
        </div>
      </Card>

      <SectionTitle>Баланс у часі</SectionTitle>
      <Card className="mb-3">
        {balanceHistory.points.length > 1 ? (
          <>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full">
              <polyline
                points={balanceHistory.points
                  .map((p, i) => {
                    const x = (i / (balanceHistory.points.length - 1)) * 100;
                    const range = balanceHistory.max - balanceHistory.min || 1;
                    const y = 39 - ((p.balance - balanceHistory.min) / range) * 38;
                    return `${x},${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="var(--sage)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="mt-1.5 flex justify-between text-[11px] text-text-faint">
              <span>{formatCurrency(balanceHistory.points[0].balance, scope.symbol)}</span>
              <span className="font-semibold text-text">
                {formatCurrency(balanceHistory.points[balanceHistory.points.length - 1].balance, scope.symbol)}
              </span>
            </div>
          </>
        ) : (
          <div className="py-4 text-center text-[11.5px] text-text-faint">Недостатньо даних</div>
        )}
      </Card>

      <SectionTitle>Розподіл витрат ({period.toLowerCase()})</SectionTitle>
      <Card className="mb-2.5">
        {donutData.length === 0 ? (
          <div className="py-4 text-center text-[11.5px] text-text-faint">Немає витрат за цей період</div>
        ) : (
          <div className="flex items-center gap-3.5">
            <svg width="80" height="80" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--surface-2)" strokeWidth={4} />
              {donutData.map((d, i) => {
                const len = (d.pct / 100) * circumference;
                return (
                  <circle
                    key={d.name}
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke={`var(--${d.color})`}
                    strokeWidth={4}
                    strokeDasharray={`${len} ${circumference - len}`}
                    strokeDashoffset={-donutOffsets[i]}
                    transform="rotate(-90 18 18)"
                  />
                );
              })}
            </svg>
            <div className="flex flex-1 flex-col gap-1.5">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-text-dim">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--${d.color})` }} />
                  {d.name}
                  <b className="ml-auto font-mono text-text">{d.pct}%</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <SectionTitle>Топ витрат ({period.toLowerCase()})</SectionTitle>
      <Card className="mb-2.5 space-y-0 p-0">
        {topMerchants.length === 0 ? (
          <div className="py-4 text-center text-[11.5px] text-text-faint">Немає витрат за цей період</div>
        ) : (
          topMerchants.map((m, i) => (
            <div
              key={m.title}
              className="flex items-center justify-between border-b border-border p-3 last:border-b-0"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[11px] text-text-faint">{i + 1}</span>
                <span className="truncate text-[12.5px] font-medium text-text">{m.title}</span>
              </div>
              <span className="font-mono text-[12px] font-semibold text-clay">{formatCurrency(m.total, scope.symbol)}</span>
            </div>
          ))
        )}
      </Card>

      <SectionTitle>Постійні vs змінні витрати ({period.toLowerCase()})</SectionTitle>
      <Card className="mb-2.5">
        {fixedVsVariable.fixed + fixedVsVariable.variable === 0 ? (
          <div className="py-4 text-center text-[11.5px] text-text-faint">Немає витрат за цей період</div>
        ) : (
          <>
            <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-rose" style={{ width: `${fixedVsVariable.fixedPct}%` }} />
              <div className="h-full bg-sky" style={{ width: `${fixedVsVariable.variablePct}%` }} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose" />
              Постійні (не вимкнути) — {fixedVsVariable.fixedPct}% · {formatCurrency(fixedVsVariable.fixed, scope.symbol)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-dim">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky" />
              Змінні (дискреційні) — {fixedVsVariable.variablePct}% · {formatCurrency(fixedVsVariable.variable, scope.symbol)}
            </div>
          </>
        )}
      </Card>

      <SectionTitle>Тренд по категоріях (6 міс)</SectionTitle>
      <Card className="mb-2.5 space-y-0 p-0">
        {categoryTrends.length === 0 ? (
          <div className="py-4 text-center text-[11.5px] text-text-faint">Ще немає даних за 6 місяців</div>
        ) : (
          categoryTrends.map(({ cat, months }) => {
            const maxMonth = Math.max(1, ...months);
            const last = months[months.length - 1];
            const prevAvg = months.slice(0, -1).reduce((s, v) => s + v, 0) / (months.length - 1);
            const trendUp = prevAvg > 0 && last > prevAvg * 1.1;
            const trendDown = prevAvg > 0 && last < prevAvg * 0.9;
            return (
              <div key={cat.id} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
                <span className="w-20 flex-shrink-0 truncate text-[11.5px] font-medium text-text">{cat.name}</span>
                <div className="flex h-6 flex-1 items-end gap-0.5">
                  {months.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-sky"
                      style={{ height: `${Math.max(6, (v / maxMonth) * 100)}%` }}
                    />
                  ))}
                </div>
                <span
                  className={`w-4 flex-shrink-0 text-center text-[13px] ${
                    trendUp ? "text-clay" : trendDown ? "text-sage" : "text-text-faint"
                  }`}
                >
                  {trendUp ? "↑" : trendDown ? "↓" : "→"}
                </span>
              </div>
            );
          })
        )}
      </Card>

      <SectionTitle>Регулярні платежі</SectionTitle>
      {recurring.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
          Немає повторюваних транзакцій
        </div>
      )}
      {recurring.map((r) => (
        <div
          key={r.key}
          className="mb-1.5 flex items-center justify-between rounded-card-sm bg-surface shadow-card p-3"
        >
          <div>
            <div className="text-[12.5px] font-medium text-text">{r.title}</div>
            <div className="mt-0.5 text-[11px] text-text-faint">
              Щомісяця · наступне {formatShortDate(r.nextDateEstimate)} · визначено автоматично
            </div>
          </div>
          <div className={`font-mono text-[12px] font-semibold ${r.type === "income" ? "text-sage" : "text-clay"}`}>
            {r.type === "income" ? "+" : "-"}
            {formatCurrency(r.amount, accounts.find((a) => a.id === r.accountId)?.currencySymbol ?? "₴")}
          </div>
        </div>
      ))}
    </div>
  );
}
