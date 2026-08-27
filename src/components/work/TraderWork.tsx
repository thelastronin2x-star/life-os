"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useJournalStore, type Trade } from "@/lib/journal-store";
import { useJournalConfigStore } from "@/lib/journal-config-store";
import { useTradingAccounts, type TradingAccountView } from "@/lib/trading-accounts";
import { computeTradePnL } from "@/lib/trade-calculations";
import {
  computeDisciplineStreak,
  computeSessionHeatmap,
  computeRMultipleBuckets,
  computeResultStreakStrip,
  computeRiskStability,
  computeMonthVsLastMonth,
  computeExtremePoints,
  WEEKDAY_LABELS,
  type RBucket,
} from "@/lib/trade-insights";
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
 *  theme's own neutral surface tone rather than a hardcoded hex — a cell
 *  with no trades yet stays exactly that neutral, undiluted. */
function heatColor(avgPnl: number | null, maxAbs: number): string {
  if (avgPnl === null || maxAbs === 0) return "var(--surface-2)";
  const t = Math.max(-1, Math.min(1, avgPnl / maxAbs));
  const pct = Math.round(Math.abs(t) * 78);
  const hue = t >= 0 ? "var(--sage)" : "var(--clay)";
  return `color-mix(in srgb, ${hue} ${pct}%, var(--surface-2))`;
}

