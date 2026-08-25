"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMonobankLinkStore } from "./monobank-store";
import { useFinanceStore } from "./finance-store";
import { importMonobankTransactions } from "./monobank-import";
import { syncMonobankAccount, reconcileMonobankLink, fetchLiveMonobankAccountsWithError, type MonobankAccountInfo } from "./monobank-sync";
import type { BankTransaction } from "./bank-source";

export type { MonobankAccountInfo } from "./monobank-sync";

type Status = "loading" | "disconnected" | "connected";

const CURRENCY_SYMBOLS: Record<number, string> = { 980: "₴", 840: "$", 978: "€" };

export function currencySymbolFor(code: number): string {
  return CURRENCY_SYMBOLS[code] ?? "";
}

export function labelFor(account: MonobankAccountInfo): string {
  const pan = account.maskedPan[0];
  if (pan) return `•• ${pan.slice(-4)}`;
  return account.type;
}

const MAX_RANGE_SECONDS = 31 * 24 * 60 * 60;

export type BackfillProgress =
  | { phase: "extending"; probed: number }
  | { phase: "refreshing"; current: number; total: number };

// Persisted (not just in-memory) because connectViaApp navigates the whole
// tab away to the Monobank app — surviving a reload/relaunch is the point,
// not an edge case.
const PENDING_CORP_REQUEST_KEY = "monobank-corp-pending-request";
const CORP_POLL_INTERVAL_MS = 2_500;

export type CorpConnectStatus = "idle" | "waiting" | "error";

