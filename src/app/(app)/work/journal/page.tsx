"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { TradeForm } from "@/components/work/TradeForm";
import { TradeItem } from "@/components/work/TradeItem";
import { AccountSelector } from "@/components/work/AccountSelector";
import { TradingAccountForm } from "@/components/work/TradingAccountForm";
import { EquityChart, type EquityChartType } from "@/components/work/EquityChart";
import { MT5ImportSheet } from "@/components/work/MT5ImportSheet";
import { BybitConnectSheet } from "@/components/work/BybitConnectSheet";
import { CURRENCIES, useAppStore } from "@/lib/store";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts } from "@/lib/trading-accounts";
import { usePersonalTradingAccountsStore } from "@/lib/personal-trading-accounts-store";
import { usePropAccountsStore } from "@/lib/prop-accounts-store";
import { computeTradePnL } from "@/lib/trade-calculations";
import { formatDateKey } from "@/lib/calendar-utils";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";
import { BarChartIcon, GearIcon, TrendingUpIcon, HourglassIcon, UploadIcon, RefreshIcon } from "@/components/icons";

type StatusFilter = "all" | "open" | "closed";

const CHART_TYPES: { id: EquityChartType; label: string; icon: React.ReactNode }[] = [
  { id: "line", label: "Крива", icon: <TrendingUpIcon className="h-3 w-3" /> },
  { id: "bar", label: "Стовпчики", icon: <BarChartIcon className="h-3 w-3" /> },
  { id: "drawdown", label: "Просадка", icon: <HourglassIcon className="h-3 w-3" /> },
];

