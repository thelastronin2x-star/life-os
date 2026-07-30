"use client";

import { useCallback, useEffect, useState } from "react";
import { useBybitSyncStore } from "./bybit-store";
import { formatDateKey } from "./calendar-utils";
import { ingestTrades, type IncomingTrade } from "./trade-ingest";
import { resolveCryptoInstrumentId } from "./resolve-crypto-instrument";

type Status = "loading" | "disconnected" | "connected";
type Category = "linear" | "inverse";

interface BybitTradeItem {
  symbol: string;
  orderId: string;
  /** Direction of the order that CLOSED the position — opposite of the
   *  position's own direction (closing a long takes a Sell order, closing a
   *  short takes a Buy order). See the direction mapping below. */
  side: "Buy" | "Sell";
  qty: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  openFee: string;
  closeFee: string;
  createdTime: string;
  updatedTime: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function timeParts(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  return { date: formatDateKey(d), time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
}

// Safeguard against a runaway loop, same principle as fetchAllPages's own
// MAX_PAGES — 60 weekly windows is ~14 months per single "load N months
// back" call, already well past any realistic backfill target.
const MAX_BACKFILL_WINDOWS = 60;

export function useBybit() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncSummary, setLastSyncSummary] = useState<{ imported: number; duplicates: number } | null>(null);
  const [backfillProgress, setBackfillProgress] = useState<{ windowsProcessed: number } | null>(null);

  const { lastSyncedAt, earliestSyncedAt, historyExhausted, setLastSynced, setEarliestSynced, clear } =
    useBybitSyncStore();

  const refresh = useCallback(async () => {
    const res = await fetch("/api/journal/bybit/status");
    const data = await res.json();
    setStatus(data.connected ? "connected" : "disconnected");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state set after an internal await
    refresh();
  }, [refresh]);

  const connect = useCallback(async (apiKey: string, apiSecret: string) => {
    setError(null);
    const res = await fetch("/api/journal/bybit/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, apiSecret }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.details || (res.status === 401 ? "Невірний ключ або секрет" : "Не вдалося підключитись"));
      return false;
    }
    setStatus("connected");
    return true;
  }, []);

  const disconnect = useCallback(async () => {
    await fetch("/api/journal/bybit/disconnect", { method: "POST" });
    clear();
    await refresh();
  }, [clear, refresh]);

  // resolveCryptoInstrumentId is a plain function (reads/writes the store via
  // getState directly, no closure) so it needs no dependency array — every
  // call already sees whatever the previous call in the same batch created.
  const resolveInstrumentId = useCallback((symbol: string): string => resolveCryptoInstrumentId(symbol), []);

  /** Normalizes Bybit's closed-pnl rows into the shared internal trade shape
   *  and hands them to the one ingestion module every trade source goes
   *  through — dedup, source-tagging and idempotency all live there now, not
   *  duplicated per source. */
  const importBybitTrades = useCallback(
    (items: BybitTradeItem[], accountId: string) => {
      const incoming: IncomingTrade[] = items.map((item) => {
        const entry = timeParts(Number(item.createdTime));
        // Bybit's `side` on a closed-pnl row is the direction of the order
        // that CLOSED the position, not the position's own direction —
        // closing a long takes a Sell order, closing a short takes a Buy
        // order (see Bybit's own docs on partial/full position closing).
        const direction: IncomingTrade["direction"] = item.side === "Sell" ? "LONG" : "SHORT";
        return {
          source: "bybit",
          // orderId alone isn't guaranteed unique per closed-pnl row — a
          // position closed in stages can produce several rows sharing the
          // same orderId. Pairing it with updatedTime (which differs per
          // distinct closing event) keeps genuinely separate partial closes
          // from being mistaken for duplicates of each other.
          sourceId: `${item.orderId}:${item.updatedTime}`,
          instrumentId: resolveInstrumentId(item.symbol),
          sourceSymbol: item.symbol,
          direction,
          date: entry.date,
          time: entry.time,
          entry: Number(item.avgEntryPrice),
          stop: 0,
          take: 0,
          lot: Number(item.qty),
          closePrice: Number(item.avgExitPrice),
          commission: Number(item.openFee) + Number(item.closeFee),
          swap: 0,
          // Bybit's own closedPnl already nets out fees (and, for perpetuals,
          // funding) — trusted directly rather than recomputed, so the
          // journal's number always matches what Bybit itself reports.
          externalPnl: Number(item.closedPnl),
        };
      });
      return ingestTrades(accountId, incoming);
    },
    [resolveInstrumentId]
  );

  const fetchTradesRange = useCallback(async (category: Category, startTime: number, endTime: number) => {
    const res = await fetch("/api/journal/bybit/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, startTime, endTime }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.details || "Не вдалося синхронізувати");
    }
    const data: { trades: BybitTradeItem[] } = await res.json();
    return data.trades;
  }, []);