export function useMonobank() {
  const [status, setStatus] = useState<Status>("loading");
  const [monoAccounts, setMonoAccounts] = useState<MonobankAccountInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [backfillProgress, setBackfillProgress] = useState<BackfillProgress | null>(null);
  const [corpConnectStatus, setCorpConnectStatus] = useState<CorpConnectStatus>("idle");
  const corpPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { links, setLink, removeLink } = useMonobankLinkStore();

  const link = useCallback(
    (account: MonobankAccountInfo, localAccountId: string) => {
      const label = labelFor(account);
      setLink({
        monobankAccountId: account.id,
        label,
        localAccountId,
        lastSyncedAt: null,
        earliestSyncedAt: null,
        historyExhausted: false,
        metadataBackfilled: false,
        reconciledAt: null,
      });
      // Best-effort — the client-side link above is still the source of
      // truth in this stage; the server copy just lets the webhook route
      // attribute future events to this account (see Stage 3).
      fetch("/api/finance/monobank/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerAccountId: account.id, localAccountId, label }),
      }).catch((e) => console.error("Server-side account link failed", e));
    },
    [setLink]
  );

  /** Creates a local account and links it for every Monobank account that
   *  isn't linked yet — runs right after connect and on every refresh, so a
   *  linked account (and, moments later once syncMonobankAccount below runs,
   *  its transaction history) appears with no manual "pick a local account /
   *  Прив'язати" step required. The manual picker in AccountRow still exists
   *  as a fallback (e.g. re-linking after an unlink), but the normal path
   *  never reaches it anymore. */
  const autoLinkAccounts = useCallback(
    (accounts: MonobankAccountInfo[]) => {
      const linkedIds = new Set(useMonobankLinkStore.getState().links.map((l) => l.monobankAccountId));
      const newAccounts = accounts.filter((a) => !linkedIds.has(a.id));
      for (const account of newAccounts) {
        const localAccountId = useFinanceStore.getState().addAccount({
          name: labelFor(account),
          type: "personal",
          currencySymbol: currencySymbolFor(account.currencyCode),
          startingBalance: account.balance / 100,
        });
        link(account, localAccountId);
        const newLink = useMonobankLinkStore.getState().links.find((l) => l.monobankAccountId === account.id);
        if (newLink) {
          // Best-effort immediate import — periodic sync would pick this up
          // within 65s anyway, but doing it now means transaction history
          // shows up right after connecting instead of after a short wait.
          syncMonobankAccount(newLink).catch((e) => console.error("Initial auto-link sync failed", e));
        }
      }
    },
    [link]
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/finance/monobank/status");
    const data = await res.json();
    if (data.connected) {
      setStatus("connected");
      // Shares the same cached/in-flight request as every reconciliation
      // call (see fetchLiveMonobankAccountsWithError in monobank-sync.ts) —
      // this mount-time fetch used to consume the whole 60s client-info
      // rate-limit window by itself, guaranteeing a 429 for whatever synced
      // moments later.
      const result = await fetchLiveMonobankAccountsWithError();
      setMonoAccounts(result.accounts);
      setError(
        result.error === "rate_limited"
          ? "Забагато запитів до Monobank — спробуй за хвилину"
          : result.error === "failed"
            ? "Не вдалося завантажити рахунки"
            : null
      );
      if (result.error === null) autoLinkAccounts(result.accounts);
    } else {
      setStatus("disconnected");
      setMonoAccounts([]);
    }
  }, [autoLinkAccounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after an internal await
    refresh();
  }, [refresh]);

  const connect = useCallback(
    async (token: string) => {
      setError(null);
      const res = await fetch("/api/finance/monobank/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Невірний токен" : "Не вдалося підключитись");
        return false;
      }
      const data = await res.json();
      const accounts: MonobankAccountInfo[] = data.accounts ?? [];
      setMonoAccounts(accounts);
      setStatus("connected");
      autoLinkAccounts(accounts);
      return true;
    },
    [autoLinkAccounts]
  );

  const stopCorpPoll = useCallback(() => {
    if (corpPollTimerRef.current) {
      clearInterval(corpPollTimerRef.current);
      corpPollTimerRef.current = null;
    }
  }, []);

  /** Polls the Corporate-connect status route, which is also the one place
   *  that actually finishes the connection (sets the cookie) once
   *  Monobank's webhook has delivered a confirmed token server-side — see
   *  /api/finance/monobank-corp/status/[requestToken]. Started both right
   *  after connectViaApp fires (in case the tab never actually unloads) and
   *  on mount if a request was left pending across a reload. */
  const pollCorpStatus = useCallback(
    (requestToken: string) => {
      stopCorpPoll();
      setCorpConnectStatus("waiting");
      corpPollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/finance/monobank-corp/status/${requestToken}`);
          const data = await res.json();
          if (data.status === "confirmed") {
            stopCorpPoll();
            localStorage.removeItem(PENDING_CORP_REQUEST_KEY);
            setCorpConnectStatus("idle");
            await refresh();
          } else if (data.status === "expired" || data.error) {
            stopCorpPoll();
            localStorage.removeItem(PENDING_CORP_REQUEST_KEY);
            setCorpConnectStatus("error");
            setError("Запит на підключення більше не дійсний — спробуй ще раз");
          }
          // "pending" — keep waiting for the next tick.
        } catch {
          // Transient network hiccup — the next tick retries on its own.
        }
      }, CORP_POLL_INTERVAL_MS);
    },
    [stopCorpPoll, refresh]
  );

  useEffect(() => stopCorpPoll, [stopCorpPoll]);

  useEffect(() => {
    const raw = localStorage.getItem(PENDING_CORP_REQUEST_KEY);
    if (!raw) return;
    try {
      const { requestToken } = JSON.parse(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time resume-on-mount kickoff, same justification as the refresh()-on-mount effect above
      if (typeof requestToken === "string") pollCorpStatus(requestToken);
    } catch {
      localStorage.removeItem(PENDING_CORP_REQUEST_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time resume check on mount only
  }, []);

  /** Corporate/Provider API deep-link flow — opens the Monobank app for a
   *  one-tap confirmation instead of a manually pasted token. Gated server-
   *  side by MONOBANK_CORP_ENABLED; the connect route 404s until that's
   *  configured, so this is safe to call unconditionally, but the UI only
   *  shows the button when NEXT_PUBLIC_MONOBANK_CORP_ENABLED is set. */
  const connectViaApp = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/finance/monobank-corp/connect", { method: "POST" });
    if (!res.ok) {
      setError("Не вдалося почати підключення через застосунок");
      return;
    }
    const { acceptUrl, requestToken } = await res.json();
    localStorage.setItem(PENDING_CORP_REQUEST_KEY, JSON.stringify({ requestToken, createdAt: Date.now() }));
    pollCorpStatus(requestToken);
    window.location.href = acceptUrl;
  }, [pollCorpStatus]);

  const disconnect = useCallback(async () => {
    await fetch("/api/finance/monobank/disconnect", { method: "POST" });
    useMonobankLinkStore.getState().clearAll();
    await refresh();
  }, [refresh]);

  const fetchStatementRange = useCallback(async (monobankAccountId: string, from: number, to: number) => {
    const res = await fetch("/api/finance/monobank/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: monobankAccountId, from, to }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error === "rate_limited" ? "Забагато запитів — спробуй за хвилину" : "Не вдалося синхронізувати");
    }
    const data: { transactions: BankTransaction[] } = await res.json();
    return data.transactions;
  }, []);

  const sync = useCallback(
    async (monobankAccountId: string) => {
      const existingLink = links.find((l) => l.monobankAccountId === monobankAccountId);
      if (!existingLink) return;

      setError(null);
      setSyncingId(monobankAccountId);
      try {
        // No separate fallback here anymore — syncMonobankAccount itself
        // keeps retrying reconciliation on every call until it succeeds
        // (see reconciledAt in monobank-store.ts), so the manual button and
        // the background periodic sync now go through identical logic.
        await syncMonobankAccount(existingLink);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося синхронізувати");
      } finally {
        setSyncingId(null);
      }
    },
    [links]
  );

  /** Monobank only allows ~31 days per request, and the initial sync only
   *  ever pulls the most recent 31 days — this steps one window further back
   *  in time so older history (before the first sync) can still be imported. */
  const loadOlderHistory = useCallback(
    async (monobankAccountId: string) => {
      const existingLink = links.find((l) => l.monobankAccountId === monobankAccountId);
      if (!existingLink || !existingLink.earliestSyncedAt || existingLink.historyExhausted) return;

      setError(null);
      setSyncingId(monobankAccountId);
      try {
        const to = Math.floor(new Date(existingLink.earliestSyncedAt).getTime() / 1000) - 1;
        const from = to - MAX_RANGE_SECONDS;

        const raw = await fetchStatementRange(monobankAccountId, from, to);
        const added = importMonobankTransactions(raw, existingLink.localAccountId);
        useMonobankLinkStore.getState().setEarliestSynced(monobankAccountId, new Date(from * 1000).toISOString(), added === 0);
        // Without this, the starting balance stays anchored to whatever
        // history depth was known at the LAST reconciliation, while the sum
        // of transactions just grew by another 31-day window — drifting the
        // displayed balance further off with every older window loaded.
        await reconcileMonobankLink(existingLink);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося довантажити історію");
      } finally {
        setSyncingId(null);
      }
    },
    [links, fetchStatementRange]
  );

  /** One-time repair for history synced before this integration tracked
   *  `time`/`mcc` (or before `earliestSyncedAt` existed at all). Two phases:
   *
   *  1. Extend `earliestSyncedAt` all the way back to the true start of the
   *     account's history — if this link was first synced before that
   *     boundary was tracked, it can be recorded as a much more recent date
   *     than what's actually stored locally, silently leaving genuinely old
   *     transactions outside every future backfill's range forever.
   *
   *     This phase now runs as a durable server job (Stage 6) instead of an
   *     in-browser sleep-loop — this client just starts it and polls status.
   *     The actual transactions it finds land in the server ledger, which
   *     the already-running useLedgerSync background poller (Stage 5)
   *     picks up into localStorage on its own, same as any other new
   *     transaction — nothing here writes to finance-store directly.
   *
   *  2. Walk the now fully-known range forward in 31-day windows, backfilling
   *     missing `time`/`mcc` on anything already imported — dedup means
   *     nothing duplicates, but importTransactions patches the missing
   *     fields onto existing records, which also lets MCC-based
   *     categorization (not just the name/keyword fallback) finally apply.
   *     Still client-side and 61s-paced for now — it walks a bounded,
   *     already-known range (not an open-ended "how far back does this go"
   *     search), so it isn't the unbounded-iteration risk phase 1 was. */
  const refreshHistory = useCallback(
    async (monobankAccountId: string) => {
      const existingLink = links.find((l) => l.monobankAccountId === monobankAccountId);
      if (!existingLink || !existingLink.earliestSyncedAt) return;

      setError(null);
      setSyncingId(monobankAccountId);
      try {
        let earliestSyncedAt = existingLink.earliestSyncedAt;
        let historyExhausted = existingLink.historyExhausted;

        if (!historyExhausted) {
          const startRes = await fetch("/api/finance/monobank/backfill-history/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerAccountId: monobankAccountId,
              earliestSyncedAtSeconds: Math.floor(new Date(earliestSyncedAt).getTime() / 1000),
            }),
          });
          if (!startRes.ok) throw new Error("Не вдалося запустити довантаження історії");
          const { jobId } = await startRes.json();

          // Polls a durable server-side job rather than looping locally —
          // safe to abandon mid-poll (closing the app, losing network): the
          // job keeps running server-side regardless, and the next visit's
          // automatic repair check (see the effect below) picks up wherever
          // it left off, since historyExhausted is only set once truly done.
          let done = false;
          while (!done) {
            await new Promise((resolve) => setTimeout(resolve, 5_000));
            const statusRes = await fetch(`/api/finance/monobank/backfill-history/status/${jobId}`);
            if (!statusRes.ok) throw new Error("Не вдалося перевірити прогрес довантаження");
            const job = await statusRes.json();
            setBackfillProgress({ phase: "extending", probed: job.windowsProcessed });
            if (job.status === "failed") throw new Error("Довантаження історії не вдалося");
            done = job.status === "done";
            if (done) {
              historyExhausted = job.historyExhausted;
              earliestSyncedAt = new Date((job.cursorSeconds + 1) * 1000).toISOString();
              useMonobankLinkStore.getState().setEarliestSynced(monobankAccountId, earliestSyncedAt, historyExhausted);
            }
          }
        }

        const start = Math.floor(new Date(earliestSyncedAt).getTime() / 1000);
        const end = Math.floor(Date.now() / 1000);
        const windows: { from: number; to: number }[] = [];
        for (let cursor = start; cursor < end; ) {
          const windowEnd = Math.min(cursor + MAX_RANGE_SECONDS, end);
          windows.push({ from: cursor, to: windowEnd });
          cursor = windowEnd + 1;
        }

        for (let i = 0; i < windows.length; i++) {
          setBackfillProgress({ phase: "refreshing", current: i + 1, total: windows.length });
          const raw = await fetchStatementRange(monobankAccountId, windows[i].from, windows[i].to);
          importMonobankTransactions(raw, existingLink.localAccountId);
          if (i < windows.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 61_000));
          }
        }

        // Without this, the starting balance stays anchored to whatever it
        // was before this whole repair ran, while the transaction sum just
        // grew by however many years of history this backfilled.
        await reconcileMonobankLink(existingLink);

        // Only reached if both phases ran to completion with no thrown error
        // — this is what lets the whole repair run automatically exactly
        // once per link instead of needing a button press.
        useMonobankLinkStore.getState().setMetadataBackfilled(monobankAccountId, true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не вдалося оновити історію");
      } finally {
        setSyncingId(null);
        setBackfillProgress(null);
      }
    },
    [links, fetchStatementRange]
  );

  // Runs the full history repair automatically, once per link, the first
  // time this hook is mounted while connected — no button press needed.
  // Scoped to whenever the Monobank/Finance area is actually open (this hook
  // only mounts there), not the whole app: doing it globally would mean a
  // second independent instance polling status/accounts in the background on
  // every screen, which is exactly the redundant-network-calls bug this
  // integration already had to fix once before.
  //
  // Guarded by `!error`: without it, a genuine failure (bad token, real rate
  // limit) would retry in a tight loop the instant `syncingId` resets to
  // null, hammering Monobank instead of waiting for the user to intervene.
  useEffect(() => {
    if (status !== "connected" || syncingId || error) return;
    const pending = links.find((l) => l.earliestSyncedAt && !l.metadataBackfilled);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async repair; its own setState calls happen after this effect body returns
    if (pending) refreshHistory(pending.monobankAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-check when connection/error/links/sync state actually changes
  }, [status, links, syncingId, error]);

  // Webhook-driven near-real-time sync (peek-then-ack against the server
  // queue) now runs app-wide via useMonobankWebhookSync(), mounted once at
  // the root layout — not here, since this hook only mounts on the
  // /balance/monobank settings page, which used to mean a real purchase sat
  // unclaimed server-side until the user happened to open that exact page.

  return {
    status,
    monoAccounts,
    links,
    error,
    syncingId,
    backfillProgress,
    corpConnectStatus,
    connect,
    connectViaApp,
    disconnect,
    link,
    unlink: removeLink,
    sync,
    loadOlderHistory,
    refreshHistory,
    currencySymbol: currencySymbolFor,
    labelFor,
  };
}
