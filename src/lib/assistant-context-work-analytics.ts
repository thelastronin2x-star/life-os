"use client";

import { useJournalStore, type Trade } from "./journal-store";
import { useJournalConfigStore } from "./journal-config-store";
import {
  closedTradesWithNet,
  computeLateHourCorrelation,
  computePlanCorrelation,
  computePostLossPauseCorrelation,
  findStrongestSession,
  type BinaryCorrelation,
} from "./trade-insights";
import { formatDateKey } from "./calendar-utils";

export type AnalyticsPeriod = "week" | "month" | "quarter";

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { week: 7, month: 30, quarter: 90 };

function sinceDateKey(period: AnalyticsPeriod): string {
  const d = new Date();
  d.setDate(d.getDate() - PERIOD_DAYS[period]);
  return formatDateKey(d);
}

export function tradesInPeriod(trades: Trade[], period: AnalyticsPeriod): Trade[] {
  const since = sinceDateKey(period);
  return trades.filter((t) => t.date >= since);
}

function describeCorrelation(label: string, c: BinaryCorrelation | null): string | null {
  if (!c) return null;
  return `${label}: "${c.aLabel}" win rate ${c.aWinRate}% (${c.aCount} угод) проти "${c.bLabel}" ${c.bWinRate}% (${c.bCount} угод).`;
}

/** Aggregated period metrics for the AI Analytics narrative — never the raw
 *  trade list, same "structured context, not a data dump" rule the prompt
 *  asked for and that every other assistant-context-*.ts file already
 *  follows. All three correlations get handed over (whichever have enough
 *  data); the model picks which one is worth calling out as "the problem"
 *  rather than the client pre-deciding for it. */
export function buildWorkAnalyticsContext(period: AnalyticsPeriod): string {
  const { trades: allTrades } = useJournalStore.getState();
  const { instruments, sessions } = useJournalConfigStore.getState();
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));

  const periodTrades = tradesInPeriod(allTrades, period);
  const closed = closedTradesWithNet(periodTrades, instrumentById);
  const wins = closed.filter((x) => x.net > 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const net = closed.reduce((sum, x) => sum + x.net, 0);

  const strongest = findStrongestSession(periodTrades, instrumentById, sessions);
  const correlations = [
    describeCorrelation("Дотримання плану", computePlanCorrelation(periodTrades, instrumentById)),
    describeCorrelation("Пізні угоди", computeLateHourCorrelation(periodTrades, instrumentById)),
    describeCorrelation("Пауза після збитку", computePostLossPauseCorrelation(periodTrades, instrumentById)),
  ].filter((x): x is string => x !== null);

  const periodLabel = period === "week" ? "тиждень" : period === "month" ? "місяць" : "квартал";

  return [
    `Контекст: AI Аналітика журналу угод, період — останній ${periodLabel} (${closed.length} закритих угод).`,
    `Net P&L за період: ${net.toFixed(0)}$, win rate ${winRate}%.`,
    strongest
      ? `Найсильніша комбінація сесія+день за весь час: ${strongest.sessionName} у ${strongest.weekdayLabel}, середній P&L ${strongest.avgPnl.toFixed(0)}$ (${strongest.count} угод).`
      : "",
    correlations.length > 0
      ? `Виявлені поведінкові кореляції: ${correlations.join(" ")}`
      : "Поки що недостатньо даних для поведінкових кореляцій.",
    "Завдання: назви ОДНУ найсильнішу сторону трейдера (з конкретною цифрою вище), назви ОДНУ помітну проблему (тільки з наведених кореляцій, не вигадуй нову), і оціни приблизну очікувану грошову різницю на місяць, якби цю проблему виправити. 3-4 речення, розмовний тон, українською.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function computeWorkAnalyticsSignature(trades: Trade[], period: AnalyticsPeriod): string {
  const periodTrades = tradesInPeriod(trades, period);
  const closedCount = periodTrades.filter((t) => t.status === "closed").length;
  return [period, periodTrades.length, closedCount].join("|");
}
