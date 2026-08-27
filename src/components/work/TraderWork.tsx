"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts, type TradingAccountView } from "@/lib/trading-accounts";
import { computeTradePnL } from "@/lib/trade-calculations";
import { computeDisciplineStreak, computeSessionHeatmap, computeRiskStability, WEEKDAY_LABELS } from "@/lib/trade-insights";
import { useAppStore } from "@/lib/store";
import { useAssistantStore } from "@/lib/assistant-store";
import { useWorkInsightSync } from "@/lib/use-work-insight-sync";
import { useNewsFeed } from "@/lib/use-news-feed";
import { pickFocusItem } from "@/lib/news-view";
import { formatDateKey } from "@/lib/calendar-utils";
import { TradeForm } from "./TradeForm";
import { smoothArea, smoothPath, type Point } from "@/lib/smooth-path";
import {
  FireIcon,
  SparkleIcon,
  PlusIcon,
  CalculatorIcon,
  CalendarDateIcon,
  NotebookIcon,
  NewspaperIcon,
  UsersIcon,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/** Beige(neutral) → green(profit) / red(loss) heat cell, blended over the
 *  fixed robota-pressed tone rather than a swapping theme token — this
 *  screen's palette is deliberately constant regardless of the app's
 *  selected theme (see globals.css --robota-*). */
function heatColor(avgPnl: number | null, maxAbs: number): string {
  if (avgPnl === null || maxAbs === 0) return "var(--robota-pressed-bg)";
  const t = Math.max(-1, Math.min(1, avgPnl / maxAbs));
  const hue = t >= 0 ? "var(--robota-sage)" : "var(--robota-clay)";
  const pct = Math.round(Math.abs(t) * 100);
  return `color-mix(in srgb, ${hue} ${pct}%, var(--robota-pressed-bg))`;
}

function AssistantBlock() {
  const profile = useAppStore((s) => s.profile);
  useWorkInsightSync(profile);
  const insight = useAssistantStore((s) => s.contextInsights.work);

  return (
    <div className="robota-raised mb-4 rounded-card p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: "var(--robota-sage)" }}>
          <SparkleIcon className="h-3.5 w-3.5" />
          Асистент
        </div>
        <Link href="/assistant" className="text-[11px] font-semibold" style={{ color: "var(--robota-sage)" }}>
          Повний чат →
        </Link>
      </div>
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--robota-text-assistant)" }}>
        {insight?.text ?? "Асистент ще збирає дані про твої угоди…"}
      </p>
    </div>
  );
}

function BalanceCard({
  active,
  symbol,
  todayPnl,
  equityPoints,
  onOpenSwitcher,
}: {
  active: TradingAccountView;
  symbol: string;
  todayPnl: number;
  equityPoints: number[];
  onOpenSwitcher: () => void;
}) {
  const W = 300;
  const H = 90;
  const chartPath = useMemo(() => {
    if (equityPoints.length < 2) return null;
    const min = Math.min(0, ...equityPoints);
    const max = Math.max(0, ...equityPoints);
    const range = max - min || 1;
    const step = W / (equityPoints.length - 1);
    const coords: Point[] = equityPoints.map((v, i) => ({ x: i * step, y: H - ((v - min) / range) * H }));
    return { area: smoothArea(coords, H), line: smoothPath(coords) };
  }, [equityPoints]);

  const balanceValue = active.kind === "personal" ? active.balance : active.netPnL;

  return (
    <button
      onClick={onOpenSwitcher}
      className="robota-raised relative block w-full overflow-hidden rounded-card p-[22px] text-left"
    >
      {chartPath && (
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="robotaBalanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--robota-sage)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--robota-sage)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={chartPath.area} fill="url(#robotaBalanceFill)" />
          <path d={chartPath.line} fill="none" stroke="var(--robota-sage)" strokeWidth={1.5} strokeOpacity={0.45} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div className="relative z-10">
        <span className="flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--robota-text-dim)" }}>
          Загальний баланс · {active.kind === "prop" ? `${active.name} · ${active.phase}` : active.name}
          <span className="text-[9px]">⌄</span>
        </span>
        <div className="font-display mt-1.5 text-[40px] font-bold leading-none" style={{ color: "var(--robota-text)" }}>
          {balanceValue.toFixed(0)} {symbol}
        </div>
        <div
          className="mt-2 h-[3px] w-[38px] rounded-full"
          style={{ background: "linear-gradient(90deg, var(--robota-sage), transparent)" }}
        />
        {todayPnl !== 0 && (
          <div className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--robota-sage)" }}>
            {todayPnl >= 0 ? "+" : ""}
            {todayPnl.toFixed(0)} {symbol} сьогодні
          </div>
        )}
      </div>
    </button>
  );
}

