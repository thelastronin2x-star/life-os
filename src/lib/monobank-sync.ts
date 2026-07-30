"use client";

import { useMonobankLinkStore, type MonobankLink } from "./monobank-store";
import { importMonobankTransactions, reconcileBalanceFromLiveBalance } from "./monobank-import";
import type { BankAccount, BankTransaction } from "./bank-source";

const MAX_RANGE_SECONDS = 31 * 24 * 60 * 60;

// Roughly matches Monobank's own ~1-request-per-60s limit on client-info.
const LIVE_ACCOUNTS_CACHE_TTL_MS = 60_000;

// Same shape as BankAccount — kept as its own name since it's this client
// sync module's established public contract (used across use-monobank.ts
// and the Monobank settings page), not something callers should need to
// know is currently backed by BankDataSource.
export type MonobankAccountInfo = BankAccount;

async function fetchStatementRange(monobankAccountId: string, from: number, to: number): Promise<BankTransaction[]> {
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
}

interface LiveAccountsResult {
  accounts: MonobankAccountInfo[];
  error: "rate_limited" | "failed" | null;
}

let cachedResult: LiveAccountsResult | null = null;
let cachedAt = 0;
let inFlightFetch: Promise<LiveAccountsResult> | null = null;

/** Test-only escape hatch — the cache is intentionally module-level state so
 *  it's shared across every caller in the running app, but that same
 *  persistence bleeds across otherwise-independent test cases unless it's
 *  reset between them. */
export function __resetLiveMonobankAccountsCacheForTests(): void {
  cachedResult = null;
  cachedAt = 0;
  inFlightFetch = null;
}

async function fetchLiveMonobankAccountsRaw(): Promise<LiveAccountsResult> {
  const res = await fetch("/api/finance/monobank/accounts");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { accounts: [], error: data.error === "rate_limited" ? "rate_limited" : "failed" };
  }
  const data: { accounts?: MonobankAccountInfo[] } = await res.json();
  return { accounts: data.accounts ?? [], error: null };
}

/** Fetches every linked account's live balance/info, sharing ONE request
 *  across every caller within a ~60s TTL instead of each firing their own —
 *  this app has at least three independent consumers (page-mount refresh,
 *  manual "Синхронізувати", periodic background sync), and Monobank's
 *  client-info endpoint only allows roughly 1 request per 60s. Without this,
 *  whichever consumer asks second within that window is guaranteed a 429 —
 *  which is exactly what caused the reconciliation bug fixed earlier: the
 *  page's own mount-time fetch was consuming the limit moments before the
 *  first sync attempt tried to reconcile.
 *
 *  Concurrent callers share the same in-flight request. A failed/rate-
 *  limited result is never cached (so the next call tries again rather than
 *  being stuck returning empty for the rest of the TTL window). */
async function fetchLiveMonobankAccountsShared(): Promise<LiveAccountsResult> {
  const now = Date.now();
  if (cachedResult && now - cachedAt < LIVE_ACCOUNTS_CACHE_TTL_MS) return cachedResult;
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = fetchLiveMonobankAccountsRaw()
    .then((result) => {
      if (result.error === null) {
        cachedResult = result;
        cachedAt = Date.now();
      }
      return result;
    })
    .finally(() => {
      inFlightFetch = null;
    });

  return inFlightFetch;
}

/** Accounts-only accessor for reconciliation callers that don't need to know
 *  WHY the list might be empty (see reconcileMonobankLink/syncMonobankAccount) —
 *  a rate limit and "genuinely zero accounts" are handled identically there
 *  (skip this cycle, try again next time). */
export async function fetchLiveMonobankAccounts(): Promise<MonobankAccountInfo[]> {
  return (await fetchLiveMonobankAccountsShared()).accounts;
}

/** Richer accessor for UI callers (the Monobank settings page) that want to
 *  surface a specific message when the fetch didn't just return "no
 *  accounts" but genuinely failed or got rate-limited. */
