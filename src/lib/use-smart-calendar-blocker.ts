"use client";

import { useEffect } from "react";
import { useJournalStore } from "./journal-store";
import { useJournalConfigStore } from "./journal-config-store";
import { useCalendarStore } from "./calendar-store";
import { useAutomationsStore } from "./automations-store";
import { useMacroEvents } from "./use-macro-events";
import { closedTradesWithNet } from "./trade-insights";
import { formatDateKey } from "./calendar-utils";

const POST_LOSS_BLOCK_MINUTES = 120;
const MACRO_LOOKAHEAD_MINUTES = 60;
const MACRO_BLOCK_MINUTES = 30;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function toTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "Розумний блокер календаря" — the one automation on the hub with two real
 *  triggers, both opportunistic (checked whenever the app is open, not a
 *  true server cron — see automations-store's doc comment on why):
 *
 *  1. Right after a trade closes at a loss, blocks the next two hours —
 *     post-loss overtrading is a real, already-measured pattern elsewhere
 *     in the app (detectRevengeTrading, computePostLossPauseCorrelation).
 *  2. A high-impact macro event lands within the next hour (server-cached
 *     macro calendar, same data the Робота screen's own widget reads).
 *
 *  Each trigger is recorded in automations-store's persisted id lists the
 *  moment it fires, so reopening the app never re-scans history and
 *  duplicates a block for the same loss or event. */
export function useSmartCalendarBlocker(enabled: boolean) {
  const trades = useJournalStore((s) => s.trades);
  const { instruments } = useJournalConfigStore();
  const addCalendarItem = useCalendarStore((s) => s.addItem);
  const automationOn = useAutomationsStore((s) => s.enabled["calendar-blocker"]);
  const autoBlockedTradeIds = useAutomationsStore((s) => s.autoBlockedTradeIds);
  const autoBlockedMacroEventIds = useAutomationsStore((s) => s.autoBlockedMacroEventIds);
  const markTradeBlocked = useAutomationsStore((s) => s.markTradeBlocked);
  const markMacroEventBlocked = useAutomationsStore((s) => s.markMacroEventBlocked);
  const macro = useMacroEvents();

  useEffect(() => {
    if (!enabled || !automationOn) return;
    const instrumentById = new Map(instruments.map((i) => [i.id, i]));
    const closed = closedTradesWithNet(trades, instrumentById);
    const lastLoss = [...closed].reverse().find((x) => x.net < 0);
    if (!lastLoss || autoBlockedTradeIds.includes(lastLoss.trade.id)) return;

    const start = new Date(`${lastLoss.trade.date}T${lastLoss.trade.time}:00`);
    if (Number.isNaN(start.getTime())) return;

    addCalendarItem({
      kind: "event",
      title: "Заблоковано — після збиткової сесії",
      date: formatDateKey(start),
      time: toTimeKey(start),
      durationMinutes: POST_LOSS_BLOCK_MINUTES,
      category: "work",
      reminder: "none",
      recurrence: null,
    });
    markTradeBlocked(lastLoss.trade.id);
  }, [enabled, automationOn, trades, instruments, autoBlockedTradeIds, addCalendarItem, markTradeBlocked]);

  useEffect(() => {
    if (!enabled || !automationOn || macro.loading || macro.items.length === 0) return;
    const now = new Date();
    const horizon = addMinutes(now, MACRO_LOOKAHEAD_MINUTES);
    const upcoming = macro.items.find((e) => {
      if (e.importance !== "high") return false;
      if (autoBlockedMacroEventIds.includes(e.id)) return false;
      const at = new Date(e.scheduledAt);
      return at > now && at <= horizon;
    });
    if (!upcoming) return;

    const at = new Date(upcoming.scheduledAt);
    addCalendarItem({
      kind: "event",
      title: `Заблоковано — новина: ${upcoming.title}`,
      date: formatDateKey(at),
      time: toTimeKey(at),
      durationMinutes: MACRO_BLOCK_MINUTES,
      category: "work",
      reminder: "none",
      recurrence: null,
    });
    markMacroEventBlocked(upcoming.id);
  }, [enabled, automationOn, macro, autoBlockedMacroEventIds, addCalendarItem, markMacroEventBlocked]);
}