function HeatmapCard({
  trades,
  instrumentById,
  sessions,
}: {
  trades: Trade[];
  instrumentById: Map<string, ReturnType<typeof useJournalConfigStore.getState>["instruments"][number]>;
  sessions: ReturnType<typeof useJournalConfigStore.getState>["sessions"];
}) {
  const heatmap = useMemo(() => computeSessionHeatmap(trades, instrumentById, sessions), [trades, instrumentById, sessions]);
  const maxAbs = useMemo(
    () => Math.max(1, ...heatmap.flatMap((r) => r.cells.map((c) => Math.abs(c.avgPnl ?? 0)))),
    [heatmap]
  );

  return (
    <div className="robota-raised mb-4 rounded-card p-[18px]">
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--robota-text-faint)" }}>
        Теплокарта результативності
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1 pl-[46px]">
          {WEEKDAY_LABELS.map((l) => (
            <div key={l} className="flex-1 text-center text-[9px] font-semibold" style={{ color: "var(--robota-text-faint)" }}>
              {l}
            </div>
          ))}
        </div>
        {heatmap.map((row) => (
          <div key={row.sessionId} className="flex items-center gap-1">
            <div className="w-[46px] flex-shrink-0 truncate text-[9.5px] font-semibold" style={{ color: "var(--robota-text-dim)" }}>
              {row.sessionName}
            </div>
            {row.cells.map((cell) => (
              <div
                key={cell.weekday}
                className={cn("aspect-square flex-1 rounded-[6px]", cell.avgPnl === null && "robota-pressed")}
                style={cell.avgPnl !== null ? { background: heatColor(cell.avgPnl, maxAbs) } : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountSwitcherSheet({
  accounts,
  activeId,
  onSelect,
  onClose,
}: {
  accounts: TradingAccountView[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-bg p-4 md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="font-heading text-[15px] font-semibold text-text">Рахунки</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>
        <div className="space-y-1.5">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-card-sm border p-3 text-left",
                activeId === a.id ? "border-sage" : "border-border"
              )}
            >
              <span className="truncate text-[12.5px] font-semibold text-text">
                {a.kind === "prop" ? `${a.name} · ${a.phase}` : a.name}
              </span>
              <span className={cn("flex-shrink-0 font-mono text-[12px] font-bold", a.netPnL >= 0 ? "text-sage" : "text-clay")}>
                {a.netPnL >= 0 ? "+" : ""}
                {a.netPnL.toFixed(0)} {a.currencySymbol}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Icon in a small "вдавлена лунка" (pressed well) — the module-tile icon
 *  treatment shared by Журнал угод / Калькулятор / Новини / Команда below. */
function IconWell({ children }: { children: React.ReactNode }) {
  return (
    <span className="robota-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon" style={{ color: "var(--robota-icon-muted)" }}>
      {children}
    </span>
  );
}

export function TraderWork() {
  const { trades, addTrade, updateTrade, removeTrade } = useJournalStore();
  const { instruments, sessions } = useJournalConfigStore();
  const instrumentById = useMemo(() => new Map(instruments.map((i) => [i.id, i])), [instruments]);

  const accounts = useTradingAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const active = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;
  const symbol = active?.currencySymbol ?? "$";

  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  const streak = useMemo(() => computeDisciplineStreak(trades), [trades]);

  const accountTrades = useMemo(
    () => (active ? trades.filter((t) => t.accountId === active.id) : []),
    [trades, active]
  );

  const todayKey = formatDateKey(new Date());
  const todayPnl = useMemo(() => {
    return accountTrades
      .filter((t) => {
        if (t.status !== "closed") return false;
        const closeKey = t.meta?.closedAt ? formatDateKey(new Date(t.meta.closedAt)) : t.date;
        return closeKey === todayKey;
      })
      .reduce((sum, t) => sum + (computeTradePnL(t, instrumentById.get(t.instrumentId)).net ?? 0), 0);
  }, [accountTrades, instrumentById, todayKey]);

  // Decorative curve behind the balance card — purely a hint at motion, not
  // a real analytics surface, so a simple chronological cumulative net over
  // the active account's own closed trades is all it needs.
  const equityPoints = useMemo(() => {
    const closed = accountTrades
      .map((t) => ({ trade: t, pnl: computeTradePnL(t, instrumentById.get(t.instrumentId)) }))
      .filter((e) => e.pnl.net !== null)
      .sort((a, b) => `${a.trade.date}${a.trade.time}`.localeCompare(`${b.trade.date}${b.trade.time}`));
    return closed.reduce<number[]>((acc, e) => {
      const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
      return [...acc, prev + (e.pnl.net ?? 0)];
    }, []);
  }, [accountTrades, instrumentById]);

  const allClosed = useMemo(
    () => trades.map((t) => computeTradePnL(t, instrumentById.get(t.instrumentId))).filter((p) => p.net !== null),
    [trades, instrumentById]
  );
  const allTimeNet = allClosed.reduce((sum, p) => sum + (p.net ?? 0), 0);
  const allWinRate =
    allClosed.length > 0 ? Math.round((allClosed.filter((p) => (p.net ?? 0) > 0).length / allClosed.length) * 100) : 0;
  const avgLot = useMemo(() => computeRiskStability(trades, instrumentById).avgLot, [trades, instrumentById]);

  const { items: newsItems } = useNewsFeed();
  const newsFocus = pickFocusItem(newsItems);

  function openNewTrade() {
    setEditingTrade(null);
    setTradeFormOpen(true);
  }
  function closeTradeForm() {
    setTradeFormOpen(false);
    setEditingTrade(null);
  }
  function handleSaveTrade(data: Omit<Trade, "id">) {
    if (editingTrade) updateTrade(editingTrade.id, data);
    else addTrade(data);
    closeTradeForm();
  }
  function handleDeleteTrade(id: string) {
    removeTrade(id);
    closeTradeForm();
  }

  const screenBleed = "robota-screen -mx-4 -mt-6 px-4 pb-4 md:-mx-8 md:-mt-8 md:px-8";
  const screenStyle = { background: "var(--robota-bg)", paddingTop: "calc(1.5rem + env(safe-area-inset-top))" };

  if (accounts.length === 0) {
    return (
      <div className={screenBleed} style={screenStyle}>
        <div className="mb-4 text-[23px] font-extrabold tracking-tight" style={{ color: "var(--robota-text)" }}>
          Робота
        </div>
        <div className="robota-raised rounded-card py-10 text-center text-[12px] font-semibold" style={{ color: "var(--robota-text-faint)" }}>
          Ще немає торгових рахунків
          <Link href="/work/prop-accounts" className="mt-3 block text-[12.5px] font-extrabold" style={{ color: "var(--robota-sage)" }}>
            Додати рахунок
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={screenBleed} style={screenStyle}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[23px] font-extrabold tracking-tight" style={{ color: "var(--robota-text)" }}>
          Робота
        </h1>
        {streak > 0 && (
          <div
            className="robota-pressed flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ color: "var(--robota-gold)" }}
          >
            <FireIcon className="h-3.5 w-3.5" />
            {streak} днів
          </div>
        )}
      </div>

      <AssistantBlock />

      {active && (
        <div className="mb-4">
          <BalanceCard
            active={active}
            symbol={symbol}
            todayPnl={todayPnl}
            equityPoints={equityPoints}
            onOpenSwitcher={() => setSwitcherOpen(true)}
          />
        </div>
      )}

      {switcherOpen && (
        <AccountSwitcherSheet
          accounts={accounts}
          activeId={active?.id ?? null}
          onSelect={(id) => {
            setSelectedId(id);
            setSwitcherOpen(false);
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      <HeatmapCard trades={trades} instrumentById={instrumentById} sessions={sessions} />

      <div className="robota-raised mb-4 flex rounded-card">
        <button onClick={openNewTrade} className="flex flex-1 flex-col items-center gap-1.5 py-3.5">
          <PlusIcon className="h-[18px] w-[18px]" style={{ color: "var(--robota-icon-muted)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--robota-text)" }}>
            Угода
          </span>
        </button>
        <Link href="/work/calculator" className="flex flex-1 flex-col items-center gap-1.5 py-3.5">
          <CalculatorIcon className="h-[18px] w-[18px]" style={{ color: "var(--robota-icon-muted)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--robota-text)" }}>
            Ризик
          </span>
        </Link>
        <Link href="/work/economic-calendar" className="flex flex-1 flex-col items-center gap-1.5 py-3.5">
          <CalendarDateIcon className="h-[18px] w-[18px]" style={{ color: "var(--robota-icon-muted)" }} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--robota-text)" }}>
            Календар
          </span>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link href="/work/journal" className="robota-raised col-span-2 rounded-card p-3.5">
          <IconWell>
            <NotebookIcon className="h-[18px] w-[18px]" />
          </IconWell>
          <div className="font-display mt-2 text-[20px] font-bold" style={{ color: "var(--robota-sage-bright)" }}>
            {allTimeNet >= 0 ? "+" : ""}
            {allTimeNet.toFixed(0)} {symbol}
          </div>
          <div className="mt-0.5 truncate text-[10.5px]" style={{ color: "var(--robota-text-faint)" }}>
            {allClosed.length} угод{allClosed.length === 1 ? "а" : ""} · win rate {allWinRate}%
          </div>
        </Link>

        <Link href="/work/calculator" className="robota-raised rounded-card p-3.5">
          <IconWell>
            <CalculatorIcon className="h-[18px] w-[18px]" />
          </IconWell>
          <div className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--robota-text)" }}>
            Калькулятор позиції
          </div>
          <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--robota-text-faint)" }}>
            Розмір під ризик · {avgLot.toFixed(2)} станд. лот
          </div>
        </Link>

        <Link href="/work/news" className="robota-raised rounded-card p-3.5">
          <IconWell>
            <NewspaperIcon className="h-[18px] w-[18px]" />
          </IconWell>
          <div className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--robota-text)" }}>
            Новини
          </div>
          <div className="mt-0.5 truncate text-[10.5px]" style={{ color: "var(--robota-text-faint)" }}>
            {newsFocus?.headline ?? "Поки немає новин"}
          </div>
        </Link>
      </div>

      <Link href="/work/teams" className="robota-raised flex items-center gap-3 rounded-card p-3.5">
        <IconWell>
          <UsersIcon className="h-4 w-4" />
        </IconWell>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold" style={{ color: "var(--robota-text)" }}>
            Команда
          </span>
          <span className="mt-0.5 block text-[10.5px]" style={{ color: "var(--robota-text-faint)" }}>
            Чат, спільні проєкти
          </span>
        </span>
        <span className="flex-shrink-0 text-[13px]" style={{ color: "var(--robota-chevron)" }}>
          ›
        </span>
      </Link>

      {tradeFormOpen && (
        <TradeForm
          initialDateKey={formatDateKey(new Date())}
          editingTrade={editingTrade}
          accounts={accounts}
          defaultAccountId={active?.id ?? null}
          onSave={handleSaveTrade}
          onClose={closeTradeForm}
          onDelete={editingTrade ? handleDeleteTrade : undefined}
        />
      )}
    </div>
  );
}
