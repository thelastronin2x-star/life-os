import { startOfWeek } from "./finance-periods";
import { formatDateKey } from "./calendar-utils";
import { computeTradePnL } from "./trade-calculations";
import type { Trade } from "./journal-store";
import type { JournalInstrument } from "./journal-config-store";

export interface WeekTradingSummary {
  /** Net result of every closed trade in the week. */
  net: number;
  /** Closed trades in the week. Zero means "no trading happened", which is a
   *  different statement from a net of zero and callers should say so. */
  count: number;
  wins: number;
  /** Win rate over the week, or null when there were no trades — an explicit
   *  null rather than 0%, which would read as "you lost everything". */
  winRate: number | null;
  /** Symbol the net is expressed in: the account currency the week's trades
   *  actually belong to, never the app-wide display currency. */
  symbol: string;
}

/** The week's trading, mirroring getWeekExpenseTotal on the finance side:
 *  same Monday–Sunday boundaries, same `weekOffset` convention, so the two
 *  halves of the Головна week block always describe the same seven days.
 *
 *  Only closed trades count. An open position has an unrealised number that
 *  changes while you look at it, and mixing it into a weekly total would make
 *  the figure disagree with itself between two renders. */
export function summarizeWeekTrades(
  trades: Trade[],
  instrumentById: Map<string, JournalInstrument>,
  symbolForAccount: (accountId: string | null) => string,
  weekOffset = 0
): WeekTradingSummary {
  const weekStart = startOfWeek(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startKey = formatDateKey(weekStart);
  const endKey = formatDateKey(weekEnd);

  const inWeek = trades.filter(
    (t) => t.status === "closed" && t.date >= startKey && t.date <= endKey
  );

  let net = 0;
  let wins = 0;
  let counted = 0;
  // Which account currency dominates the week. Mixing a USD prop account and
  // a UAH personal one into one sum would be wrong, but so would refusing to
  // show anything: pick the currency most of the week's trades were in and
  // sum only those, so the number and its symbol always agree.
  const perSymbol = new Map<string, Trade[]>();
  for (const t of inWeek) {
    const sym = symbolForAccount(t.accountId);
    const bucket = perSymbol.get(sym);
    if (bucket) bucket.push(t);
    else perSymbol.set(sym, [t]);
  }
  let symbol = "$";
  let dominant: Trade[] = [];
  for (const [sym, bucket] of perSymbol) {
    if (bucket.length > dominant.length) {
      dominant = bucket;
      symbol = sym;
    }
  }

  for (const t of dominant) {
    const pnl = computeTradePnL(t, instrumentById.get(t.instrumentId)).net;
    if (pnl === null) continue;
    counted += 1;
    net += pnl;
    if (pnl > 0) wins += 1;
  }

  return {
    net,
    count: counted,
    wins,
    winRate: counted === 0 ? null : Math.round((wins / counted) * 100),
    symbol,
  };
}
