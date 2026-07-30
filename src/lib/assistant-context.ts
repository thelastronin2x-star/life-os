"use client";

import { useCalendarStore } from "./calendar-store";
import { useJournalStore } from "./journal-store";
import { useJournalConfigStore } from "./journal-config-store";
import { useFinanceStore, getPeriodTotals } from "./finance-store";
import { computeTradePnL } from "./trade-calculations";
import { formatDateKey } from "./calendar-utils";
import { getHoliday } from "./holidays";
import { periodStartKey } from "./finance-periods";
import { median } from "./stats";
import type { Profile } from "./store";
import type { AssistantTaskType } from "./model-router";

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateKey(d);
}

/** Real trade/journal data for the current profile — reused by the Work
 *  mini-assistant's context and its own insight. */
function buildWorkSummary(profile: Profile): string {
  if (profile !== "trader") {
    return "Профіль IT/Розробник — детальних даних по спринтах ще не підключено, відповідай загально.";
  }

  const { trades } = useJournalStore.getState();
  const { instruments } = useJournalConfigStore.getState();
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));

  const closed = trades
    .map((t) => ({ t, pnl: computeTradePnL(t, instrumentById.get(t.instrumentId)) }))
    .filter((x) => x.pnl.net !== null);
  const wins = closed.filter((x) => (x.pnl.net ?? 0) > 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const net = closed.reduce((sum, x) => sum + (x.pnl.net ?? 0), 0);
  const openCount = trades.filter((t) => t.status === "open").length;

  const recent = trades.slice(0, 5).map((t) => {
    const instrument = instrumentById.get(t.instrumentId);
    const pnl = computeTradePnL(t, instrument);
    const result = t.status === "open" ? "відкрита" : `${(pnl.net ?? 0).toFixed(0)}$`;
    return `${instrument?.symbol ?? "?"} ${t.direction} (${result})`;
  });

  return [
    `Всього угод у журналі: ${trades.length}, відкритих: ${openCount}, win rate по закритих: ${winRate}%, сумарний net P&L: ${net.toFixed(0)}$.`,
    recent.length > 0 ? `Останні угоди: ${recent.join("; ")}.` : "Угод у журналі ще немає.",
  ].join(" ");
}

export function buildWorkContext(profile: Profile): string {
  return `Контекст: вкладка "Робота". ${buildWorkSummary(profile)}`;
}