  const sync = useCallback(
    async (accountId: string, category: Category = "linear") => {
      setError(null);
      setSyncing(true);
      setLastSyncSummary(null);
      try {
        const endTime = Date.now();
        const startTime = lastSyncedAt
          ? Math.max(new Date(lastSyncedAt).getTime(), endTime - SEVEN_DAYS_MS)
          : endTime - SEVEN_DAYS_MS;

        const items = await fetchTradesRange(category, startTime, endTime);
        const { imported, duplicates } = importBybitTrades(items, accountId);

        setLastSynced(new Date(endTime).toISOString());
        // Only recorded on the very first sync — every later call already has
        // an earliestSyncedAt from that first run, and would otherwise keep
        // resetting it forward to whatever `startTime` this particular call
        // used (which is clamped to `lastSyncedAt`, not the true history
        // start), silently shrinking how far back loadOlderHistory can reach.
        if (!earliestSyncedAt) {
          setEarliestSynced(new Date(startTime).toISOString());
        }
        setLastSyncSummary({ imported, duplicates });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося синхронізувати");
      } finally {
        setSyncing(false);
      }
    },
    [lastSyncedAt, earliestSyncedAt, fetchTradesRange, importBybitTrades, setLastSynced, setEarliestSynced]
  );

  /** Steps exactly one 7-day window further back from the CURRENT
   *  earliestSyncedAt (read fresh from the store, not a stale closure) —
   *  Bybit's own per-request range limit means older history can only ever
   *  be walked backwards like this, never fetched in one call (see
   *  fetchClosedPnl's own within-window pagination, which is a separate
   *  concern from this cross-window walk). Shared by both the single-step
   *  "Довантажити старішу історію" button and the multi-window
   *  loadOlderHistoryFor below. */
  const stepOlderHistoryWindow = useCallback(
    async (accountId: string, category: Category) => {
      const cursor = useBybitSyncStore.getState().earliestSyncedAt;
      if (!cursor) return { imported: 0, duplicates: 0, exhausted: true };

      const to = new Date(cursor).getTime() - 1;
      const from = to - SEVEN_DAYS_MS;

      const items = await fetchTradesRange(category, from, to);
      const { imported, duplicates } = importBybitTrades(items, accountId);
      const exhausted = items.length === 0;
      setEarliestSynced(new Date(from).toISOString(), exhausted);

      return { imported, duplicates, exhausted };
    },
    [fetchTradesRange, importBybitTrades, setEarliestSynced]
  );

  const loadOlderHistory = useCallback(
    async (accountId: string, category: Category = "linear") => {
      if (!earliestSyncedAt || historyExhausted) return;
      setError(null);
      setSyncing(true);
      setLastSyncSummary(null);
      try {
        const { imported, duplicates } = await stepOlderHistoryWindow(accountId, category);
        setLastSyncSummary({ imported, duplicates });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося довантажити історію");
      } finally {
        setSyncing(false);
      }
    },
    [earliestSyncedAt, historyExhausted, stepOlderHistoryWindow]
  );

  /** Walks multiple 7-day windows back in one go, until either `days` back
   *  is reached or history is exhausted — e.g. "довантажити 3 місяці" instead
   *  of clicking the single-window button ~13 times by hand. Still one
   *  request at a time (no Promise.all) so it respects the same rate
   *  boundaries a manual click-by-click backfill would. */
  const loadOlderHistoryFor = useCallback(
    async (accountId: string, days: number, category: Category = "linear") => {
      if (!earliestSyncedAt || historyExhausted) return;
      setError(null);
      setSyncing(true);
      setLastSyncSummary(null);
      setBackfillProgress({ windowsProcessed: 0 });
      const targetMs = Date.now() - days * 24 * 60 * 60 * 1000;
      let totalImported = 0;
      let totalDuplicates = 0;
      try {
        for (let i = 0; i < MAX_BACKFILL_WINDOWS; i++) {
          const cursor = useBybitSyncStore.getState().earliestSyncedAt;
          if (!cursor || new Date(cursor).getTime() <= targetMs) break;

          const { imported, duplicates, exhausted } = await stepOlderHistoryWindow(accountId, category);
          totalImported += imported;
          totalDuplicates += duplicates;
          setBackfillProgress({ windowsProcessed: i + 1 });
          if (exhausted) break;
        }
        setLastSyncSummary({ imported: totalImported, duplicates: totalDuplicates });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося довантажити історію");
      } finally {
        setSyncing(false);
        setBackfillProgress(null);
      }
    },
    [earliestSyncedAt, historyExhausted, stepOlderHistoryWindow]
  );

  return {
    status,
    error,
    syncing,
    lastSyncSummary,
    lastSyncedAt,
    earliestSyncedAt,
    historyExhausted,
    backfillProgress,
    connect,
    disconnect,
    sync,
    loadOlderHistory,
    loadOlderHistoryFor,
  };
}
