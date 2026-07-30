import type { Trade } from "./journal-store";
import { getInstrumentMultiplier, type JournalInstrument } from "./journal-config-store";

export interface TradePnL {
  gross: number | null;
  net: number | null;
  rrPlanned: string;
  rrActual: string | null;
}

/** Planned R:R from entry/stop/take — always computable, regardless of status. */
export function computeRR(trade: Pick<Trade, "entry" | "stop" | "take">): string {
  const risk = Math.abs(trade.entry - trade.stop);
  const reward = Math.abs(trade.take - trade.entry);
  if (risk === 0) return "—";
  return `1:${(reward / risk).toFixed(1)}`;
}

export function computeTradePnL(trade: Trade, instrument: JournalInstrument | undefined): TradePnL {
  const rrPlanned = computeRR(trade);

  if (trade.status === "open" || trade.closePrice == null || !instrument) {
    return { gross: null, net: null, rrPlanned, rrActual: null };
  }

  const multiplier = getInstrumentMultiplier(instrument);
  const directionSign = trade.direction === "LONG" ? 1 : -1;
  const gross = (trade.closePrice - trade.entry) * trade.lot * multiplier * directionSign;
  // A broker-reported net (e.g. Bybit's closedPnl) is authoritative when
  // present — it can include funding or other adjustments this simple
  // formula has no way to reproduce, so recomputing would just as often make
  // the number wrong as right.
  const net = trade.externalPnl ?? gross - trade.commission + trade.swap;

  const risk = Math.abs(trade.entry - trade.stop);
  const rrActual = risk === 0 ? null : `1:${(Math.abs(trade.closePrice - trade.entry) / risk).toFixed(1)}`;

  return { gross, net, rrPlanned, rrActual };
}