export default function JournalPage() {
  const isTrader = useTraderOnlyGuard();
  const currencyId = useAppStore((s) => s.settings.currency);
  const currencySymbol = CURRENCIES.find((c) => c.id === currencyId)?.symbol ?? "₴";

  const { trades, addTrade, updateTrade, removeTrade } = useJournalStore();
  const { instruments, tags, sessions } = useJournalConfigStore();
  const accounts = useTradingAccounts();
  const { addAccount: addPersonalAccount } = usePersonalTradingAccountsStore();
  const { addAccount: addPropAccount } = usePropAccountsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bybitOpen, setBybitOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<EquityChartType>("line");

  const activeAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;

  const instrumentById = useMemo(() => new Map(instruments.map((i) => [i.id, i])), [instruments]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const sessionById = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const accountTrades = useMemo(
    () => trades.filter((t) => t.accountId === activeAccountId),
    [trades, activeAccountId]
  );

  const enriched = useMemo(
    () =>
      accountTrades.map((t) => ({
        trade: t,
        instrument: instrumentById.get(t.instrumentId),
        pnl: computeTradePnL(t, instrumentById.get(t.instrumentId)),
      })),
    [accountTrades, instrumentById]
  );

  const closed = enriched.filter((e) => e.trade.status === "closed" && e.pnl.net !== null);
  const wins = closed.filter((e) => (e.pnl.net ?? 0) > 0);
  const losses = closed.filter((e) => (e.pnl.net ?? 0) <= 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const netTotal = closed.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0);
  const grossWin = wins.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : "—";
  const openCount = accountTrades.filter((t) => t.status === "open").length;

  const equityDeltas = [...closed]
    .sort((a, b) => `${a.trade.date}${a.trade.time}`.localeCompare(`${b.trade.date}${b.trade.time}`))
    .map((e) => e.pnl.net ?? 0);

  const filtered = enriched.filter((e) =>
    statusFilter === "all" ? true : e.trade.status === statusFilter
  );

  function handleAddPersonalAccount(data: Parameters<typeof addPersonalAccount>[0]) {
    const id = addPersonalAccount(data);
    setSelectedAccountId(id);
    setAccountFormOpen(false);
  }

  function handleAddPropAccount(data: Parameters<typeof addPropAccount>[0]) {
    addPropAccount(data);
    const latest = usePropAccountsStore.getState().accounts;
    const created = latest[latest.length - 1];
    if (created) setSelectedAccountId(created.id);
    setAccountFormOpen(false);
  }

  function openAddForm() {
    setEditingTrade(null);
    setFormOpen(true);
  }

  function openEditForm(trade: Trade) {
    setEditingTrade(trade);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingTrade(null);
  }

  function handleSave(data: Omit<Trade, "id">) {
    if (editingTrade) {
      updateTrade(editingTrade.id, data);
    } else {
      addTrade(data);
    }
    closeForm();
  }

  function handleDelete(id: string) {
    removeTrade(id);
    closeForm();
  }

  if (!isTrader) return null;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <WorkSubpageHeader
          title="Журнал угод"
          subtitle={`${accountTrades.length} угод · ${openCount} відкрито · win rate ${winRate}%`}
        />
        <div className="mt-2 flex flex-shrink-0 gap-1.5">
          <button
            onClick={() => setBybitOpen(true)}
            className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-2 text-[11.5px] font-semibold text-text-dim"
          >
            <RefreshIcon className="h-3 w-3" /> Bybit
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-2 text-[11.5px] font-semibold text-text-dim"
          >
            <UploadIcon className="h-3 w-3" /> MT5
          </button>
          <button
            onClick={openAddForm}
            className="rounded-full bg-accent px-3.5 py-2 text-[11.5px] font-semibold text-bg"
          >
            + угода
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <button
          onClick={() => setAccountFormOpen(true)}
          className="mb-3 block w-full rounded-card-sm bg-surface shadow-card py-6 text-center text-[11.5px] text-text-faint"
        >
          Ще немає рахунків — додай перший, щоб почати вести журнал
        </button>
      ) : (
        <AccountSelector
          accounts={accounts}
          selectedId={activeAccountId}
          onSelect={setSelectedAccountId}
          onAdd={() => setAccountFormOpen(true)}
          currencySymbol={currencySymbol}
        />
      )}

      <div className="mb-3 grid grid-cols-4 gap-2">
        <div className="rounded-card-sm bg-surface shadow-card p-2 text-center">
          <div className="text-[8px] uppercase text-text-faint">Net P&L</div>
          <div className={cn("font-mono text-[13px] font-bold", netTotal >= 0 ? "text-sage" : "text-rose")}>
            {netTotal >= 0 ? "+" : ""}
            {netTotal.toFixed(0)} {currencySymbol}
          </div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2 text-center">
          <div className="text-[8px] uppercase text-text-faint">Win rate</div>
          <div className="font-mono text-[13px] font-bold text-text">{winRate}%</div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2 text-center">
          <div className="text-[8px] uppercase text-text-faint">P. Factor</div>
          <div className="font-mono text-[13px] font-bold text-gold">{profitFactor}</div>
        </div>
        <div className="rounded-card-sm bg-surface shadow-card p-2 text-center">
          <div className="text-[8px] uppercase text-text-faint">Угод</div>
          <div className="font-mono text-[13px] font-bold text-text">{accountTrades.length}</div>
        </div>
      </div>

      {activeAccount && (
        <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10.5px] text-text-dim">{activeAccount.name}</div>
            <div className="font-mono text-[15px] font-bold text-sage">
              {activeAccount.kind === "personal"
                ? `${activeAccount.balance.toFixed(0)} ${currencySymbol}`
                : `${activeAccount.profitPct}% / ${activeAccount.profitTarget}%`}
            </div>
          </div>
          <div className="mb-3 flex rounded-[10px] bg-surface-2 p-[3px]">
            {CHART_TYPES.map((c) => (
              <button
                key={c.id}
                onClick={() => setChartType(c.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-[7px] py-1.5 text-[10px] font-semibold",
                  chartType === c.id ? "bg-bg text-sage" : "text-text-faint"
                )}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <EquityChart
            type={chartType}
            deltas={equityDeltas}
            maxDrawdownPct={activeAccount.kind === "prop" ? activeAccount.maxDrawdown : undefined}
          />
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <Link
          href={activeAccountId ? `/work/journal/stats?accountId=${activeAccountId}` : "/work/journal/stats"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card py-2 text-center text-[11px] font-semibold text-text-dim"
        >
          <BarChartIcon className="h-3.5 w-3.5" /> Статистика
        </Link>
        <Link
          href="/work/journal/library"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card py-2 text-center text-[11px] font-semibold text-text-dim"
        >
          <GearIcon className="h-3.5 w-3.5" /> Інструменти й теги
        </Link>
      </div>

      <div className="mb-3 flex rounded-xl border border-border bg-surface p-1">
        {([
          ["all", "Всі"],
          ["open", "Відкриті"],
          ["closed", "Закриті"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-center text-[11.5px] font-semibold",
              statusFilter === key ? "bg-surface-2 text-text" : "text-text-faint"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-card-sm bg-surface shadow-card py-8 text-center text-[11.5px] text-text-faint">
          Немає угод у цій категорії
        </div>
      )}

      {filtered.map(({ trade: t, instrument, pnl }) => (
        <TradeItem
          key={t.id}
          trade={t}
          instrument={instrument}
          pnl={pnl}
          currencySymbol={currencySymbol}
          session={t.sessionId ? sessionById.get(t.sessionId) : undefined}
          tags={t.tagIds.map((id) => tagById.get(id)).filter((tag): tag is NonNullable<typeof tag> => !!tag)}
          onClick={() => openEditForm(t)}
        />
      ))}

      {formOpen && (
        <TradeForm
          initialDateKey={formatDateKey(new Date())}
          editingTrade={editingTrade}
          accounts={accounts}
          defaultAccountId={activeAccountId}
          onSave={handleSave}
          onClose={closeForm}
          onDelete={editingTrade ? handleDelete : undefined}
        />
      )}

      {accountFormOpen && (
        <TradingAccountForm
          onSavePersonal={handleAddPersonalAccount}
          onSaveProp={handleAddPropAccount}
          onClose={() => setAccountFormOpen(false)}
        />
      )}

      {importOpen && <MT5ImportSheet accountId={activeAccountId} onClose={() => setImportOpen(false)} />}
      {bybitOpen && <BybitConnectSheet accountId={activeAccountId} onClose={() => setBybitOpen(false)} />}
    </div>
  );
}