function AssistantBlock() {
  const profile = useAppStore((s) => s.profile);
  useWorkInsightSync(profile);
  const insight = useAssistantStore((s) => s.contextInsights.work);

  return (
    <div className="card-raised mb-4 rounded-card bg-surface p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-sage">
          <SparkleIcon className="h-3.5 w-3.5" />
          Асистент
        </div>
        <Link href="/assistant" className="text-[11px] font-semibold text-sage">
          Повний чат →
        </Link>
      </div>
      <p className="text-[12.5px] leading-relaxed text-text-dim">
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
    <div className="card-raised rounded-card bg-surface">
      {/* Shadow lives on this wrapper, not the button below — an element
          with overflow-hidden (needed here to clip the decorative SVG to
          the rounded corners) also clips its own box-shadow, so the two
          can't share one node. */}
      <button onClick={onOpenSwitcher} className="relative block w-full overflow-hidden rounded-card p-[22px] text-left">
      {chartPath && (
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="robotaBalanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sage)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--sage)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={chartPath.area} fill="url(#robotaBalanceFill)" />
          <path d={chartPath.line} fill="none" stroke="var(--sage)" strokeWidth={1.5} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div className="relative z-10">
        <span className="flex items-center gap-1 text-[12px] font-semibold text-text-dim">
          Загальний баланс · {active.kind === "prop" ? `${active.name} · ${active.phase}` : active.name}
          <span className="text-[9px]">⌄</span>
        </span>
        <div className="font-display mt-1.5 text-[40px] font-bold leading-none text-text">
          {balanceValue.toFixed(0)} {symbol}
        </div>
        <div
          className="mt-2 h-[3px] w-[38px] rounded-full"
          style={{ background: "linear-gradient(90deg, var(--sage), transparent)" }}
        />
        {todayPnl !== 0 && (
          <div className={cn("mt-2 text-[12.5px] font-semibold", todayPnl >= 0 ? "text-sage" : "text-clay")}>
            {todayPnl >= 0 ? "+" : ""}
            {todayPnl.toFixed(0)} {symbol} сьогодні
          </div>
        )}
      </div>
      </button>
    </div>
  );
}

function RHistogramInsight(buckets: RBucket[]): string {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return "Ще немає закритих угод для аналізу розподілу R.";
  const top = buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0]);
  const verdict =
    top.label === "+1R" || top.label === "+2R" || top.label === "+3R"
      ? "Це узгоджується з виставленими тейками."
      : top.label.startsWith("-")
        ? "Більшість угод закривається по стопу — варто переглянути точку входу або розмір стопу."
        : "Багато угод закривається біля беззбитку — можливо, варто переглядати трейлінг раніше.";
  return `Найчастіше угоди закриваються біля ${top.label} (${top.count} з ${total}). ${verdict}`;
}

/** Session×weekday heatmap (page 1, static — no click-to-inspect) plus the
 *  rest of the analytics pages already designed for this screen earlier —
 *  a horizontal swipe carousel, not a vertical stack, since these are five
 *  independent "one glance" readouts rather than a single continuous report. */
function AnalyticsCarousel({
  trades,
  instrumentById,
  sessions,
  currencySymbol,
}: {
  trades: Trade[];
  instrumentById: Map<string, ReturnType<typeof useJournalConfigStore.getState>["instruments"][number]>;
  sessions: ReturnType<typeof useJournalConfigStore.getState>["sessions"];
  currencySymbol: string;
}) {
  const [page, setPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const heatmap = useMemo(() => computeSessionHeatmap(trades, instrumentById, sessions), [trades, instrumentById, sessions]);
  const maxAbs = useMemo(
    () => Math.max(1, ...heatmap.flatMap((r) => r.cells.map((c) => Math.abs(c.avgPnl ?? 0)))),
    [heatmap]
  );
  const rBuckets = useMemo(() => computeRMultipleBuckets(trades, instrumentById), [trades, instrumentById]);
  const maxCount = useMemo(() => Math.max(1, ...rBuckets.map((b) => b.count)), [rBuckets]);
  const rInsightText = useMemo(() => RHistogramInsight(rBuckets), [rBuckets]);
  const streak = useMemo(() => computeResultStreakStrip(trades, instrumentById), [trades, instrumentById]);
  const riskStability = useMemo(() => computeRiskStability(trades, instrumentById), [trades, instrumentById]);
  const maxLot = useMemo(() => Math.max(0.01, ...riskStability.points.map((p) => p.lot)), [riskStability]);
  const monthComparison = useMemo(() => computeMonthVsLastMonth(trades, instrumentById), [trades, instrumentById]);
  const maxMonthNet = Math.max(1, Math.abs(monthComparison.current.net), Math.abs(monthComparison.previous.net));
  const extremes = useMemo(() => computeExtremePoints(trades, instrumentById), [trades, instrumentById]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="mb-4">
      {/* Shadow on this wrapper, scrolling (and its overflow-x clip) on the
          child below — same reason as BalanceCard's split above. */}
      <div className="card-raised rounded-card bg-surface">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-card"
      >
        <div className="w-full flex-shrink-0 snap-start p-[18px]">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Теплокарта результативності
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 pl-[46px]">
              {WEEKDAY_LABELS.map((l) => (
                <div key={l} className="flex-1 text-center text-[9px] font-semibold text-text-faint">
                  {l}
                </div>
              ))}
            </div>
            {heatmap.map((row) => (
              <div key={row.sessionId} className="flex items-center gap-1">
                <div className="w-[46px] flex-shrink-0 truncate text-[9.5px] font-semibold text-text-dim">
                  {row.sessionName}
                </div>
                {row.cells.map((cell) => (
                  <div
                    key={cell.weekday}
                    className={cn("aspect-square flex-1 rounded-[6px]", cell.avgPnl === null && "well-pressed")}
                    style={cell.avgPnl !== null ? { background: heatColor(cell.avgPnl, maxAbs) } : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full flex-shrink-0 snap-start p-3.5">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Розподіл угод за R
          </div>
          <div className="flex h-[92px] items-end gap-2">
            {rBuckets.map((b) => (
              <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-[4px]"
                  style={{
                    height: `${b.count > 0 ? Math.max(6, (b.count / maxCount) * 100) : 0}%`,
                    background: b.label.startsWith("-") ? "var(--clay)" : b.label === "0R" ? "var(--surface-2)" : "var(--sage)",
                  }}
                />
                <span className="text-[9px] font-semibold text-text-faint">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-text-dim">{rInsightText}</p>
        </div>

        <div className="w-full flex-shrink-0 snap-start p-3.5">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Смуга результатів
          </div>
          {streak.results.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-text-faint">Ще немає закритих угод</div>
          ) : (
            <>
              <div className="flex gap-1">
                {streak.results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex aspect-square flex-1 items-center justify-center rounded-[5px] text-[9px] font-extrabold",
                      r === "W" && "bg-sage text-bg",
                      r === "L" && "bg-clay text-bg",
                      r === "B" && "bg-surface-2 text-text-faint"
                    )}
                  >
                    {r}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-text-dim">
                {streak.wins} перемог, {streak.losses} поразок
                {streak.breakeven > 0 ? `, ${streak.breakeven} у нуль` : ""} з останніх {streak.results.length} угод.
                {streak.current && streak.current.count > 1 && (
                  <>
                    {" "}
                    Поточна серія: <b className="text-text">{streak.current.count}</b>{" "}
                    {streak.current.type === "W" ? "перемог" : streak.current.type === "L" ? "поразок" : "у нуль"} поспіль.
                  </>
                )}
              </p>
            </>
          )}
        </div>

        <div className="w-full flex-shrink-0 snap-start p-3.5">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Стабільність ризику
          </div>
          {riskStability.points.length === 0 ? (
            <div className="py-6 text-center text-[11px] text-text-faint">Ще немає закритих угод</div>
          ) : (
            <>
              <div className="flex h-[92px] items-end gap-[3px]">
                {riskStability.points.map((p, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-[3px]"
                    style={{
                      height: `${Math.max(6, (p.lot / maxLot) * 100)}%`,
                      background: p.isOutlier ? "var(--clay)" : "var(--sage)",
                    }}
                  />
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-text-dim">
                Середній лот — <b className="text-text">{riskStability.avgLot.toFixed(2)}</b>
                {riskStability.outlierCount > 0
                  ? `, ${riskStability.outlierCount} угод${riskStability.outlierCount === 1 ? "а" : ""} перевищили норму більш ніж удвічі — саме вони найбільше вплинули на волатильність результату.`
                  : ", жодна угода помітно не вибивалась із норми."}
              </p>
            </>
          )}
        </div>

        <div className="w-full flex-shrink-0 snap-start p-3.5">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Цей місяць проти минулого
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-16 flex-shrink-0 text-[10.5px] font-semibold text-text-faint">Net P&L</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (Math.abs(monthComparison.current.net) / maxMonthNet) * 100)}%`,
                    background: monthComparison.current.net >= 0 ? "var(--sage)" : "var(--clay)",
                  }}
                />
              </div>
              <span
                className={cn(
                  "w-16 flex-shrink-0 text-right font-mono text-[11px] font-bold",
                  monthComparison.current.net >= 0 ? "text-sage" : "text-clay"
                )}
              >
                {monthComparison.current.net >= 0 ? "+" : ""}
                {monthComparison.current.net.toFixed(0)} {currencySymbol}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-16 flex-shrink-0 text-[10.5px] font-semibold text-text-faint">Минулий</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-border"
                  style={{ width: `${Math.min(100, (Math.abs(monthComparison.previous.net) / maxMonthNet) * 100)}%` }}
                />
              </div>
              <span className="w-16 flex-shrink-0 text-right font-mono text-[11px] font-semibold text-text-faint">
                {monthComparison.previous.net >= 0 ? "+" : ""}
                {monthComparison.previous.net.toFixed(0)} {currencySymbol}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-16 flex-shrink-0 text-[10.5px] font-semibold text-text-faint">Win rate</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-sky"
                  style={{ width: `${monthComparison.current.winRate}%` }}
                />
              </div>
              <span className="w-16 flex-shrink-0 text-right font-mono text-[11px] font-bold text-text">
                {monthComparison.current.winRate}%
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-16 flex-shrink-0 text-[10.5px] font-semibold text-text-faint">Минулий</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-border" style={{ width: `${monthComparison.previous.winRate}%` }} />
              </div>
              <span className="w-16 flex-shrink-0 text-right font-mono text-[11px] font-semibold text-text-faint">
                {monthComparison.previous.winRate}%
              </span>
            </div>
          </div>
        </div>

        <div className="w-full flex-shrink-0 snap-start p-3.5">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            Крайні точки періоду
          </div>
          {!extremes.best && !extremes.worst ? (
            <div className="py-6 text-center text-[11px] text-text-faint">Ще немає закритих угод</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { label: "Найкраща", x: extremes.best, tone: "sage" as const },
                  { label: "Найгірша", x: extremes.worst, tone: "clay" as const },
                ]
              ).map(({ label, x, tone }) => (
                <div key={label} className="rounded-card-sm bg-surface-2 p-2.5">
                  <div className={cn("text-[9px] font-bold uppercase tracking-wide", tone === "sage" ? "text-sage" : "text-clay")}>
                    {label}
                  </div>
                  {x ? (
                    <>
                      <div className="mt-1 text-[12.5px] font-bold text-text">
                        {instrumentById.get(x.trade.instrumentId)?.symbol ?? x.trade.sourceSymbol ?? "—"}
                      </div>
                      <div className={cn("mt-0.5 font-mono text-[13.5px] font-extrabold", tone === "sage" ? "text-sage" : "text-clay")}>
                        {x.net >= 0 ? "+" : ""}
                        {x.net.toFixed(0)} {currencySymbol}
                      </div>
                      <div className="mt-0.5 text-[9.5px] text-text-faint">
                        {x.trade.direction === "LONG" ? "Long" : "Short"} · {x.trade.date}
                        {x.rMultiple !== null && ` · ${x.rMultiple >= 0 ? "+" : ""}${x.rMultiple.toFixed(1)}R`}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-[11px] text-text-faint">—</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="mt-2 flex justify-center gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn("h-1.5 w-1.5 rounded-full", page === i ? "bg-text" : "bg-border")} />
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

/** Icon in a small pressed well — the module-tile icon treatment shared by
 *  Журнал угод / Калькулятор / Новини / Команда below. */
function IconWell({ children }: { children: React.ReactNode }) {
  return (
    <span className="well-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-icon bg-surface-2 text-text-dim">
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

  if (accounts.length === 0) {
    return (
      <div>
        <div className="mb-4 pt-1 text-[19px] font-extrabold tracking-tight text-text">Робота</div>
        <div className="card-raised rounded-card bg-surface py-10 text-center text-[12px] font-semibold text-text-faint">
          Ще немає торгових рахунків
          <Link href="/work/prop-accounts" className="mt-3 block text-[12.5px] font-extrabold text-sage">
            Додати рахунок
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between px-0.5 pt-1">
        <h1 className="text-[19px] font-extrabold tracking-tight text-text">Робота</h1>
        {streak > 0 && (
          <div className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-gold">
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

      <AnalyticsCarousel trades={trades} instrumentById={instrumentById} sessions={sessions} currencySymbol={symbol} />

      <div className="card-raised mb-4 flex rounded-card bg-surface">
        <button onClick={openNewTrade} className="flex flex-1 flex-col items-center gap-1.5 py-3.5">
          <PlusIcon className="h-[18px] w-[18px] text-text-dim" />
          <span className="text-[11px] font-semibold text-text">Угода</span>
        </button>
        <Link href="/work/calculator" className="flex flex-1 flex-col items-center gap-1.5 py-3.5">
          <CalculatorIcon className="h-[18px] w-[18px] text-text-dim" />
          <span className="text-[11px] font-semibold text-text">Ризик</span>
        </Link>
        <Link href="/work/economic-calendar" className="flex flex-1 flex-col items-center gap-1.5 py-3.5">
          <CalendarDateIcon className="h-[18px] w-[18px] text-text-dim" />
          <span className="text-[11px] font-semibold text-text">Календар</span>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link href="/work/journal" className="card-raised col-span-2 rounded-card bg-surface p-3.5">
          <IconWell>
            <NotebookIcon className="h-[18px] w-[18px]" />
          </IconWell>
          <div className="mt-2 text-[12.5px] font-semibold text-text">Журнал угод</div>
          <div className={cn("font-display mt-0.5 text-[20px] font-bold", allTimeNet >= 0 ? "text-sage" : "text-clay")}>
            {allTimeNet >= 0 ? "+" : ""}
            {allTimeNet.toFixed(0)} {symbol}
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-text-faint">
            {allClosed.length} угод{allClosed.length === 1 ? "а" : ""} · win rate {allWinRate}%
          </div>
        </Link>

        <Link href="/work/calculator" className="card-raised rounded-card bg-surface p-3.5">
          <IconWell>
            <CalculatorIcon className="h-[18px] w-[18px]" />
          </IconWell>
          <div className="mt-2 text-[12.5px] font-semibold text-text">Калькулятор позиції</div>
          <div className="mt-0.5 text-[10.5px] text-text-faint">
            Розмір під ризик · {avgLot.toFixed(2)} станд. лот
          </div>
        </Link>

        <Link href="/work/news" className="card-raised rounded-card bg-surface p-3.5">
          <IconWell>
            <NewspaperIcon className="h-[18px] w-[18px]" />
          </IconWell>
          <div className="mt-2 text-[12.5px] font-semibold text-text">Новини</div>
          <div className="mt-0.5 truncate text-[10.5px] text-text-faint">
            {newsFocus?.headline ?? "Поки немає новин"}
          </div>
        </Link>
      </div>

      <Link href="/work/teams" className="card-raised flex items-center gap-3 rounded-card bg-surface p-3.5">
        <IconWell>
          <UsersIcon className="h-4 w-4" />
        </IconWell>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-text">Команда</span>
          <span className="mt-0.5 block text-[10.5px] text-text-faint">Чат, спільні проєкти</span>
        </span>
        <span className="flex-shrink-0 text-[13px] text-text-faint">›</span>
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
