"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TradeDirection = "LONG" | "SHORT";
export type TradeStatus = "open" | "closed";
/** Which pipeline produced this trade — a manual entry through the journal
 *  form, or an external source ingested through trade-ingest.ts. Explicit
 *  and first-class rather than inferred by sniffing `externalId`'s prefix
 *  each time a caller needs to know (that string-sniffing pattern is exactly
 *  what this field replaces). */
export type TradeSource = "manual" | "mt5" | "bybit";

export interface Trade {
  id: string;
  accountId: string | null;
  instrumentId: string;
  direction: TradeDirection;
  status: TradeStatus;
  date: string; // "YYYY-MM-DD" — entry date
  time: string; // "HH:MM" — entry time
  entry: number;
  stop: number;
  take: number;
  lot: number;
  closePrice: number | null;
  commission: number; // positive cost
  swap: number; // signed — can help or hurt
  tagIds: string[];
  sessionId: string | null;
  screenshots: string[]; // base64 data URLs
  /** Set for trades imported from a broker report (e.g. "mt5:<positionId>") —
   *  prevents duplicate imports when re-importing an overlapping report. */
  externalId?: string;
  /** Broker-reported net P&L (e.g. Bybit's own `closedPnl`), when available —
   *  takes precedence over the locally-recomputed gross/commission/swap
   *  formula in computeTradePnL. Some brokers' real net includes funding or
   *  other adjustments a simple entry/exit/qty formula can't reproduce, so
   *  trusting the broker's own number is the only way to match it exactly. */
  externalPnl?: number;
  source?: TradeSource;
  /** The raw, un-normalized symbol as the source reported it (e.g. Bybit's
   *  "BTCUSDT") — only present for trades ingested after this field was
   *  added. Lets any future re-matching work from real data instead of
   *  guessing; existing trades from before this field predates it and have
   *  no way to recover it after the fact (see migrateInstrumentSplit in
   *  journal-config-store.ts). */
  sourceSymbol?: string;
}

function seedTrades(): Trade[] {
  return [];
}

/** v0 -> v1: Bybit's closed-pnl `side` is the direction of the order that
 *  CLOSED the position, not the position's own direction — closing a long
 *  takes a Sell order, closing a short takes a Buy order. Every Bybit-
 *  imported trade before this fix was read the wrong way round (Buy -> LONG
 *  instead of Sell -> LONG), so existing ones need a one-time flip. MT5/
 *  manual trades have no "bybit:" externalId and are untouched. */
export function migrateBybitDirection(trades: Trade[]): Trade[] {
  return trades.map((t) =>
    t.externalId?.startsWith("bybit:") ? { ...t, direction: t.direction === "LONG" ? "SHORT" : "LONG" } : t
  );
}

/** v1 -> v2: `source` didn't exist before — every trade up to this point was
 *  identified only by sniffing `externalId`'s prefix by hand wherever the
 *  source mattered. Backfills it once from that same prefix so it's a real
 *  field on data going forward instead of a string convention every caller
 *  has to know about. */
export function migrateTradeSource(trades: Trade[]): Trade[] {
  return trades.map((t): Trade => {
    if (t.source) return t;
    if (t.externalId?.startsWith("mt5:")) return { ...t, source: "mt5" };
    if (t.externalId?.startsWith("bybit:")) return { ...t, source: "bybit" };
    return { ...t, source: "manual" };
  });
}

interface JournalState {
  trades: Trade[];
  addTrade: (t: Omit<Trade, "id">) => void;
  updateTrade: (id: string, patch: Partial<Omit<Trade, "id">>) => void;
  removeTrade: (id: string) => void;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      trades: seedTrades(),
      addTrade: (t) =>
        set((s) => {
          // Belt-and-suspenders, mirroring finance-store's addTransaction:
          // callers (ingestTrades, report import) already dedup by externalId,
          // but they read state at the start of an operation, so two of them
          // resolving in an interleaved order could both decide the same
          // external trade is new. Guard here too, at the one place that
          // actually commits it. Manual trades have no externalId and are
          // never affected.
          if (t.externalId && s.trades.some((existing) => existing.externalId === t.externalId)) {
            return s;
          }
          return { trades: [{ ...t, id: crypto.randomUUID(), source: t.source ?? "manual" }, ...s.trades] };
        }),
      updateTrade: (id, patch) =>
        set((s) => ({ trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTrade: (id) => set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),
    }),
    {
      name: "life-os-journal-v2",
      version: 2,
      migrate: (persisted, version) => {
        let state = persisted as JournalState;
        if (version < 1) state = { ...state, trades: migrateBybitDirection(state.trades) };
        if (version < 2) state = { ...state, trades: migrateTradeSource(state.trades) };
        return state;
      },
    }
  )
);
