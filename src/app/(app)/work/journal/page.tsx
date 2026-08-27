"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TradeForm } from "@/components/work/TradeForm";
import { TradeItem } from "@/components/work/TradeItem";
import { TradeDetailSheet } from "@/components/work/TradeDetailSheet";
import { AccountSelector, type SyncStatus } from "@/components/work/AccountSelector";
import { TradingAccountForm } from "@/components/work/TradingAccountForm";
import { EquityChart, type EquityChartType } from "@/components/work/EquityChart";
import { MT5ImportSheet } from "@/components/work/MT5ImportSheet";
import { JournalCalendarView, type DayNet } from "@/components/work/JournalCalendarView";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore, type JournalInstrument, type JournalSession, type JournalTag } from "@/lib/journal-config-store";
import { useTradingAccounts, type PersonalAccountView } from "@/lib/trading-accounts";
import { usePersonalTradingAccountsStore } from "@/lib/personal-trading-accounts-store";
import { usePropAccountsStore } from "@/lib/prop-accounts-store";
import { computeTradePnL, type TradePnL } from "@/lib/trade-calculations";
import { formatDateKey } from "@/lib/calendar-utils";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";
import {
  BarChartIcon,
  GearIcon,
  UploadIcon,
  ListIcon,
  GridIcon,
  PlusIcon,
  ChevronDownIcon,
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

const CHART_TYPES: { id: EquityChartType; label: string }[] = [
  { id: "line", label: "Крива" },
  { id: "bar", label: "Стовпчики" },
  { id: "drawdown", label: "Просадка" },
];

const VIEW_TABS: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: "list", label: "Список", icon: <ListIcon className="h-3.5 w-3.5" /> },
  { id: "calendar", label: "Календар", icon: <GridIcon className="h-3.5 w-3.5" /> },
];

type EnrichedTrade = { trade: Trade; instrument: JournalInstrument | undefined; pnl: TradePnL };

/** One day's trades as a vertical timeline: a thin rail on the left with a
 *  dot per trade (accent = profit, clay = loss), `TradeItem` unchanged to
 *  its right. Shared by List mode and the Calendar day-detail panel so both
 *  read the same way. */
