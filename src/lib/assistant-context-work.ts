"use client";

import { useJournalStore, type Trade } from "./journal-store";
import { useJournalConfigStore } from "./journal-config-store";
import { computeTradePnL } from "./trade-calculations";
import { computeDisciplineStreak, findStrongestSession, hasConsecutiveLosses } from "./trade-insights";
import type { Profile } from "./store";

/** Work's own context builder, in its own file — see
 *  assistant-context-calendar.ts for why the split matters. */

/** Real trade/journal data for the current profile — reused by the Work
 *  mini-assistant's context and its own insight, and (exported) by
 *  assistant-context-global.ts and assistant-context-report.ts. Beyond the
 *  basic win-rate/P&L summary, this also surfaces the same three signals the
 *  Робота screen itself computes (discipline streak, strongest
 *  session×weekday, a back-to-back-losses warning) so the generated insight
 *  can actually reference them instead of only ever restating raw totals. */
export function buildWorkSummary(profile: Profile): string {
  if (profile !== "trader") {
    return "Профіль IT/Розробник — детальних даних по спринтах ще не підключено, відповідай загально.";
  }

  const { trades } = useJournalStore.getState();
  const { instruments, sessions } = useJournalConfigStore.getState();
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

  const streak = computeDisciplineStreak(trades);
  const strongest = findStrongestSession(trades, instrumentById, sessions);
  const pauseWarning = hasConsecutiveLosses(trades, instrumentById, 2);

  return [
    `Всього угод у журналі: ${trades.length}, відкритих: ${openCount}, win rate по закритих: ${winRate}%, сумарний net P&L: ${net.toFixed(0)}$.`,
    recent.length > 0 ? `Останні угоди: ${recent.join("; ")}.` : "Угод у журналі ще немає.",
    streak > 0 ? `Стрік дисципліни: ${streak} день(днів) поспіль за планом.` : "Стріку дисципліни зараз немає.",
    strongest
      ? `Найсильніша комбінація сесія+день: ${strongest.sessionName} у ${strongest.weekdayLabel}, середній P&L ${strongest.avgPnl.toFixed(0)}$ (${strongest.count} угод).`
      : "",
    pauseWarning
      ? "УВАГА: останні 2+ угоди поспіль збиткові — це привід порадити зробити паузу, а не хвалити результати."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildWorkContext(profile: Profile): string {
  return `Контекст: вкладка "Робота". ${buildWorkSummary(profile)}`;
}

/** Pure — takes `trades` as a param (typically `useJournalStore(s =>
 *  s.trades)`) instead of reading `.getState()` itself, so this recomputes
 *  on every render trades actually change. See use-work-insight-sync.ts. */
export function computeWorkSignature(trades: Trade[], profile: Profile): string {
  if (profile !== "trader") return profile;
  // closedCount catches a trade flipping open -> closed even when that
  // doesn't change trades.length or which trade is first in the array —
  // the one event this signature actually needs to detect. The discipline
  // streak is included too: editing an existing trade's followedPlan
  // changes neither trades.length nor closedCount, but it's exactly the
  // kind of edit that should invalidate a cached "стрік дисципліни" insight.
  const closedCount = trades.filter((t) => t.status === "closed").length;
  const streak = computeDisciplineStreak(trades);
  return [profile, trades.length, closedCount, streak].join("|");
}
