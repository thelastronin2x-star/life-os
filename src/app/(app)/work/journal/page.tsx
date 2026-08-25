"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { TradeForm } from "@/components/work/TradeForm";
import { TradeItem } from "@/components/work/TradeItem";
import { TradeDetailSheet } from "@/components/work/TradeDetailSheet";
import { AccountSelector } from "@/components/work/AccountSelector";
import { TradingAccountForm } from "@/components/work/TradingAccountForm";
import { EquityChart, type EquityChartType } from "@/components/work/EquityChart";
import { MT5ImportSheet } from "@/components/work/MT5ImportSheet";
import { JournalCalendarView, type DayNet } from "@/components/work/JournalCalendarView";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts } from "@/lib/trading-accounts";
import { usePersonalTradingAccountsStore } from "@/lib/personal-trading-accounts-store";
import { usePropAccountsStore } from "@/lib/prop-accounts-store";
import { computeTradePnL } from "@/lib/trade-calculations";
import { formatDateKey } from "@/lib/calendar-utils";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";
import {
  BarChartIcon,
  GearIcon,
  TrendingUpIcon,
  HourglassIcon,
  UploadIcon,
  ListIcon,
  GridIcon,
} from "@/components/icons";

type StatusFilter = "all" | "followed" | "broke" | "open" | "closed";
type ViewMode = "list" | "calendar";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі" },
  { id: "followed", label: "За планом" },
  { id: "broke", label: "Порушення" },
  { id: "open", label: "Відкриті" },
  { id: "closed", label: "Закриті" },
];

const CHART_TYPES: { id: EquityChartType; label: string; icon: React.ReactNode }[] = [
  { id: "line", label: "Крива", icon: <TrendingUpIcon className="h-3 w-3" /> },
  { id: "bar", label: "Стовпчики", icon: <BarChartIcon className="h-3 w-3" /> },
  { id: "drawdown", label: "Просадка", icon: <HourglassIcon className="h-3 w-3" /> },
];

