"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFinanceStore } from "./finance-store";
import { useMonobankLinkStore } from "./monobank-store";
import { useLedgerSyncStore } from "./ledger-sync-store";
import { toLocalTransaction, type LedgerEntryDto } from "./ledger-merge";
import { waitForHydration } from "./store-hydration";

// Same cadence as the old webhook poll it runs alongside during this
// transition (see monobank-server-ledger-prompt.md, Stages 3-7) — both
// stay active until Stage 7 removes the old Redis-queue path; a transaction
// delivered by either is deduped by externalId regardless of which one
// gets there first.
const LEDGER_POLL_MS = 10_000;

/** Reads the server ledger via cursor (GET /api/finance/ledger?since=...) —
 *  a plain, idempotent read replacing the old peek-then-ack webhook queue.
 *  Unlike that queue, there's no ack: the same cursor always returns the
 *  same rows, so an interrupted client just re-requests the same `since`
 *  next time, harmlessly. */
export function useLedgerSync() {
  const isPolling = useRef(false);

  const pollLedger = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    if (useMonobankLinkStore.getState().links.length === 0) return;
    if (isPolling.current) return;
    isPolling.current = true;

    try {
      const cursor = useLedgerSyncStore.getState().cursor;
      const res = await fetch(`/api/finance/ledger?since=${cursor}`);
      if (!res.ok) return;
      const data: { transactions?: LedgerEntryDto[]; cursor?: number } = await res.json();

      const store = useFinanceStore.getState();
      const existingExternalIds = new Set(store.transactions.filter((t) => t.externalId).map((t) => t.externalId));
      for (const entry of data.transactions ?? []) {
        if (existingExternalIds.has(entry.externalId)) continue;
        const txn = toLocalTransaction(entry);
        if (txn) store.addTransaction(txn);
      }

      // Advances even when nothing new was found (server echoes `since`
      // back unchanged in that case) — always safe, since the server only
      // ever returns a cursor value it actually has rows up to.
      if (typeof data.cursor === "number") {
        useLedgerSyncStore.getState().setCursor(data.cursor);
      }
    } catch {
      // Next poll retries from the same cursor — nothing to lose.
    } finally {
      isPolling.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    waitForHydration([useFinanceStore, useMonobankLinkStore, useLedgerSyncStore]).then(() => {
      if (cancelled) return;
      pollLedger();
      interval = setInterval(pollLedger, LEDGER_POLL_MS);
    });

    function onVisible() {
      if (document.visibilityState === "visible") pollLedger();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollLedger]);
}