function TimelineTrades({
  rows,
  currencySymbol,
  sessionById,
  tagById,
  onSelect,
}: {
  rows: EnrichedTrade[];
  currencySymbol: string;
  sessionById: Map<string, JournalSession>;
  tagById: Map<string, JournalTag>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative pl-5">
      <span className="absolute bottom-2 left-2 top-2 w-px bg-border" />
      {rows.map(({ trade: t, instrument, pnl }) => {
        const profit = (pnl.net ?? 0) >= 0;
        return (
          <div key={t.id} className="relative">
            <span
              className="absolute left-2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
              style={{ background: profit ? "var(--accent)" : "var(--clay)" }}
            />
            <TradeItem
              trade={t}
              instrument={instrument}
              pnl={pnl}
              currencySymbol={currencySymbol}
              session={t.sessionId ? sessionById.get(t.sessionId) : undefined}
              tags={t.tagIds.map((id) => tagById.get(id)).filter((tag): tag is JournalTag => !!tag)}
              onClick={() => onSelect(t.id)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function JournalPage() {
  const isTrader = useTraderOnlyGuard();

  const { trades, addTrade, updateTrade, removeTrade } = useJournalStore();
  const { instruments, tags, sessions } = useJournalConfigStore();
  const accounts = useTradingAccounts();
  const {
    addAccount: addPersonalAccount,
    updateAccount: updatePersonalAccount,
    removeAccount: removePersonalAccount,
  } = usePersonalTradingAccountsStore();
  const { addAccount: addPropAccount } = usePropAccountsStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editingAccount, setEditingAccount] = useState<PersonalAccountView | null>(null);
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
  // The account-name row inside the balance block doubles as the
  // switcher's collapse toggle — this is what "clickable to open the
  // account switcher" resolves to now that the chip strip lives in the
  // same block rather than behind a separate control.
  const [accountStripExpanded, setAccountStripExpanded] = useState(true);

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

  // Sync-status dot on each account chip: there's no live MT5 connection to
  // report on (imports are a manual file upload, see MT5ImportSheet), so
  // this reads recency of real trade activity instead of faking a socket
  // status — fresh/aging/stale, derived from every account's own trades,
  // not just the active one.
  const syncStatusByAccountId = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const today = new Date(`${todayKey}T00:00:00`);
    const lastDateByAccount = new Map<string, string>();
    for (const t of trades) {
      if (!t.accountId) continue;
      const existing = lastDateByAccount.get(t.accountId);
      if (!existing || t.date > existing) lastDateByAccount.set(t.accountId, t.date);
    }
    const map = new Map<string, SyncStatus>();
    for (const acc of accounts) {
      const lastDate = lastDateByAccount.get(acc.id);
      if (!lastDate) {
        map.set(acc.id, "stale");
        continue;
      }
      const days = Math.round((today.getTime() - new Date(`${lastDate}T00:00:00`).getTime()) / 86400000);
      map.set(acc.id, days <= 1 ? "fresh" : days <= 7 ? "aging" : "stale");
    }
    return map;
  }, [trades, accounts]);

  const closed = enriched.filter((e) => e.trade.status === "closed" && e.pnl.net !== null);
  const wins = closed.filter((e) => (e.pnl.net ?? 0) > 0);
  const losses = closed.filter((e) => (e.pnl.net ?? 0) <= 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const netTotal = closed.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0);
  const grossWin = wins.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, e) => sum + (e.pnl.net ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : "—";
  const openCount = accountTrades.filter((t) => t.status === "open").length;

  const balanceLabel = activeAccount
    ? activeAccount.kind === "personal"
      ? `${activeAccount.balance.toFixed(0)} ${currencySymbol}`
      : `${netTotal >= 0 ? "+" : ""}${netTotal.toFixed(0)} ${currencySymbol}`
    : "—";

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

  function closeAccountForm() {
    setAccountFormOpen(false);
    setEditingAccount(null);
  }

  function openEditAccountForm(account: PersonalAccountView) {
    setEditingAccount(account);
    setAccountFormOpen(true);
  }

  function handleAddPersonalAccount(data: Parameters<typeof addPersonalAccount>[0]) {
    const id = addPersonalAccount(data);
    setSelectedAccountId(id);
    closeAccountForm();
  }

  function handleUpdatePersonalAccount(data: Parameters<typeof addPersonalAccount>[0]) {
    if (!editingAccount) return;
    updatePersonalAccount(editingAccount.id, data);
    closeAccountForm();
  }

  function handleDeleteAccount(id: string) {
    removePersonalAccount(id);
    // Falling back to whichever account ends up first keeps the screen on a
    // real account instead of a now-deleted id — same reasoning as the
    // finance module's own removeAccount (see finance-scope.ts).
    if (selectedAccountId === id) setSelectedAccountId(null);
    closeAccountForm();
  }

  function handleAddPropAccount(data: Parameters<typeof addPropAccount>[0]) {
    addPropAccount(data);
    const latest = usePropAccountsStore.getState().accounts;
    const created = latest[latest.length - 1];
    if (created) setSelectedAccountId(created.id);
    closeAccountForm();
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
      {/* Balance block — deliberately breaks out of the shared page gutter
          (NavShell's own px/pt) to sit full-width and flush with the top of
          the screen, then re-applies that same gutter as its own padding so
          its content still lines up with everything below it. Always the
          fixed warm/cream --balance-* tokens, never the swapping theme
          tokens used everywhere else on this screen — see globals.css. */}
      <div
        className="-mx-4 px-4 pb-4 md:-mx-8 md:px-8"
        style={{
          background: "linear-gradient(160deg, var(--balance-grad-from), var(--balance-grad-to))",
          // NavShell's <main> sets its real top padding via this exact same
          // inline expression (not the pt-6/md:pt-8 classes, which an inline
          // style always wins over regardless of breakpoint) — cancelling
          // only the static 1.5rem half of it left a gap exactly
          // env(safe-area-inset-top) tall under the status bar on notch
          // devices, since that half was never touched by a plain -mt-6.
          marginTop: "calc(-1.5rem - env(safe-area-inset-top))",
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
        }}
      >
        <div className="flex items-center justify-between gap-2 pb-3.5">
          <Link href="/work" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-balance-text-dim">
            <span className="text-[15px] leading-none">‹</span> Робота
          </Link>
          <div className="flex flex-shrink-0 gap-1.5">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1 rounded-btn bg-black/10 px-3 py-2 text-[11px] font-semibold text-balance-text"
            >
              <UploadIcon className="h-3 w-3" /> MT5
            </button>
            <button
              onClick={openAddForm}
              className="flex items-center gap-1 rounded-btn px-3.5 py-2 text-[11.5px] font-semibold text-white"
              style={{ background: "var(--balance-text)" }}
            >
              <PlusIcon className="h-3 w-3" /> Угода
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <button
            onClick={() => setAccountFormOpen(true)}
            className="block w-full rounded-card-sm bg-black/5 py-6 text-center text-[11.5px] text-balance-text-dim"
          >
            Ще немає рахунків — додай перший, щоб почати вести журнал
          </button>
        ) : (
          <>
            <button
              onClick={() => setAccountStripExpanded((v) => !v)}
              className="flex items-center gap-1 text-[12px] font-semibold text-balance-text-dim"
            >
              Журнал угод · {activeAccount?.name ?? "—"}
              <ChevronDownIcon
                className={cn("h-3.5 w-3.5 transition-transform", accountStripExpanded && "rotate-180")}
              />
            </button>
            <div className="font-display text-[42px] font-bold leading-[1.1] text-balance-text">{balanceLabel}</div>

            <div className="mt-3 flex gap-6">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-balance-text-dim">Win rate</div>
                <div className="mt-0.5 font-mono text-[13px] font-extrabold text-balance-text">{winRate}%</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-balance-text-dim">P. Factor</div>
                <div className="mt-0.5 font-mono text-[13px] font-extrabold text-balance-text">{profitFactor}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-balance-text-dim">Угод</div>
                <div className="mt-0.5 font-mono text-[13px] font-extrabold text-balance-text">
                  {accountTrades.length}
                  {openCount > 0 && <span className="text-balance-text-dim"> · {openCount} відкр.</span>}
                </div>
              </div>
              {activeAccount?.kind === "prop" && (
                <>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-balance-text-dim">До цілі</div>
                    <div className="mt-0.5 font-mono text-[13px] font-extrabold text-balance-text">
                      {activeAccount.profitPct}% / {activeAccount.profitTarget}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-balance-text-dim">Просадка</div>
                    <div className="mt-0.5 font-mono text-[13px] font-extrabold text-balance-text">
                      {activeAccount.drawdownPct}% / {activeAccount.maxDrawdown}%
                    </div>
                  </div>
                </>
              )}
            </div>

            {accountStripExpanded && (
              <div className="-mx-4 -mb-4 mt-3.5 px-4 py-3 md:-mx-8 md:-mb-8 md:px-8" style={{ background: "var(--balance-inset)" }}>
                <AccountSelector
                  accounts={accounts}
                  selectedId={activeAccountId}
                  onSelect={setSelectedAccountId}
                  onAdd={() => setAccountFormOpen(true)}
                  onEdit={openEditAccountForm}
                  currencySymbol={currencySymbol}
                  syncStatusByAccountId={syncStatusByAccountId}
                  variant="inset"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-4">
        {activeAccount && (
          <div className="mb-3 rounded-card-sm bg-surface shadow-card p-3">
            <div className="mb-3 flex gap-4 border-b border-border pb-2">
              {CHART_TYPES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChartType(c.id)}
                  className={cn(
                    "text-[11px] font-semibold",
                    chartType === c.id ? "text-accent" : "text-text-faint"
                  )}
                >
                  {c.label}
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

        <div className="mb-3 flex items-end justify-between gap-2 border-b border-border">
          <div className="flex gap-4">
            {VIEW_TABS.map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 pb-2 text-[12.5px] font-semibold",
                  viewMode === v.id ? "border-accent text-text" : "border-transparent text-text-faint"
                )}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-shrink-0 gap-2">
            <Link
              href={activeAccountId ? `/work/journal/stats?accountId=${activeAccountId}` : "/work/journal/stats"}
              className="flex items-center gap-1.5 rounded-btn bg-surface shadow-card px-3 py-1.5 text-[11px] font-semibold text-text-dim"
            >
              <BarChartIcon className="h-3.5 w-3.5" /> Статистика
            </Link>
            <Link
              href="/work/journal/library"
              className="flex items-center gap-1.5 rounded-btn bg-surface shadow-card px-3 py-1.5 text-[11px] font-semibold text-text-dim"
            >
              <GearIcon className="h-3.5 w-3.5" /> Теги
            </Link>
          </div>
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
                  <div className="rounded-card bg-surface shadow-card px-3.5 py-1">
                    <TimelineTrades
                      rows={calendarDayTrades}
                      currencySymbol={currencySymbol}
                      sessionById={sessionById}
                      tagById={tagById}
                      onSelect={setViewingTradeId}
                    />
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

            {/* Scrollable pills rather than a fixed segmented control: five
                filters don't fit as equal segments on a phone without
                truncating the labels into nonsense. */}
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
                <div className="rounded-card bg-surface shadow-card px-3.5 py-1">
                  <TimelineTrades
                    rows={day.trades}
                    currencySymbol={currencySymbol}
                    sessionById={sessionById}
                    tagById={tagById}
                    onSelect={setViewingTradeId}
                  />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

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
          editingAccount={editingAccount}
          onSavePersonal={editingAccount ? handleUpdatePersonalAccount : handleAddPersonalAccount}
          onSaveProp={handleAddPropAccount}
          onClose={closeAccountForm}
          onDelete={editingAccount ? handleDeleteAccount : undefined}
        />
      )}

      {importOpen && <MT5ImportSheet accountId={activeAccountId} onClose={() => setImportOpen(false)} />}
    </div>
  );
}
