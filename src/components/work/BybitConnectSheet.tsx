"use client";

import { useState } from "react";
import { useBybit } from "@/lib/use-bybit";
import { RefreshIcon, BankIcon } from "@/components/icons";

// A key without IP binding stops working after ~90 days regardless of use —
// flagging staleness well before that means a silently-dead key gets noticed
// (and reconnected) instead of just quietly stopping.
const STALE_SYNC_DAYS = 14;

export function BybitConnectSheet({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const {
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
  } = useBybit();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setConnecting(true);
    const ok = await connect(apiKey.trim(), apiSecret.trim());
    setConnecting(false);
    if (ok) {
      setApiKey("");
      setApiSecret("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Bybit</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        {status === "loading" && <div className="py-6 text-center text-[11.5px] text-text-faint">Завантаження…</div>}

        {status === "disconnected" && (
          <form onSubmit={handleConnect}>
            <div className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-text">
              <BankIcon className="h-4 w-4 text-text-dim" /> Підключити API-ключ
            </div>
            <div className="mb-3 space-y-1.5 text-[11px] leading-relaxed text-text-faint">
              <p>
                У Bybit: Профіль → API → Створити ключ → права лише <b>«Read-Only»</b>. Ключ і секрет шифруються і
                зберігаються тільки на сервері, ніколи в браузері.
              </p>
              <p>
                Ключ <b>без</b>{" "}
                прив&apos;язки до IP автоматично втрачає чинність приблизно через 90 днів — одного дня синхронізація
                просто перестане працювати.
              </p>
              <p>
                Ключ <b>із</b>{" "}
                прив&apos;язкою до IP тут не працюватиме взагалі — адреси серверів Vercel динамічні.
              </p>
            </div>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key"
              className="mb-2 w-full rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
            />
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="API Secret"
              className="mb-2.5 w-full rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
            />
            {error && <div className="mb-2.5 text-[11px] text-rose">{error}</div>}
            <button
              type="submit"
              disabled={connecting || !apiKey.trim() || !apiSecret.trim()}
              className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg disabled:opacity-50"
            >
              {connecting ? "Перевірка…" : "Підключити"}
            </button>
          </form>
        )}

        {status === "connected" && (
          <>
            {(() => {
              const daysSinceSync = lastSyncedAt ? (new Date().getTime() - new Date(lastSyncedAt).getTime()) / (24 * 60 * 60 * 1000) : null;
              const isStale = daysSinceSync !== null && daysSinceSync > STALE_SYNC_DAYS;
              return (
                <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3.5">
                  <div className="mb-1 text-[13px] font-semibold text-text">Підключено</div>
                  <div className={`text-[11px] ${isStale ? "text-rose" : "text-text-faint"}`}>
                    {lastSyncedAt
                      ? `Остання синхр. ${new Date(lastSyncedAt).toLocaleString("uk-UA", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Ще не синхронізовано"}
                    {isStale && " — давно немає синхронізації, можливо, ключ протух"}
                  </div>
                </div>
              );
            })()}

            {!accountId && <div className="mb-3 text-[11.5px] text-rose">Спочатку обери рахунок у Журналі.</div>}
            {error && <div className="mb-3 text-[11px] text-rose">{error}</div>}
            {lastSyncSummary && (
              <div className="mb-3 text-[11.5px] text-text-dim">
                Імпортовано {lastSyncSummary.imported} нових
                {lastSyncSummary.duplicates > 0 && `, пропущено ${lastSyncSummary.duplicates} вже наявних`}
              </div>
            )}

            <button
              onClick={() => accountId && sync(accountId)}
              disabled={syncing || !accountId}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg disabled:opacity-50"
            >
              <RefreshIcon className="h-3.5 w-3.5" /> {syncing ? "Синхронізація…" : "Синхронізувати"}
            </button>

            {earliestSyncedAt && !historyExhausted && (
              <>
                {backfillProgress ? (
                  <div className="mb-2 text-center text-[10.5px] text-text-faint">
                    Довантаження історії… тижнів опрацьовано: {backfillProgress.windowsProcessed}
                  </div>
                ) : (
                  <div className="mb-2 flex gap-2">
                    <button
                      onClick={() => accountId && loadOlderHistory(accountId)}
                      disabled={syncing || !accountId}
                      className="flex-1 text-center text-[10.5px] text-text-faint underline disabled:opacity-50"
                    >
                      Довантажити тиждень
                    </button>
                    <button
                      onClick={() => accountId && loadOlderHistoryFor(accountId, 90)}
                      disabled={syncing || !accountId}
                      className="flex-1 text-center text-[10.5px] text-text-faint underline disabled:opacity-50"
                    >
                      Довантажити 3 місяці
                    </button>
                  </div>
                )}
              </>
            )}
            {historyExhausted && (
              <div className="mb-2 text-center text-[10.5px] text-text-faint">Історію завантажено повністю</div>
            )}

            <button
              onClick={disconnect}
              className="w-full rounded-btn border border-rose/30 py-2.5 text-center text-[12.5px] font-semibold text-rose"
            >
              Відключити Bybit
            </button>
          </>
        )}
      </div>
    </div>
  );
}
