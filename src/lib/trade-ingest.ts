import { useJournalStore, type Trade, type TradeDirection, type TradeSource } from "./journal-store";

/** What every external trade source (MT5 report, MT5 EA, Bybit sync, any
 *  future one) must normalize itself into before reaching the journal —
 *  deliberately shaped like neither MT5's report columns nor Bybit's
 *  closed-pnl fields. Each source resolves its own broker-specific symbol to
 *  an instrumentId and computes its own direction/fees before calling
 *  ingestTrades; this module only knows the generic shape below. */
export interface IncomingTrade {
  source: Exclude<TradeSource, "manual">;
  /** Provider-specific identifier, unique within that source (e.g. MT5's
   *  position id, Bybit's orderId+updatedTime) — NOT yet prefixed with the
   *  source name; dedupKeyFor does that once, in one place. */
  sourceId: string;
  instrumentId: string;
  /** The raw, un-normalized symbol as the source reported it (e.g. Bybit's
   *  "BTCUSDT", MT5's "EURUSD.a") — kept verbatim so any future re-matching
   *  works from real data instead of guessing from whatever instrument it
   *  happened to resolve to at import time. */
  sourceSymbol: string;
  direction: TradeDirection;
  date: string;
  time: string;
  entry: number;
  stop: number;
  take: number;
  lot: number;
  closePrice: number;
  commission: number;
  swap: number;
  /** Broker-reported net P&L, when the source has one (e.g. Bybit's
   *  closedPnl) — see Trade.externalPnl for why this overrides the locally
   *  recomputed formula. */
  externalPnl?: number;
}

export interface IngestResult {
  imported: number;
  duplicates: number;
}

/** The one dedup key format every source's trades are keyed by — resubmitting
 *  the same (source, sourceId) pair is always recognized as the same trade,
 *  regardless of which source it came from or how many times it's resent. */
export function dedupKeyFor(source: TradeSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

/** The one place any external trade source turns into a journal Trade — same
 *  dedup rule, same internal shape, same idempotency guarantee, regardless of
 *  where it came from. Reads/writes the store directly (not via the React
 *  hook) so it works the same whether called from a component or a
 *  background sync. */
export function ingestTrades(accountId: string, incoming: IncomingTrade[]): IngestResult {
  const { trades, addTrade } = useJournalStore.getState();
  const existingIds = new Set(trades.map((t) => t.externalId).filter(Boolean));

  let imported = 0;
  let duplicates = 0;
  for (const t of incoming) {
    const externalId = dedupKeyFor(t.source, t.sourceId);
    if (existingIds.has(externalId)) {
      duplicates += 1;
      continue;
    }
    // Added to the same set the check above reads, so a duplicate WITHIN this
    // one batch is caught too — `existingIds` was built from the store before
    // the loop, and without this it never learns about the trades this very
    // call is adding. Two rows sharing a dedup key in a single payload
    // (overlapping sync windows, a provider resending a row) would otherwise
    // both pass the check and land as two identical journal entries.
    existingIds.add(externalId);

    const trade: Omit<Trade, "id"> = {
      accountId,
      instrumentId: t.instrumentId,
      direction: t.direction,
      status: "closed",
      date: t.date,
      time: t.time,
      entry: t.entry,
      stop: t.stop,
      take: t.take,
      lot: t.lot,
      closePrice: t.closePrice,
      commission: t.commission,
      swap: t.swap,
      tagIds: [],
      sessionId: null,
      screenshots: [],
      externalId,
      externalPnl: t.externalPnl,
      source: t.source,
      sourceSymbol: t.sourceSymbol,
    };
    addTrade(trade);
    imported += 1;
  }

  return { imported, duplicates };
}
