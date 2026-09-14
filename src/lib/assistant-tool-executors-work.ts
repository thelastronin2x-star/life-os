"use client";

import { useJournalConfigStore } from "@/lib/journal-config-store";
import { normalizeSymbol } from "@/lib/instrument-symbol";
import { computeRR } from "@/lib/trade-calculations";
import { usePropAccountsStore } from "@/lib/prop-accounts-store";
import type { Trade, TradeDirection } from "@/lib/journal-store";

/** Own file, not shared with the calendar/health executors — see the
 *  comment in assistant-tool-executors-calendar.ts for why the split
 *  matters. */
export interface TradeDraft extends Partial<Omit<Trade, "id">> {
  symbol?: string;
}

interface WorkToolCallbacks {
  onDraftTrade: (draft: TradeDraft) => void;
}

export function executeWorkTool(
  name: string,
  input: Record<string, unknown>,
  callbacks: WorkToolCallbacks
): string {
  if (name === "calc_risk") {
    const entry = Number(input.entry);
    const stop = Number(input.stop);
    const take = Number(input.take);
    if (![entry, stop, take].every(Number.isFinite)) return "Не вистачає рівнів для розрахунку ризику.";
    const rr = computeRR({ entry, stop, take });
    return `Співвідношення ризик/прибуток: ${rr}.`;
  }

  if (name === "set_risk_limit") {
    const firm = String(input.firm ?? "").trim();
    const newMaxDrawdown = Number(input.newMaxDrawdown);
    if (!firm || !Number.isFinite(newMaxDrawdown) || newMaxDrawdown <= 0) return "Не вистачає назви фірми або коректного ліміту.";
    const { accounts, updateAccount } = usePropAccountsStore.getState();
    const account = accounts.find((a) => a.firm.toLowerCase().includes(firm.toLowerCase()));
    if (!account) return `Проп-акаунт "${firm}" не знайдено.`;
    updateAccount(account.id, { maxDrawdown: newMaxDrawdown });
    return `Ліміт максимальної просадки для "${account.firm}" змінено на ${newMaxDrawdown}%.`;
  }

  if (name === "prepare_trade_draft") {
    const symbol = String(input.symbol ?? "").trim();
    const direction: TradeDirection = input.direction === "SHORT" ? "SHORT" : "LONG";
    const entry = Number(input.entry);
    const stop = Number(input.stop);
    if (!symbol || !Number.isFinite(entry) || !Number.isFinite(stop)) {
      return "Не вистачає символу або рівнів — чернетку не підготовано.";
    }
    const { instruments } = useJournalConfigStore.getState();
    const normalized = normalizeSymbol(symbol);
    const instrument = instruments.find((i) => normalizeSymbol(i.symbol) === normalized);

    const draft: TradeDraft = {
      symbol,
      instrumentId: instrument?.id,
      direction,
      entry,
      stop,
      take: Number.isFinite(Number(input.take)) ? Number(input.take) : undefined,
      lot: Number.isFinite(Number(input.lot)) ? Number(input.lot) : undefined,
    };
    callbacks.onDraftTrade(draft);
    return instrument
      ? `Підготував чернетку угоди по ${instrument.symbol}. Форма відкрита — збережи її сам, якщо все вірно.`
      : `Підготував чернетку угоди по "${symbol}" (інструмент не знайдено в списку — вибери вручну у формі). Форма відкрита, нічого ще не збережено.`;
  }

  return `Невідомий інструмент: ${name}.`;
}