export function buildCalendarContext(): string {
  const { items } = useCalendarStore.getState();
  const now = new Date();
  const ym = formatDateKey(now).slice(0, 7);

  const monthItems = items.filter((i) => i.date.startsWith(ym));
  const upcoming = monthItems
    .filter((i) => i.date >= formatDateKey(now))
    .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`))
    .slice(0, 10);

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidaysThisMonth: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const h = getHoliday(new Date(year, month, day));
    if (h) holidaysThisMonth.push(`${day}.${month + 1} — ${h.name}`);
  }

  return [
    `Контекст: вкладка "Календар". Сьогодні ${formatDateKey(now)}.`,
    upcoming.length > 0
      ? `Найближчі події/нотатки цього місяця: ${upcoming
          .map((i) => `${i.date}${i.time ? " " + i.time : ""} — ${i.title}`)
          .join("; ")}.`
      : "На цей місяць немає запланованих подій.",
    holidaysThisMonth.length > 0
      ? `Свята цього місяця: ${holidaysThisMonth.join(", ")}.`
      : "Свят цього місяця немає.",
  ].join(" ");
}

/** Categories currently over their (calendar-month) limit — the "significant
 *  change" half of the finance insight trigger. */
function overLimitCategoryIds(): string[] {
  const { transactions, budgetCategories } = useFinanceStore.getState();
  const monthStart = periodStartKey("Місяць");
  return budgetCategories
    .map((c) => ({ c, limit: Object.values(c.limitsByAccount).reduce((sum, v) => sum + v, 0) }))
    .filter(({ limit }) => limit > 0)
    .filter(({ c, limit }) => {
      const spent = transactions
        .filter((t) => t.categoryId === c.id && t.type === "expense" && t.date >= monthStart)
        .reduce((sum, t) => sum + t.amount, 0);
      return spent > limit;
    })
    .map(({ c }) => c.id)
    .sort();
}

/** Whether today contains an expense that's unusually large relative to the
 *  user's own recent spending (3x the median of the last 30 days' expense
 *  amounts) — the other half of the "significant change" trigger. A fixed
 *  currency threshold would mean nothing across very different budgets. */
function hasLargeTransactionToday(): boolean {
  const { transactions } = useFinanceStore.getState();
  const todayKey = formatDateKey(new Date());
  const since = daysAgoKey(30);
  const recentExpenseAmounts = transactions
    .filter((t) => t.type === "expense" && t.date >= since)
    .map((t) => t.amount);
  if (recentExpenseAmounts.length < 3) return false; // too little history to call anything "unusual"
  const typical = median(recentExpenseAmounts);
  if (typical <= 0) return false;
  return transactions.some((t) => t.type === "expense" && t.date === todayKey && t.amount > typical * 3);
}

export function buildFinanceContext(): string {
  const { transactions } = useFinanceStore.getState();
  const monthStart = periodStartKey("Місяць");
  const { income, expense } = getPeriodTotals(transactions, monthStart);
  const overLimit = overLimitCategoryIds();
  const { budgetCategories } = useFinanceStore.getState();
  const overLimitNames = overLimit.map((id) => budgetCategories.find((c) => c.id === id)?.name).filter(Boolean);

  return [
    `Контекст: вкладка "Баланс". З початку місяця: дохід ${income.toFixed(0)}, витрати ${expense.toFixed(0)}.`,
    overLimitNames.length > 0
      ? `Перевищено ліміт у категоріях: ${overLimitNames.join(", ")}.`
      : "Всі категорії в межах ліміту.",
    hasLargeTransactionToday() ? "Сьогодні була помітно велика транзакція порівняно зі звичними витратами." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildReportContext(profile: Profile, periodDays: number): string {
  const since = daysAgoKey(periodDays);
  const { items } = useCalendarStore.getState();
  const periodEvents = items.filter((i) => i.date >= since && i.kind === "event");

  const { transactions } = useFinanceStore.getState();
  const { income, expense } = getPeriodTotals(transactions, since);

  return [
    `Контекст: звіт за період з ${since} по сьогодні.`,
    `Календар: ${periodEvents.length} подій за період.`,
    `Фінанси: дохід ${income.toFixed(0)}, витрати ${expense.toFixed(0)}.`,
    buildWorkSummary(profile),
  ].join(" ");
}

export function computeCalendarSignature(): string {
  const { items } = useCalendarStore.getState();
  const ym = formatDateKey(new Date()).slice(0, 7);
  const count = items.filter((i) => i.date.startsWith(ym)).length;
  return [ym, count].join("|");
}

export function computeWorkSignature(profile: Profile): string {
  if (profile !== "trader") return profile;
  const { trades } = useJournalStore.getState();
  // closedCount catches a trade flipping open -> closed even when that
  // doesn't change trades.length or which trade is first in the array —
  // the one event this signature actually needs to detect.
  const closedCount = trades.filter((t) => t.status === "closed").length;
  return [profile, trades.length, closedCount].join("|");
}

/** No day-key here on purpose — unlike calendar/work, finance shouldn't go
 *  stale just because a new day started. It should only change when a
 *  category newly crosses its limit or an unusually large expense lands. */
export function computeFinanceSignature(): string {
  return [overLimitCategoryIds().join(","), hasLargeTransactionToday()].join("|");
}

export async function callAssistantOnce(
  userPrompt: string,
  context: string,
  taskType: AssistantTaskType
): Promise<string> {
  const res = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: userPrompt }],
      context,
      taskType,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error("assistant_request_failed");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
  }
  return acc.trim();
}
