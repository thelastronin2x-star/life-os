"use client";

import { useEffect, useState } from "react";
import { FinanceSubpageHeader } from "@/components/finance/FinanceSubpageHeader";
import { useFinanceStore } from "@/lib/finance-store";
import { useMonobank, currencySymbolFor, labelFor, type MonobankAccountInfo, type BackfillProgress } from "@/lib/use-monobank";
import { useMonobankLinkStore } from "@/lib/monobank-store";
import { BankIcon, RefreshIcon, UploadIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/currency-format";
import { findOrphanDuplicates, removeOrphanDuplicates, type OrphanDuplicate } from "@/lib/duplicate-check";
import { downloadLocalFinanceBackup, useLocalDataMigration } from "@/lib/use-local-data-migration";

interface AccountRowProps {
  account: MonobankAccountInfo;
  link: (account: MonobankAccountInfo, localAccountId: string) => void;
  sync: (monobankAccountId: string) => void;
  loadOlderHistory: (monobankAccountId: string) => void;
  refreshHistory: (monobankAccountId: string) => void;
  syncingId: string | null;
  backfillProgress: BackfillProgress | null;
}

function AccountRow({ account, link, sync, loadOlderHistory, refreshHistory, syncingId, backfillProgress }: AccountRowProps) {
  const { accounts } = useFinanceStore();
  const { links, removeLink: unlink } = useMonobankLinkStore();

  const existingLink = links.find((l) => l.monobankAccountId === account.id);
  const localAccount = existingLink ? accounts.find((a) => a.id === existingLink.localAccountId) : null;
  const symbol = currencySymbolFor(account.currencyCode);

  // Local accounts already linked to a DIFFERENT Monobank card — picking one
  // of these would make two cards silently fight over the same account's
  // starting balance on every reconciliation cycle (each one anchoring it to
  // their own live balance minus the OTHER card's transactions too).
  const takenLocalAccountIds = new Set(links.map((l) => l.localAccountId));
  const freeAccounts = accounts.filter((a) => !takenLocalAccountIds.has(a.id));
  const [selectedLocalId, setSelectedLocalId] = useState(freeAccounts[0]?.id ?? "");

  return (
    <div className="card-raised mb-2.5 rounded-card-sm bg-surface p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-text">{labelFor(account)}</div>
        <div className="font-mono text-[13px] font-semibold text-text">
          {formatCurrency(account.balance / 100, symbol)}
        </div>
      </div>

      {existingLink ? (
        <>
          <div className="mb-2 text-[11px] text-text-faint">
            Прив&apos;язано до: <span className="text-text-dim">{localAccount?.name ?? "—"}</span>
            {existingLink.lastSyncedAt && (
              <>
                {" "}
                · остання синхр.{" "}
                {new Date(existingLink.lastSyncedAt).toLocaleString("uk-UA", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => sync(account.id)}
              disabled={syncingId === account.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-btn bg-accent py-2 text-center text-[11.5px] font-semibold text-bg disabled:opacity-50"
            >
              <RefreshIcon className="h-3 w-3" /> {syncingId === account.id ? "Синхронізація…" : "Синхронізувати"}
            </button>
            <button
              onClick={() => unlink(account.id)}
              className="rounded-btn border border-border px-3 py-2 text-[11.5px] font-semibold text-text-faint"
            >
              Відв&apos;язати
            </button>
          </div>
          {existingLink.earliestSyncedAt && !existingLink.historyExhausted && (
            <button
              onClick={() => loadOlderHistory(account.id)}
              disabled={syncingId === account.id}
              className="mt-2 w-full text-center text-[10.5px] text-text-faint underline disabled:opacity-50"
            >
              Довантажити старішу історію
            </button>
          )}
          {existingLink.historyExhausted && (
            <div className="mt-2 text-center text-[10.5px] text-text-faint">Історію завантажено повністю</div>
          )}
          {existingLink.earliestSyncedAt && (
            <>
              {backfillProgress && syncingId === account.id ? (
                <div className="mt-2 text-center text-[10px] text-text-faint">
                  {backfillProgress.phase === "extending"
                    ? `Автоматичне оновлення історії… пошук початку (крок ${backfillProgress.probed})`
                    : `Автоматичне оновлення історії… ${backfillProgress.current}/${backfillProgress.total}`}
                  <br />
                  це відбувається само, можеш просто закрити застосунок
                </div>
              ) : existingLink.metadataBackfilled ? (
                <button
                  onClick={() => refreshHistory(account.id)}
                  disabled={syncingId === account.id}
                  className="mt-2 w-full text-center text-[10.5px] text-text-faint underline disabled:opacity-50"
                >
                  Перевірити історію ще раз
                </button>
              ) : (
                <div className="mt-2 text-center text-[10px] text-text-faint">
                  Очікує на автоматичне оновлення історії…
                </div>
              )}
            </>
          )}
        </>
      ) : accounts.length === 0 ? (
        <div className="text-[11px] text-text-faint">Спочатку додай рахунок у &quot;Баланс → Фінанси&quot;</div>
      ) : freeAccounts.length === 0 ? (
        <div className="text-[11px] text-text-faint">
          Усі рахунки вже прив&apos;язані до інших карток — спочатку додай новий рахунок у &quot;Баланс → Фінанси&quot;
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedLocalId}
            onChange={(e) => setSelectedLocalId(e.target.value)}
            className="flex-1 rounded-input border border-border bg-surface-2 px-2 py-2 text-[12px] text-text outline-none"
          >
            {freeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => link(account, selectedLocalId)}
            className="rounded-btn bg-accent px-3.5 py-2 text-[11.5px] font-semibold text-bg"
          >
            Прив&apos;язати
          </button>
        </div>
      )}
    </div>
  );
}

export default function MonobankPage() {
  const {
    status,
    monoAccounts,
    error,
    connect,
    connectViaApp,
    corpConnectStatus,
    disconnect,
    link,
    sync,
    loadOlderHistory,
    refreshHistory,
    syncingId,
    backfillProgress,
  } = useMonobank();
  const corpEnabled = process.env.NEXT_PUBLIC_MONOBANK_CORP_ENABLED === "1";
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [duplicates, setDuplicates] = useState<OrphanDuplicate[] | null>(null);
  const { migratedAt, isMigrating, result: migrationResult, error: migrationError, migrate } = useLocalDataMigration();
  const [confirmingMigration, setConfirmingMigration] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time local scan, not derived render state
    if (status === "connected") setDuplicates(findOrphanDuplicates());
  }, [status]);

  function handleRemoveDuplicates() {
    if (!duplicates) return;
    removeOrphanDuplicates(duplicates);
    setDuplicates([]);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setConnecting(true);
    await connect(token.trim());
    setConnecting(false);
    setToken("");
  }

  function handleDownloadBackup() {
    downloadLocalFinanceBackup();
    setConfirmingMigration(true);
  }

  return (
    <div>
      <FinanceSubpageHeader
        title="Monobank"
        subtitle={status === "connected" ? "Підключено" : "Синхронізація виписки з карткою"}
      />

      {status === "loading" && <div className="py-8 text-center text-[11.5px] text-text-faint">Завантаження…</div>}

      {status === "disconnected" && (
        <>
          {error && <div className="mb-2.5 text-[11px] text-rose">{error}</div>}

          {corpEnabled && (
            <div className="card-raised mb-2.5 rounded-card-sm bg-surface p-3.5">
              <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-text">
                <BankIcon className="h-4 w-4 text-text-dim" /> Підключити одним тапом
              </div>
              <div className="mb-3 text-[11px] leading-relaxed text-text-faint">
                Відкриється застосунок Monobank — підтверди доступ там, повертатись і щось копіювати не треба.
              </div>
              {corpConnectStatus === "waiting" ? (
                <div className="w-full rounded-btn border border-border py-2.5 text-center text-[12.5px] font-semibold text-text-faint">
                  Очікування підтвердження в застосунку…
                </div>
              ) : (
                <button
                  onClick={connectViaApp}
                  className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
                >
                  Відкрити застосунок Monobank
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleConnect} className="card-raised rounded-card-sm bg-surface p-3.5">
            <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-text">
              <BankIcon className="h-4 w-4 text-text-dim" /> Підключити токен
            </div>
            <div className="mb-3 text-[11px] leading-relaxed text-text-faint">
              Згенеруй особистий токен на{" "}
              <a href="https://api.monobank.ua" target="_blank" rel="noreferrer" className="text-sage underline">
                api.monobank.ua
              </a>{" "}
              (вхід через QR у застосунку Monobank) і встав його сюди. Токен шифрується і зберігається лише на сервері.
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Особистий токен"
              className="mb-2.5 w-full rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
            />
            <button
              type="submit"
              disabled={connecting || !token.trim()}
              className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg disabled:opacity-50"
            >
              {connecting ? "Перевірка…" : "Підключити"}
            </button>
          </form>
        </>
      )}

      {status === "connected" && (
        <>
          {error && (
            <div className="mb-2.5 rounded-card-sm bg-rose-soft p-2.5 text-[11px] text-rose">{error}</div>
          )}
          {duplicates && duplicates.length > 0 && (
            <div className="mb-2.5 rounded-card-sm bg-gold-soft p-3">
              <div className="mb-1.5 text-[11.5px] font-semibold text-text">
                Знайдено {duplicates.length} можливих дублікатів
              </div>
              <div className="mb-2 text-[10.5px] leading-relaxed text-text-faint">
                Старі записи без синхронізованого часу, які, схоже, дублюють іншу — вже повну — транзакцію
                (та сама назва, сума й рахунок, дати близько одна до одної). Типово залишається від операцій, які
                спочатку були &quot;hold&quot; ще до того, як застосунок навчився це відрізняти.
              </div>
              <div className="mb-2 max-h-28 overflow-y-auto rounded-input bg-surface p-2 text-[10.5px] text-text-dim">
                {duplicates.map((d) => (
                  <div key={d.orphanId} className="py-0.5">
                    {d.title} — {d.amount}
                  </div>
                ))}
              </div>
              <button
                onClick={handleRemoveDuplicates}
                className="w-full rounded-btn bg-gold py-2 text-center text-[11.5px] font-semibold text-bg"
              >
                Видалити {duplicates.length} дублікатів
              </button>
            </div>
          )}
          {monoAccounts.length === 0 && (
            <div className="card-raised rounded-card-sm bg-surface py-8 text-center text-[11.5px] text-text-faint">
              Рахунків не знайдено
            </div>
          )}
          {monoAccounts.map((acc) => (
            <AccountRow
              key={acc.id}
              account={acc}
              link={link}
              sync={sync}
              loadOlderHistory={loadOlderHistory}
              refreshHistory={refreshHistory}
              syncingId={syncingId}
              backfillProgress={backfillProgress}
            />
          ))}

          <div className="card-raised mb-2.5 mt-2 rounded-card-sm bg-surface p-3.5">
            <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-text">
              <UploadIcon className="h-4 w-4 text-text-dim" /> Перенести історію на сервер
            </div>
            <div className="mb-2.5 text-[11px] leading-relaxed text-text-faint">
              Одноразово копіює локальну історію транзакцій (включно з ручними записами) на сервер. Безпечно
              запускати повторно — уже перенесене не дублюється.
              {migratedAt && (
                <>
                  {" "}
                  Востаннє: {new Date(migratedAt).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.
                </>
              )}
            </div>

            {migrationError && <div className="mb-2 text-[11px] text-rose">{migrationError}</div>}

            {migrationResult && (
              <div className="mb-2 text-[11px] text-text-dim">
                Перенесено: {migrationResult.migrated} · вже було: {migrationResult.alreadyExisted}
                {migrationResult.skippedTransfers > 0 && <> · пропущено переказів: {migrationResult.skippedTransfers}</>}
              </div>
            )}

            {!confirmingMigration ? (
              <button
                onClick={handleDownloadBackup}
                className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
              >
                Завантажити резервну копію й перенести
              </button>
            ) : (
              <button
                onClick={migrate}
                disabled={isMigrating}
                className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg disabled:opacity-50"
              >
                {isMigrating ? "Перенесення…" : "Резервна копія завантажена — перенести зараз"}
              </button>
            )}
          </div>

          <button
            onClick={disconnect}
            className="mt-2 w-full rounded-btn border border-rose/30 py-2.5 text-center text-[12.5px] font-semibold text-rose"
          >
            Відключити Monobank
          </button>
        </>
      )}
    </div>
  );
}