export async function fetchLiveMonobankAccountsWithError(): Promise<LiveAccountsResult> {
  return fetchLiveMonobankAccountsShared();
}

/** Attempts to reconcile a link's local starting balance against Monobank's
 *  live account balance — the ONE place this happens, used by every entry
 *  point that imports transactions (manual sync, periodic sync, history
 *  backfill) so they can't drift out of sync with each other. That
 *  divergence is exactly what caused the original bug this fixes: the
 *  manual "Синхронізувати" button had its own fallback reconciliation path
 *  that the background periodic sync didn't, so a second linked card (which
 *  only ever synced via the background path) could get stuck with a
 *  negative starting balance forever while the first card, synced at least
 *  once by hand, was fine.
 *
 *  Reconciles against Monobank's own live account balance (client-info),
 *  NOT any transaction's embedded `balance` field. A transaction's own
 *  `balance` reflects whatever the account's available balance happened to
 *  be at that exact moment — which can be reduced by ANY hold active at the
 *  time, not just a hold on that specific transaction. Since our local
 *  ledger only ever records settled transactions (holds are deliberately
 *  never imported — see importMonobankTransactions), reconciling against a
 *  hold-affected reading pulls the displayed balance down with nothing in
 *  the ledger to explain it. The live account balance is refreshed every
 *  cycle instead, so it's always Monobank's current, authoritative number.
 *
 *  Accepts an optional pre-fetched `liveAccounts` list (see
 *  fetchLiveMonobankAccounts) so syncing several links in one cycle doesn't
 *  redundantly re-fetch the same account list once per link. Returns
 *  whether reconciliation actually happened this call — client-info being
 *  rate-limited or briefly unreachable is expected and not an error, just a
 *  "try again next cycle". */
export async function reconcileMonobankLink(link: MonobankLink, liveAccounts?: MonobankAccountInfo[]): Promise<boolean> {
  const accounts = liveAccounts ?? (await fetchLiveMonobankAccounts());
  const liveAccount = accounts.find((a) => a.id === link.monobankAccountId);
  if (!liveAccount) return false;
  reconcileBalanceFromLiveBalance(link.localAccountId, liveAccount.balance);
  useMonobankLinkStore.getState().setReconciled(link.monobankAccountId, new Date().toISOString());
  return true;
}

/** Fetches and imports everything new since the link's last sync, then
 *  reconciles the account balance — the core of the manual "Синхронізувати"
 *  button, extracted so it can also run silently on a timer (see
 *  use-monobank-periodic-sync.ts) without the user ever pressing anything. */
export async function syncMonobankAccount(
  link: MonobankLink,
  liveAccounts?: MonobankAccountInfo[]
): Promise<{ added: number; reconciled: boolean }> {
  const to = Math.floor(Date.now() / 1000);
  const from = link.lastSyncedAt
    ? Math.max(Math.floor(new Date(link.lastSyncedAt).getTime() / 1000), to - MAX_RANGE_SECONDS)
    : to - MAX_RANGE_SECONDS;

  const raw = await fetchStatementRange(link.monobankAccountId, from, to);
  const added = importMonobankTransactions(raw, link.localAccountId);

  const reconciled = await reconcileMonobankLink(link, liveAccounts);

  // Only advance the sync cursor once this link has reconciled at least
  // once (now or previously) — a link that has NEVER reconciled must keep
  // re-attempting on every future sync (same window re-fetched, harmless
  // thanks to dedup) rather than being marked "caught up" while its starting
  // balance is still an unanchored guess. Once a link has reconciled at
  // least once, a single missed cycle just means the balance is briefly
  // stale, not structurally wrong, so it's safe to advance regardless.
  if (reconciled || link.reconciledAt) {
    useMonobankLinkStore.getState().setLastSynced(link.monobankAccountId, new Date().toISOString());
  }
  if (!link.earliestSyncedAt) {
    useMonobankLinkStore.getState().setEarliestSynced(link.monobankAccountId, new Date(from * 1000).toISOString());
  }

  return { added, reconciled };
}