export default function JournalPage() {
  const isTrader = useTraderOnlyGuard();

  const { trades, addTrade, updateTrade, removeTrade } = useJournalStore();
  const { instruments, tags, sessions } = useJournalConfigStore();
  const accounts = useTradingAccounts();
  const { addAccount: addPersonalAccount } = usePersonalTradingAccountsStore();
  const { addAccount: addPropAccount } = usePropAccountsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  // Tapping a row opens the read view; editing is one deliberate step further.
  // Looking at a trade is much more frequent than changing one, and a form
  // full of inputs is a poor way to read.
  const [viewingTradeId, setViewingTradeId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<EquityChartType>("line");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  const activeAccountId = selectedAccountId ?? accounts[0]?.id ?? null;
  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null;
  // The account's own denomination. Falls back to $ rather than to the app's
  // display currency: an unlabelled trading account is a dollar account, and
  // showing "₴" over a USDT result was the bug this replaces.
  const currencySymbol = activeAccount?.currencySymbol ?? "$";

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

  const filtered = enriched.filter((e) => {
    if (dateFilter && e.trade.date !== dateFilter) return false;
    if (statusFilter === "open" || statusFilter === "closed") return e.trade.status === statusFilter;
    if (statusFilter === "followed") return e.trade.followedPlan === true;
    if (statusFilter === "broke") return e.trade.followedPlan === false;
    return true;
  });

  /** Trades bundled into the days they happened on, newest day first, each
   *  with its own net result.
   *
   *  A trader's unit of reflection is the day, not the individual trade —
   *  "today I'm green" is what you actually carry around. A flat list forces
   *  you to add the rows up by eye to answer that, which is exactly the sort
   *  of arithmetic the app should be doing. */
  const days = useMemo(() => {
    const byDate = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const list = byDate.get(e.trade.date) ?? [];
      list.push(e);
      byDate.set(e.trade.date, list);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({
        date,
        trades: [...list].sort((a, b) => b.trade.time.localeCompare(a.trade.time)),
        // Open trades have no net yet and must not drag the day's total to
        // zero — they're simply not part of a realised result.
        net: list.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0),
        hasClosed: list.some((e) => e.pnl.net !== null),
      }));
  }, [filtered]);

  // Calendar month view is its own lens on the account's whole history —
  // unlike the list below, it isn't affected by the status-filter chips, so
  // it's built from `enriched` (every trade on the active account) rather
  // than `filtered`.
  const netByDay = useMemo(() => {
    const map = new Map<string, DayNet>();
    for (const e of enriched) {
      const existing = map.get(e.trade.date) ?? { net: 0, hasClosed: false };
      if (e.pnl.net !== null) {
        existing.net += e.pnl.net;
        existing.hasClosed = true;
      }
      map.set(e.trade.date, existing);
    }
    return map;
  }, [enriched]);

  // The day-detail panel shown inline below the calendar grid when a day is
  // tapped — same "every account trade, not just the filtered list" scope
  // as netByDay above, and the same per-day sort (newest first) the List
  // view's own day groups use.
  const calendarDayTrades = useMemo(
    () =>
      calendarSelectedDate
        ? enriched.filter((e) => e.trade.date === calendarSelectedDate).sort((a, b) => b.trade.time.localeCompare(a.trade.time))
        : [],
    [enriched, calendarSelectedDate]
  );
  const calendarDayNet = calendarDayTrades.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0);
  const calendarDayHasClosed = calendarDayTrades.some((e) => e.pnl.net !== null);

  const todayKey = formatDateKey(new Date());
  function dayLabel(date: string): string {
    if (date === todayKey) return "Сьогодні";
    const d = new Date(`${date}T12:00:00`);
    return d.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
  }

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
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 rounded-btn bg-surface shadow-card px-3 py-2 text-[11.5px] font-semibold text-text-dim"
          >
            <UploadIcon className="h-3 w-3" /> MT5
          </button>
          <button
            onClick={openAddForm}
            className="rounded-btn bg-accent px-3.5 py-2 text-[11.5px] font-semibold text-bg"
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

      <div className="mb-3 flex rounded-btn bg-surface-2 p-[3px]">
        {(
          [
            { id: "list" as const, label: "Список", icon: <ListIcon className="h-3.5 w-3.5" /> },
            { id: "calendar" as const, label: "Календар", icon: <GridIcon className="h-3.5 w-3.5" /> },
          ]
        ).map((v) => (
          <button
            key={v.id}
            onClick={() => setViewMode(v.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-btn py-2 text-[12px] font-semibold",
              viewMode === v.id ? "bg-bg text-text shadow-card" : "text-text-faint"
            )}
          >
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {viewMode === "calendar" ? (
        <>
          <JournalCalendarView
            netByDay={netByDay}
            currencySymbol={currencySymbol}
            selectedDate={calendarSelectedDate}
            onSelectDay={setCalendarSelectedDate}
          />
          {calendarSelectedDate && (
            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between px-0.5">
                <span className="text-[12px] font-extrabold capitalize text-text-faint">{dayLabel(calendarSelectedDate)}</span>
                {calendarDayHasClosed && (
                  <span
                    className={cn(
                      "font-mono text-[13.5px] font-extrabold tracking-tight",
                      calendarDayNet >= 0 ? "text-sage" : "text-clay"
                    )}
                  >
                    {calendarDayNet >= 0 ? "+" : ""}
                    {calendarDayNet.toFixed(0)} {currencySymbol}
                  </span>
                )}
              </div>
              {calendarDayTrades.length === 0 ? (
                <div className="rounded-card bg-surface shadow-card py-8 text-center text-[11.5px] font-semibold text-text-faint">
                  Угод не було
                </div>
              ) : (
                <div className="rounded-card bg-surface shadow-card px-3.5">
                  {calendarDayTrades.map(({ trade: t, instrument, pnl }) => (
                    <TradeItem
                      key={t.id}
                      trade={t}
                      instrument={instrument}
                      pnl={pnl}
                      currencySymbol={currencySymbol}
                      session={t.sessionId ? sessionById.get(t.sessionId) : undefined}
                      tags={t.tagIds.map((id) => tagById.get(id)).filter((tag): tag is NonNullable<typeof tag> => !!tag)}
                      onClick={() => setViewingTradeId(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
      {dateFilter && (
        <button
          onClick={() => setDateFilter(null)}
          className="mb-3 flex w-full items-center justify-between rounded-card-sm bg-surface-2 px-3.5 py-2.5 text-[11.5px] font-semibold text-text-dim"
        >
          Фільтр за датою: {dateFilter}
          <span className="text-text-faint">✕ скинути</span>
        </button>
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
        <div className="mb-3 rounded-card bg-[linear-gradient(140deg,#1e4636,#2e7d5b)] p-4 text-white">
          <div className="mb-1 text-[11px] text-white/70">{activeAccount.name}</div>
          <div className="font-mono text-[26px] font-bold">
            {activeAccount.kind === "personal"
              ? `${activeAccount.balance.toFixed(0)} ${currencySymbol}`
              : `${netTotal >= 0 ? "+" : ""}${netTotal.toFixed(0)} ${currencySymbol}`}
          </div>
          {activeAccount.kind === "prop" && (
            <div className="mt-3 flex gap-5 text-[11px] text-white/70">
              <div>
                До цілі
                <div className="mt-0.5 font-mono text-[13px] font-bold text-white">
                  {activeAccount.profitPct}% / {activeAccount.profitTarget}%
                </div>
              </div>
              <div>
                Просадка
                <div className="mt-0.5 font-mono text-[13px] font-bold text-white">
                  {activeAccount.drawdownPct}% / {activeAccount.maxDrawdown}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeAccount && (
        <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
          <div className="mb-3 flex rounded-btn bg-surface-2 p-[3px]">
            {CHART_TYPES.map((c) => (
              <button
                key={c.id}
                onClick={() => setChartType(c.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-btn py-1.5 text-[10px] font-semibold",
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

      {/* Scrollable pills rather than a fixed segmented control: five filters
          don't fit as equal segments on a phone without truncating the labels
          into nonsense. */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              "flex-shrink-0 rounded-btn px-3.5 py-2 text-[11.5px] font-extrabold",
              statusFilter === f.id ? "bg-text text-bg" : "bg-surface text-text-dim"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {days.length === 0 && (
        <div className="rounded-card bg-surface shadow-card py-8 text-center text-[11.5px] font-semibold text-text-faint">
          Немає угод у цій категорії
        </div>
      )}

      {days.map((day) => (
        <div key={day.date}>
          <div className="mb-2 mt-4 flex items-baseline justify-between px-0.5">
            <span className="text-[12px] font-extrabold capitalize text-text-faint">{dayLabel(day.date)}</span>
            {day.hasClosed && (
              <span
                className={cn(
                  "font-mono text-[13.5px] font-extrabold tracking-tight",
                  day.net >= 0 ? "text-sage" : "text-clay"
                )}
              >
                {day.net >= 0 ? "+" : ""}
                {day.net.toFixed(0)} {currencySymbol}
              </span>
            )}
          </div>
          <div className="rounded-card bg-surface shadow-card px-3.5">
            {day.trades.map(({ trade: t, instrument, pnl }) => (
              <TradeItem
                key={t.id}
                trade={t}
                instrument={instrument}
                pnl={pnl}
                currencySymbol={currencySymbol}
                session={t.sessionId ? sessionById.get(t.sessionId) : undefined}
                tags={t.tagIds.map((id) => tagById.get(id)).filter((tag): tag is NonNullable<typeof tag> => !!tag)}
                onClick={() => setViewingTradeId(t.id)}
              />
            ))}
          </div>
        </div>
      ))}
        </>
      )}

      {(() => {
        // Looked up by id rather than held as an object so the sheet always
        // reflects the current store — editing a trade and coming back must
        // not show a stale snapshot from the moment it was opened.
        const viewing = viewingTradeId ? enriched.find((e) => e.trade.id === viewingTradeId) : null;
        if (!viewing) return null;
        return (
          <TradeDetailSheet
            trade={viewing.trade}
            instrument={viewing.instrument}
            pnl={viewing.pnl}
            currencySymbol={currencySymbol}
            session={viewing.trade.sessionId ? sessionById.get(viewing.trade.sessionId) : undefined}
            tags={viewing.trade.tagIds
              .map((id) => tagById.get(id))
              .filter((tag): tag is NonNullable<typeof tag> => !!tag)}
            onEdit={() => {
              setViewingTradeId(null);
              openEditForm(viewing.trade);
            }}
            onClose={() => setViewingTradeId(null)}
          />
        );
      })()}

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
    </div>
  );
}
